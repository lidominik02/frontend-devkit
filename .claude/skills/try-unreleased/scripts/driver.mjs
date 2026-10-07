#!/usr/bin/env node
// Runs one /try-unreleased scenario: a non-interactive Claude Code session with the working
// tree's plugins, in a fresh scratch repository, its forms answered from the scenario.
//
//   node driver.mjs <scenario.md> [--model <m>] [--budget <usd>] [--timeout <s>]
//                   [--tree <path>] [--claude <bin>] [--json]
//
// Exit 0: the session completed and every expectation was met. Exit 1: an expectation was not
// met or unverifiable, or the run was invalid, interrupted or never started. Exit 2: usage.
//
// The protocol is undocumented. Observed on Claude Code 2.1.283, with `--permission-prompt-tool
// stdio` and stream-json input: an `initialize` control request is answered with a success
// `control_response`, and an AskUserQuestion form arrives as a `can_use_tool` control request,
// answered by a `control_response` whose `updatedInput.answers` carries the picks. Other
// permission prompts are assumed to arrive the same way. A write the session never asks about —
// through Bash, or a tool a skill's allowed-tools or the fixture's settings pre-approve — is out of
// the driver's reach; one that left the scratch repository is listed as an unconfirmed write.

import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { packs as readPacks, runAsEntry } from '../../../../scripts/pack-graph.mjs';
import { answerFor, checkExpectations, parseScenario } from './scenario.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TREE = path.join(HERE, '..', '..', '..', '..');
const DEFAULTS = { model: 'sonnet', budgetUsd: 2, timeoutS: 1800 };
// Long enough for a session to flush its transcript after its result; a hung one is stopped.
const EXIT_GRACE_MS = 10_000;
const WRITE_TOOLS = { Write: 'file_path', Edit: 'file_path', MultiEdit: 'file_path', NotebookEdit: 'notebook_path' };
const INITIALIZE_ID = 'initialize-1';
const PROTOCOL_HINT = 'the CLI protocol may have changed; run /cli-upgrade-check';

class UsageError extends Error {}

function parseArgs(argv) {
  const opts = { json: false };
  const valued = { '--model': 'model', '--budget': 'budget', '--timeout': 'timeout', '--tree': 'tree', '--claude': 'claude' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (valued[a]) {
      if (i + 1 >= argv.length) throw new UsageError(`${a} needs a value`);
      opts[valued[a]] = argv[++i];
    } else if (a.startsWith('--')) throw new UsageError(`unknown option ${a}`);
    else if (opts.scenario) throw new UsageError(`one scenario per run, got a second: ${a}`);
    else opts.scenario = a;
  }
  if (!opts.scenario) throw new UsageError('no scenario file given');
  for (const key of ['budget', 'timeout']) {
    if (opts[key] !== undefined && !(Number(opts[key]) > 0)) throw new UsageError(`--${key} is a positive number, got "${opts[key]}"`);
  }
  return opts;
}

// Each pack the marketplace lists, with its dependencies, dependencies first: a framework pack
// needs core loaded beside it. Packs are named as their manifests name them.
function packDirs(tree, names) {
  let listed;
  try {
    listed = readPacks(tree);
  } catch (e) {
    throw new UsageError(`cannot read the packs of ${tree}: ${e.message}`);
  }
  const byName = new Map(listed.map((p) => [p.name, p]));
  const order = [];
  const visit = (name, chain) => {
    if (order.includes(name)) return;
    if (chain.includes(name)) throw new UsageError(`pack dependencies form a cycle: ${[...chain, name].join(' -> ')}`);
    const pack = byName.get(name);
    if (!pack) throw new UsageError(`no pack "${name}" in ${tree}; the marketplace lists ${[...byName.keys()].join(', ')}`);
    pack.deps.forEach((d) => visit(d, [...chain, name]));
    order.push(name);
  };
  names.forEach((n) => visit(n, []));
  return order.map((name) => ({ name, dir: path.join(tree, byName.get(name).dir) }));
}

/**
 * The binary `where` found for `bin` on Windows: an .exe or .com spawns without a shell; a .cmd or
 * .bat shim, which npm installs, needs one, so it is reported rather than started.
 * @param {string} whereOutput @param {string} bin
 * @returns {{ path: string } | { reason: string }}
 */
export function pickWindowsBinary(whereOutput, bin) {
  const found = whereOutput.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const exe = found.find((p) => /\.(exe|com)$/i.test(p));
  if (exe) return { path: exe };
  const shim = found.find((p) => /\.(cmd|bat)$/i.test(p));
  if (shim) return { reason: `NOT RUN: ${bin} is a .cmd shim (${shim}), which needs a shell; pass --claude <claude.exe or the package's cli.js>` };
  return { reason: `NOT RUN: ${bin} not found` };
}

function resolveCommand(bin) {
  if (/\.m?js$/.test(bin)) return { command: process.execPath, prefix: [bin] };
  if (process.platform === 'win32' && !path.extname(bin)) {
    const where = spawnSync('where', [bin], { encoding: 'utf8' });
    const picked = pickWindowsBinary(where.error ? '' : where.stdout ?? '', bin);
    return 'path' in picked ? { command: picked.path, prefix: [] } : { reason: picked.reason };
  }
  return { command: bin, prefix: [] };
}

// Inside a git hook, GIT_DIR and GIT_INDEX_FILE would point the scratch repository's git at the caller's.
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));

function git(dir, args) {
  const res = spawnSync('git', args, { cwd: dir, env: cleanEnv(), encoding: 'utf8' });
  if (res.error) throw new Error(`git could not start: ${res.error.message}`);
  if (res.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${res.stderr.trim()}`);
}

function makeRepo(repoDir, fixture) {
  for (const { path: rel, content } of fixture) {
    const p = path.join(repoDir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  git(repoDir, ['init', '-q']);
  git(repoDir, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
  git(repoDir, ['config', 'user.name', 'Try Unreleased']);
  git(repoDir, ['config', 'user.email', 'try-unreleased@example.invalid']);
  git(repoDir, ['config', 'commit.gpgsign', 'false']);
  git(repoDir, ['add', '-A']);
  git(repoDir, ['commit', '-q', '--allow-empty', '--no-verify', '-m', 'fixture']);
}

/** Whether `candidate` is `root` or below it; Windows paths compare case-insensitively. */
export function isInside(root, candidate, api = path) {
  const fold = api === path.win32 ? (p) => p.toLowerCase() : (p) => p;
  const rel = api.relative(fold(root), fold(candidate));
  return rel === '' || (rel.split(api.sep)[0] !== '..' && !api.isAbsolute(rel));
}

/**
 * Whether a write to `target` lands inside `repo`, following every symlink that exists. The deepest
 * existing ancestor is resolved, so a link anywhere on the path counts. Both sides go through the
 * native realpath: on Windows only it expands 8.3 short names, so mixing the two never compares.
 */
export function insideRepo(repo, target) {
  if (typeof target !== 'string' || !target) return false;
  let root;
  try {
    root = fs.realpathSync.native(repo);
  } catch {
    return false;
  }
  let existing = path.resolve(root, target);
  const rest = [];
  const exists = (p) => { try { fs.lstatSync(p); return true; } catch { return false; } };
  while (!exists(existing)) {
    const up = path.dirname(existing);
    if (up === existing) return false;
    rest.unshift(path.basename(existing));
    existing = up;
  }
  let real;
  try {
    // A dangling link throws here: its target is unknown, so the write is not allowed.
    real = fs.realpathSync.native(existing);
  } catch {
    return false;
  }
  return isInside(root, path.join(real, ...rest), process.platform === 'win32' ? path.win32 : path);
}

// Stops the session and everything it started; on POSIX the session leads its own process group.
// A copy of killTree in plugins/core/scripts/run-gates.mjs, which carries the observed Windows
// limit: taskkill /T finds descendants through a living root only, so after the session itself
// has exited, its pipes are closed from this side rather than waited on.
function killTree(pid) {
  if (pid === undefined) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/T', '/F', '/PID', String(pid)], { stdio: 'ignore' });
  else {
    try { process.kill(-pid, 'SIGKILL'); } catch { /* the group has already exited */ }
  }
}

function transcriptPath(cwd, sessionId) {
  const config = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return path.join(config, 'projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'), `${sessionId}.jsonl`);
}

function invalidInit(init, packs) {
  const sources = (init.plugins ?? []).map((p) => String(p.source ?? ''));
  const installed = sources.filter((s) => s.endsWith('@frontend-devkit'));
  if (installed.length) return `the installed devkit loaded beside the working tree: ${installed.join(', ')}`;
  const missing = packs.filter((p) => !sources.includes(`${p.name}@inline`)).map((p) => `${p.name}@inline`);
  if (missing.length) return `the working tree's packs did not load: ${missing.join(', ')} missing from the init event`;
  return null;
}

/** Writes the session made without asking, to a target outside the scratch repository. */
export function unconfirmedWrites(events, repoDir, denied) {
  const asked = new Set(denied.map((d) => `${d.tool}\0${d.target}`));
  return events
    .filter((e) => e?.type === 'assistant' && Array.isArray(e.message?.content))
    .flatMap((e) => e.message.content.filter((b) => b?.type === 'tool_use' && WRITE_TOOLS[b.name]))
    .map((b) => ({ tool: b.name, target: String(b.input?.[WRITE_TOOLS[b.name]] ?? '') }))
    .filter((w) => !asked.has(`${w.tool}\0${w.target}`) && !insideRepo(repoDir, w.target));
}

function baseReport(scenario, model, budgetUsd) {
  return {
    scenario: scenario.name,
    status: 'error',
    runDir: null,
    sessionId: null,
    transcript: null,
    model,
    budgetUsd,
    cliVersion: null,
    node: process.version,
    os: `${os.type()} ${os.release()}`,
    plugins: [],
    expectations: [],
    observedBeforeInterruption: [],
    unscriptedQuestions: [],
    deniedRequests: [],
    unconfirmedWrites: [],
    costUsd: null,
    notes: [],
    reason: null,
  };
}

async function run(opts, report) {
  const scenario = opts.parsed;
  const timeoutS = Number(opts.timeout ?? DEFAULTS.timeoutS);
  const tree = fs.realpathSync(path.resolve(opts.tree ?? DEFAULT_TREE));
  const packs = packDirs(tree, scenario.packs);

  const runDir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'try-unreleased-')));
  const repoDir = path.join(runDir, 'repo');
  fs.mkdirSync(repoDir);
  const sessionId = randomUUID();
  Object.assign(report, { runDir, sessionId, transcript: transcriptPath(repoDir, sessionId) });

  try {
    makeRepo(repoDir, scenario.fixture);
  } catch (e) {
    report.reason = `NOT RUN: the scratch repository could not be made: ${e.message}`;
    return report;
  }

  const bin = opts.claude ?? 'claude';
  const resolved = resolveCommand(bin);
  if (resolved.reason) {
    report.reason = resolved.reason;
    return report;
  }
  const args = [
    ...resolved.prefix,
    '-p',
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--verbose',
    '--include-hook-events',
    '--permission-prompt-tool', 'stdio',
    '--setting-sources', 'project,local',
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
    ...packs.flatMap((p) => ['--plugin-dir', p.dir]),
    '--session-id', sessionId,
    '--max-budget-usd', String(report.budgetUsd),
    '--model', report.model,
  ];

  const streamLog = fs.createWriteStream(path.join(runDir, 'stream.jsonl'));
  const stderrLog = fs.createWriteStream(path.join(runDir, 'stderr.log'));
  const events = [];

  const outcome = await new Promise((resolve) => {
    let settled = false;
    let result = null;
    let initSeen = false;
    /** The CLI's answer to the initialize request: 'success', 'error', or null before one arrives. */
    let initAck = null;
    let grace;
    const child = spawn(resolved.command, args, {
      cwd: repoDir,
      env: cleanEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    // The session's own process group keeps a terminal's Ctrl-C from reaching it, so it is passed on.
    const onSignal = (signal) => { killTree(child.pid); process.exit(128 + os.constants.signals[signal]); };
    process.once('SIGINT', onSignal);
    process.once('SIGTERM', onSignal);
    /** Set once the driver has decided to stop the session; later events are logged, not acted on. */
    let pending = null;

    const finish = (status, reason) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(grace);
      process.off('SIGINT', onSignal);
      process.off('SIGTERM', onSignal);
      resolve({ status, reason, initAck, started: initSeen || result !== null });
    };
    // What the session's end means, once it has ended or been made to.
    const verdict = (exit) => {
      if (pending) return [pending.status, pending.reason];
      // Only an explicit refusal proves a protocol break; a session that got as far as its init
      // event or its result ran, and is judged as one.
      if (!initAck && !initSeen && !result) return ['error', `NOT RUN: the session never started: no answer to the initialize request, no init event and no result (exit ${exit}; see stderr.log); ${PROTOCOL_HINT}`];
      if (!result) return ['interrupted', `the session ended without a result (exit ${exit})`];
      if (!initSeen) return ['invalid', 'no init event, so the loaded plugins were never checked'];
      if (result.subtype !== 'success' || result.is_error) return ['interrupted', `the session stopped: ${result.subtype}${result.is_error ? ', is_error' : ''}`];
      return ['completed', null];
    };
    // Closes this side of the pipes, so a descendant that outlived the session cannot hold the run open.
    const abandon = (exit) => {
      killTree(child.pid);
      child.stdin.destroy();
      child.stdout.destroy();
      child.stderr.destroy();
      child.unref();
      flush();
      finish(...verdict(exit));
    };
    const stop = (status, reason) => {
      if (settled || pending) return;
      pending = { status, reason };
      killTree(child.pid);
      child.stdin.destroy();
      clearTimeout(grace);
      grace = setTimeout(() => abandon('none, stopped'), EXIT_GRACE_MS);
    };

    const timer = setTimeout(() => stop('interrupted', `timed out after ${timeoutS} s`), timeoutS * 1000);
    const send = (msg) => { if (child.stdin.writable) child.stdin.write(JSON.stringify(msg) + '\n'); };
    const respond = (requestId, response) => send({ type: 'control_response', response: { subtype: 'success', request_id: requestId, response } });

    function onEvent(e) {
      if (e?.type === 'control_response' && e.response?.request_id === INITIALIZE_ID) {
        initAck = e.response.subtype === 'success' ? 'success' : 'error';
        if (initAck === 'error') stop('error', `NOT RUN: the CLI refused the initialize request (${e.response.error ?? 'no reason given'}); ${PROTOCOL_HINT}`);
        return;
      }
      if (e?.type === 'system' && e.subtype === 'init') {
        initSeen = true;
        report.cliVersion = e.claude_code_version ?? null;
        report.plugins = (e.plugins ?? []).map((p) => p.source);
        const why = invalidInit(e, packs);
        if (why) stop('invalid', why);
        return;
      }
      if (e?.type === 'control_request') {
        const req = e.request ?? {};
        if (req.subtype !== 'can_use_tool') {
          send({ type: 'control_response', response: { subtype: 'error', request_id: e.request_id, error: `unsupported control request ${req.subtype}` } });
          return;
        }
        const input = req.input ?? {};
        if (req.tool_name === 'AskUserQuestion') {
          const answers = {};
          for (const q of input.questions ?? []) {
            const { label, scripted, offScript } = answerFor(scenario, q);
            answers[q.question] = label;
            if (!scripted) report.unscriptedQuestions.push({ question: q.question, picked: label, ...(offScript ? { notOffered: offScript } : {}) });
          }
          respond(e.request_id, { behavior: 'allow', updatedInput: { ...input, answers } });
          return;
        }
        const field = WRITE_TOOLS[req.tool_name];
        if (field && !insideRepo(repoDir, input[field])) {
          report.deniedRequests.push({ tool: req.tool_name, target: String(input[field] ?? '') });
          respond(e.request_id, { behavior: 'deny', message: `Writes outside the scratch repository ${repoDir} are not allowed in this run.` });
          return;
        }
        respond(e.request_id, { behavior: 'allow', updatedInput: input });
        return;
      }
      if (e?.type === 'result') {
        result = e;
        report.costUsd = e.total_cost_usd ?? null;
        // The result stands: the timeout no longer applies, and a session that does not exit
        // once stdin closes is stopped after the grace.
        clearTimeout(timer);
        child.stdin.end();
        grace = setTimeout(() => abandon('none, stopped after its result'), EXIT_GRACE_MS);
      }
    }

    let buf = '';
    const handle = (line) => {
      if (!line.trim()) return;
      streamLog.write(line + '\n');
      let e;
      try { e = JSON.parse(line); } catch { return; }
      events.push(e);
      if (!pending) onEvent(e);
    };
    // The last line can arrive without a newline; it is read before the run is judged.
    const flush = () => {
      const rest = buf;
      buf = '';
      handle(rest);
    };
    child.stdout.setEncoding('utf8').on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        handle(line);
      }
    });
    child.stderr.on('data', (d) => stderrLog.write(d));
    child.stdin.on('error', () => { /* the session exited first; its exit decides the outcome */ });
    child.on('error', (err) => {
      killTree(child.pid);
      finish('error', err.code === 'ENOENT' ? `NOT RUN: ${bin} not found` : `NOT RUN: ${bin} could not start: ${err.message}`);
    });
    child.on('close', (code, signal) => {
      flush();
      finish(...verdict(code ?? signal));
    });
    send({ type: 'control_request', request_id: INITIALIZE_ID, request: { subtype: 'initialize' } });
    send({ type: 'user', message: { role: 'user', content: scenario.prompt } });
  });

  await Promise.all([streamLog, stderrLog].map((s) => new Promise((r) => s.end(r))));
  report.status = outcome.status;
  report.reason = outcome.reason;
  if (outcome.started && outcome.initAck === null) {
    report.notes.push(`the initialize request was never acknowledged, though the session ran; ${PROTOCOL_HINT}`);
  }
  report.unconfirmedWrites = unconfirmedWrites(events, repoDir, report.deniedRequests);
  // Only a completed run has results. What an interrupted one left behind is shown apart, never as
  // met; a void run's files say nothing about the working tree.
  if (outcome.status === 'completed') report.expectations = checkExpectations(scenario, { events, repoDir });
  if (outcome.status === 'interrupted') report.observedBeforeInterruption = checkExpectations(scenario, { events, repoDir });
  return report;
}

function text(report) {
  const lines = [`Scenario: ${report.scenario}`, `Status: ${report.status}${report.reason ? ` — ${report.reason}` : ''}`];
  lines.push(`Claude Code ${report.cliVersion ?? 'unknown'} · Node ${report.node} · ${report.os} · model ${report.model} · budget ${report.budgetUsd} USD · cost ${report.costUsd ?? 'unknown'} USD`);
  lines.push(`Plugins: ${report.plugins.join(', ') || 'none reported'}`);
  for (const n of report.notes) lines.push(`Note: ${n}`);
  const list = (title, items) => {
    lines.push('', `${title}:`);
    for (const e of items) lines.push(`  ${e.result.padEnd(12)} ${e.text} — ${e.detail}`);
  };
  if (report.expectations.length) list('Expectations', report.expectations);
  else if (report.observedBeforeInterruption.length) list('Observed before the interruption (not results; the run did not complete)', report.observedBeforeInterruption);
  else lines.push('', 'Expectations: not checked, the run is void');
  lines.push('', `Questions outside the scenario: ${report.unscriptedQuestions.length ? '' : 'none'}`);
  for (const q of report.unscriptedQuestions) lines.push(`  "${q.question}" → ${q.picked}${q.notOffered ? ` (the scripted "${q.notOffered}" is not an option)` : ''}`);
  lines.push(`Denied requests: ${report.deniedRequests.length ? '' : 'none'}`);
  for (const d of report.deniedRequests) lines.push(`  ${d.tool} ${d.target}`);
  lines.push(`Unconfirmed writes outside the scratch repository: ${report.unconfirmedWrites.length ? '' : 'none'}`);
  for (const w of report.unconfirmedWrites) lines.push(`  ${w.tool} ${w.target}`);
  if (report.runDir) lines.push('', `Run directory: ${report.runDir}`, `Stream log: ${path.join(report.runDir, 'stream.jsonl')}`, `Transcript (expected): ${report.transcript}`);
  return lines.join('\n');
}

const passed = (report) => report.status === 'completed' && report.expectations.every((e) => e.result === 'met');

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
    opts.parsed = parseScenario(fs.readFileSync(opts.scenario, 'utf8'));
    // Resolves the packs before a run directory exists, so a usage error leaves nothing behind.
    packDirs(fs.realpathSync(path.resolve(opts.tree ?? DEFAULT_TREE)), opts.parsed.packs);
  } catch (e) {
    process.stderr.write(`driver: ${e.code === 'ENOENT' ? `cannot read ${e.path}` : e.message}\n`);
    process.exit(2);
  }
  const model = opts.model ?? opts.parsed.model ?? DEFAULTS.model;
  const budgetUsd = Number(opts.budget ?? opts.parsed.budgetUsd ?? DEFAULTS.budgetUsd);
  const report = baseReport(opts.parsed, model, budgetUsd);
  try {
    await run(opts, report);
  } catch (e) {
    // A run that fails before or after the session still reports, with whatever it reached.
    report.status = 'error';
    report.expectations = [];
    report.reason = `${report.sessionId ? 'the driver failed' : 'NOT RUN'}: ${e.message}`;
  }
  process.stdout.write((opts.json ? JSON.stringify(report, null, 2) : text(report)) + '\n');
  process.exitCode = passed(report) ? 0 : 1;
}

runAsEntry(import.meta.main, main, 'driver.mjs');
