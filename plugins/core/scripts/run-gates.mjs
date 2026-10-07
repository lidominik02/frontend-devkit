#!/usr/bin/env node
// Runs a project's quality gates and reports the result as an exit code, so
// "never claim a gate passed that did not run" is enforced rather than merely
// instructed. A gate that did not run is reported as NOT RUN with a reason.
//
// Gates are discovered from the project's own package.json scripts (see
// project-facts.mjs) and resolved at the moment of use, so installing
// dependencies mid-session cannot leave a stale answer behind. Nothing has to
// be added to the project.
//
// The distinction this file preserves: a gate that FAILED found a defect in the
// code; a gate that COULD NOT RUN found a defect in the setup. A bare exit code
// conflates them. `proc.error` does not separate them either -- under
// `shell: true` a missing binary yields `{ status: 127, error: null }`, because
// the shell started fine and it was the shell that could not find the command.
// Classification therefore reads the exit code and the captured output, which
// is also why stdio is piped rather than inherited.
//
// Usage:
//   node run-gates.mjs                    run the default stage ("fast")
//   node run-gates.mjs --stage full       typecheck + lint + test
//   node run-gates.mjs --stage release    ...plus build
//   node run-gates.mjs --gate lint        one gate, by its canonical name
//   node run-gates.mjs --json             machine-readable
//   node run-gates.mjs --list             show what would run, run nothing
//   node run-gates.mjs --timeout 120000   per-gate timeout in ms; 0 for none
//   node run-gates.mjs --budget 180000    whole-run budget in ms; no gate outlives it
//
// Exit 0 = every gate this project HAS, ran and passed.
// Exit 1 = a gate failed, or a gate that this project declares could not run.
//          A gate the project simply does not have is reported, but does not
//          fail the run -- otherwise the exit code would be permanently red on
//          a gate-poor repo, and an exit code people ignore protects nothing.
//          A gate whose script rewrites files (--fix, --write, --apply) is not
//          run, and does not fail the run either.
//          A directory that is not a project root (projectRoot in
//          project-facts.mjs) also exits 1: nothing there can have passed. Its
//          gates are not-run without `blocking`, so the Stop hook stays silent.
// Exit 2 = a usage error, and no gate ran: an unknown --stage, a --gate that is
//          not a canonical gate name, a flag with no value or another flag in
//          its place, a flag given twice, an unknown flag or a stray argument,
//          or a bad --timeout, --budget or timeout setting. stderr says
//          `run-gates: <message>`; under --json stdout carries
//          {"passed": false, "usageError": "<message>"} and no results.
// Exit 128 + n = stopped by signal n (SIGINT, SIGTERM or SIGHUP), with the
//          gate in flight stopped first.

import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { GATE_NAMES, detect, readJson } from './project-facts.mjs';

/** @typedef {{ name: string, command: string|null, status: 'pass'|'fail'|'not-run', reason?: string, blocking?: boolean, code?: number, output?: string }} GateResult */

const STAGES = /** @type {Record<string, string[]>} */ ({
  // Cheap enough to run on every turn -- this is what the Stop hook uses.
  fast: ['typecheck', 'lint'],
  // What a pre-merge review needs. Stages are picked by risk and by what the
  // user has released: `build` is the slowest gate and guards the release, so
  // it runs in the release stage only, when that stage is asked for.
  full: ['typecheck', 'lint', 'test'],
  // Everything, including the build. Ask for this explicitly.
  release: ['typecheck', 'lint', 'test', 'build'],
});
// `format` belongs to no stage: the PostToolUse hook already runs it. Asked for
// with --gate, it runs only when its script checks rather than writes (see resolve).

const DEFAULT_TIMEOUT_MS = 600_000;
// The end of a gate's output that a result carries: enough to act on, small
// enough that the Stop hook's reason stays bounded however many gates fail.
const OUTPUT_LINES = 60;
const OUTPUT_CHARS = 4000;
// After a gate's tree is killed, how long its pipes may stay open before the run moves on.
const KILL_GRACE_MS = 2_000;

// Scripts that never exit. A timeout catches these eventually, but only after
// burning the whole budget, so the recognisable ones are named up front.
// Matches an EXPLICIT watcher only: a bare `vitest` runs once when stdout is
// not a TTY (which it is not here), so treating it as a watcher would refuse a
// perfectly good gate.
const WATCHER = /(^|\s)(nodemon|--watch\b|-w\b|--ui\b)|(^|\s)(vite|nuxt|next|astro)\s+(dev|serve)(\s|$)/;

// A gate that rewrites what it checks passes on its own edits and puts them in the
// diff. `--fix-dry-run` only reports, so the flag must end at a token boundary.
const FIXER_FLAG = /(?:^|\s)["']?(--fix|--write|--apply)(?=["'=\s]|$)/;
const SCRIPT_RUNNERS = ['run-s', 'run-p', 'npm-run-all'];
const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn'];

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const listOnly = argv.includes('--list');

/** @param {string} message @returns {never} */
function usageError(message) {
  process.stderr.write(`run-gates: ${message}\n`);
  if (asJson) process.stdout.write(JSON.stringify({ passed: false, usageError: message }, null, 2) + '\n');
  process.exit(2);
}

// A misspelt flag must not fall back to the default stage and report a pass.
const VALUE_FLAGS = ['--stage', '--gate', '--timeout', '--budget'];
const SWITCHES = ['--json', '--list'];
/** @type {Map<string, string>} */
const flagValues = new Map();
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (SWITCHES.includes(arg)) continue;
  if (!VALUE_FLAGS.includes(arg)) {
    usageError(arg.startsWith('--') ? `unknown flag ${JSON.stringify(arg)}` : `unexpected argument ${JSON.stringify(arg)}`);
  }
  // Only one occurrence is read, so a second one would be silently ignored.
  if (flagValues.has(arg)) usageError(`${arg} given more than once`);
  // A flag followed by another flag has no value: `--stage --json` must not run
  // the default stage, and must not swallow --json either.
  const next = argv[i + 1];
  if (next === undefined || next.startsWith('--')) usageError(`${arg} needs a value`);
  flagValues.set(arg, next);
  i++;
}

const flagValue = (/** @type {string} */ flag) => flagValues.get(flag) ?? null;
const oneGate = flagValue('--gate');
const stageFlag = flagValue('--stage');
const stageName = stageFlag ?? 'fast';

const say = (/** @type {string} */ msg) => { if (!asJson) process.stdout.write(msg + '\n'); };

const facts = detect();

if (!Object.hasOwn(STAGES, stageName)) {
  usageError(`unknown stage ${JSON.stringify(stageName)}; use one of: ${Object.keys(STAGES).join(', ')}`);
}
// An alias such as `test:unit` is a script name, not a gate name, so it is refused.
if (oneGate !== null && !GATE_NAMES.includes(oneGate)) {
  usageError(`unknown gate ${JSON.stringify(oneGate)}; use one of: ${GATE_NAMES.join(', ')}`);
}

const overrides = /** @type {Record<string, unknown>} */ (facts.overrides ?? {});
const stages = /** @type {Record<string, string[]>} */ (
  overrides && typeof overrides === 'object' && 'stages' in overrides
    ? { ...STAGES, .../** @type {Record<string, string[]>} */ (overrides.stages) }
    : STAGES
);
// setTimeout turns NaN, or anything above 2^31-1, into 1 ms, which would report
// every gate of a healthy project as timed out. A bad value is a usage error.
const MAX_TIMER_MS = 2_147_483_647;
/** @param {unknown} value @param {string} source @returns {number} */
function milliseconds(value, source) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MAX_TIMER_MS) return n;
  usageError(`${source} must be a whole number of milliseconds from 0 to ${MAX_TIMER_MS}, got ${JSON.stringify(value)}`);
}

// 0 means no per-gate timeout, as it did under spawnSync; a budget still applies.
const timeoutFlag = flagValue('--timeout');
const timeoutMs = timeoutFlag !== null
  ? milliseconds(timeoutFlag, '--timeout')
  : overrides.timeoutMs !== undefined && overrides.timeoutMs !== null
    ? milliseconds(overrides.timeoutMs, '"timeoutMs"')
    : DEFAULT_TIMEOUT_MS;
// Measured against performance.now(), which counts from this process's start, so
// the time spent starting up comes off the budget too.
const budgetFlag = flagValue('--budget');
const budgetMs = budgetFlag === null ? Infinity : milliseconds(budgetFlag, '--budget');
const wanted = oneGate ? [oneGate] : (stages[stageName] ?? STAGES.fast);

const nuxt = facts.stack.stack === 'nuxt';
// The worst outcome this file can produce is a gate that exits 0 without having
// checked anything: downstream it is indistinguishable from a pass. So a gate
// recognised as vacuous is not run (see resolve) and is NOT RUN, blocking.
//
// Nuxt 4 generates .nuxt/tsconfig.*.json and leaves the root tsconfig.json as a
// solution file: `files: []` plus `references`. A bare `vue-tsc --noEmit` there
// has no inputs, finds nothing, and exits 0. So a Nuxt repo whose typecheck
// script is plain `vue-tsc`/`tsc` with no project or build flag is vacuous.
//
// Gated on the root tsconfig actually looking like a solution file, because the
// documented workaround for a vue-tsc build-mode bug is to keep the Nuxt-3-style
// `extends: ./.nuxt/tsconfig.json`, where `vue-tsc --noEmit` does check. And
// readJson is plain JSON.parse while a real tsconfig.json is JSONC, so an
// unparseable file yields null -- which stays silent rather than blocking wrongly.
//
// The SCRIPT BODY, not `command` -- `command` is the runner invocation
// ("npm run typecheck") and never names the compiler being run.
const typecheckScript = facts.gates.typecheck?.script ?? '';
const rootTsconfig = readJson(path.join(facts.dir, 'tsconfig.json'));
const typecheckVacuous = wanted.includes('typecheck')
  && nuxt
  && /\b(vue-tsc|tsc)\b/.test(typecheckScript)
  && !/\bnuxt\s+typecheck\b|\bnuxi\s+typecheck\b|(^|\s)(-b|--build|-p|--project)(\s|$)/.test(typecheckScript)
  && Array.isArray(rootTsconfig?.references)
  && Array.isArray(rootTsconfig?.files) && rootTsconfig.files.length === 0;

// A missing or unreadable package.json yields no scripts, so the chain is not followed.
const packageScripts = /** @type {Record<string, unknown>} */ ((() => {
  const scripts = readJson(path.join(facts.dir, 'package.json'))?.scripts;
  return scripts && typeof scripts === 'object' && !Array.isArray(scripts) ? scripts : {};
})());

// npm-run-all's pattern: `*` stays inside one `:`-separated segment, `**` crosses them.
/** @param {string} pattern */
function scriptPattern(pattern) {
  const escape = (/** @type {string} */ s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${pattern.split('**').map((part) => part.split('*').map(escape).join('[^:]*')).join('.*')}$`);
}

/** The package.json scripts `script` runs through run-s, run-p, npm-run-all or a package manager. @param {string} script */
function calledScripts(script) {
  const names = new Set();
  for (const command of script.split(/&&|\|\||[;&|]/)) {
    const words = command.replace(/["']/g, '').trim().split(/\s+/);
    words.forEach((word, i) => {
      const args = words.slice(i + 1).filter((w) => !w.startsWith('-'));
      if (SCRIPT_RUNNERS.includes(word)) {
        for (const re of args.map(scriptPattern)) {
          for (const n of Object.keys(packageScripts)) if (re.test(n)) names.add(n);
        }
      } else if (PACKAGE_MANAGERS.includes(word)) {
        const name = args[0] === 'run' ? args[1] : word === 'npm' ? undefined : args[0];
        if (name !== undefined && typeof packageScripts[name] === 'string') names.add(name);
      }
    });
  }
  return names;
}

/** The fixer flag `script` runs, and the script it sits in when one level down. @param {string} script */
function fixerIn(script) {
  const own = FIXER_FLAG.exec(script);
  if (own) return { flag: own[1], via: null };
  for (const name of calledScripts(script)) {
    const found = FIXER_FLAG.exec(String(packageScripts[name]));
    if (found) return { flag: found[1], via: name };
  }
  return null;
}

/** @param {string} name */
function resolve(name) {
  const gate = facts.gates[name];
  if (!gate || !gate.command) {
    const reason = facts.projectRoot.reason
      ? `${facts.projectRoot.reason} -- cd to the project root and run this again`
      : `this project has no ${name} script`;
    return { run: false, command: null, reason, blocking: false };
  }
  if (gate.script && WATCHER.test(gate.script)) {
    return {
      run: false,
      command: gate.command,
      reason: `"${gate.script}" starts a watcher and would never exit -- point this gate at a run-once variant`,
      blocking: true,
    };
  }
  // Not blocking: the script is not broken, and a scaffold's default `lint` fixes.
  const fixer = gate.script ? fixerIn(gate.script) : null;
  if (fixer) {
    const where = fixer.via ? ` in the "${fixer.via}" script it runs` : '';
    return {
      run: false,
      command: gate.command,
      reason: `"${gate.script}" rewrites files (${fixer.flag}${where}) and is not run as a gate -- in package.json, make this script check only and move the fix into a separate script such as "lint:fix"`,
      blocking: false,
    };
  }
  if (name === 'typecheck' && typecheckVacuous) {
    return {
      run: false,
      command: gate.command,
      reason: `"${gate.script}" has no inputs on this Nuxt project's solution tsconfig.json and would check nothing -- change it to \`nuxt typecheck\``,
      blocking: true,
    };
  }
  return { run: true, command: gate.command, source: gate.source };
}

/** @typedef {{ status: number|null, stdout: string, stderr: string, output: string, error?: NodeJS.ErrnoException }} GateRun */

// Stops a gate and everything it started. Killing only the shell is not enough:
// on Windows a timed-out spawnSync stopped cmd.exe and left npm's node running,
// holding the gate's cwd. On POSIX the gate leads its own process group, so the
// negative pid reaches its descendants and never this script, Claude Code or a
// test runner. taskkill /T finds descendants through a living root only: a
// process whose parent shell has already exited is out of its reach.
/** @param {number} pid */
function killTree(pid) {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/T', '/F', '/PID', String(pid)], { stdio: 'ignore' });
  } else {
    try { process.kill(-pid, 'SIGKILL'); } catch { /* the group has already exited */ }
  }
}

/** The pid of the gate running now, if any. @type {number|undefined} */
let inFlight;

// On POSIX the gate's own process group puts it out of reach of a terminal's
// Ctrl-C and of a SIGTERM sent to this script alone, so an interrupt that ends
// this script stops the gate's tree first. Exit 128 + n is the shell convention.
for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM', 'SIGHUP'])) {
  process.on(signal, () => {
    if (inFlight !== undefined) killTree(inFlight);
    process.exit(128 + os.constants.signals[signal]);
  });
}

/**
 * @param {string} command @param {number} ms Infinity runs the gate with no timer
 * @returns {Promise<GateRun>}
 */
function runGate(command, ms) {
  return new Promise((done) => {
    let stdout = '';
    let stderr = '';
    // Both streams in the order they arrived, as a terminal would have shown them.
    let output = '';
    /** @type {NodeJS.ErrnoException|undefined} */
    let error;
    /** @type {NodeJS.Timeout|undefined} */
    let grace;
    let settled = false;
    // Piped, not inherited: the captured output is what makes the not-run vs fail
    // classification possible. It is echoed by the caller, so nothing is hidden.
    const child = spawn(command, {
      cwd: facts.dir,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    inFlight = child.pid;
    /** @param {number|null} status */
    const finish = (status) => {
      if (settled) return;
      settled = true;
      inFlight = undefined;
      clearTimeout(timer);
      clearTimeout(grace);
      done({ status, stdout, stderr, output, error });
    };
    child.stdout.setEncoding('utf8').on('data', (d) => { stdout += d; output += d; });
    child.stderr.setEncoding('utf8').on('data', (d) => { stderr += d; output += d; });
    const timer = Number.isFinite(ms) ? setTimeout(() => {
      error = Object.assign(new Error(`timed out after ${ms}ms`), { code: 'ETIMEDOUT' });
      if (child.pid !== undefined) killTree(child.pid);
      // A descendant out of the kill's reach can hold the pipes open indefinitely.
      grace = setTimeout(() => {
        child.stdout.destroy();
        child.stderr.destroy();
        // This script ends by running out of work, so a child that outlived the kill must not hold it.
        child.unref();
        finish(null);
      }, KILL_GRACE_MS);
    }, ms) : undefined;
    child.on('error', (err) => { error ??= err; finish(null); });
    child.on('close', (status) => finish(status));
  });
}

// A non-zero exit is not one thing. Separate "your code is broken" from
// "your toolchain is broken", because they have opposite fixes.
/** @param {GateRun} proc @param {number} ms the timeout this gate ran under */
function classify(proc, ms) {
  if (proc.error) {
    const code = proc.error.code;
    if (code === 'ETIMEDOUT') {
      return { status: /** @type {const} */ ('not-run'), blocking: true, reason: `timed out after ${Math.round(ms / 1000)}s` };
    }
    return { status: /** @type {const} */ ('not-run'), blocking: true, reason: `could not execute: ${proc.error.message}` };
  }
  const code = proc.status ?? 1;
  if (code === 0) return { status: /** @type {const} */ ('pass'), code };

  const out = `${proc.stdout ?? ''}${proc.stderr ?? ''}`;
  // Exit 127 means a missing binary on every OS; the words alone also appear in a failing
  // test's output. cmd.exe exits 1 instead, so on Windows a stderr line starting with the
  // shell's own wording counts too; PowerShell may put `<name> :` before its wording.
  const notInstalled =
    code === 127
    || (process.platform === 'win32'
      && /^(?:'[^']*' is not recognized as an internal or external command|(?:\S+ ?: )?The term '[^']*' is not recognized)/m.test(proc.stderr ?? ''));
  if (notInstalled) {
    return {
      status: /** @type {const} */ ('not-run'),
      blocking: true,
      reason: 'the command is not installed here -- run the package manager install first',
    };
  }
  // npm: "Missing script: x". pnpm: 'Command "x" not found'. yarn: 'error Command "x" not found.'
  if (/Missing script:|Command "[^"]*" not found/i.test(out)) {
    return {
      status: /** @type {const} */ ('not-run'),
      blocking: true,
      reason: 'the package manager has no such script',
    };
  }
  return { status: /** @type {const} */ ('fail'), code };
}

/** The last OUTPUT_LINES lines of `text`, then at most its last OUTPUT_CHARS characters. @param {string} text */
function outputTail(text) {
  const trimmed = text.trimEnd();
  let cut = trimmed.length;
  for (let n = 0; n < OUTPUT_LINES && cut !== -1; n++) cut = cut === 0 ? -1 : trimmed.lastIndexOf('\n', cut - 1);
  return trimmed.slice(cut + 1).slice(-OUTPUT_CHARS);
}

if (listOnly) {
  say(`Stage "${stageName}" in ${facts.dir}`);
  for (const name of wanted) {
    const r = resolve(name);
    say(`  ${r.run ? 'RUN ' : 'SKIP'}  ${name.padEnd(10)} ${r.run ? r.command : r.reason}`);
  }
  process.exitCode = 0;
} else {
  await runAndReport();
}

// Ends by setting process.exitCode, never by process.exit(): on a pipe stdout may
// still be draining, and process.exit() drops whatever has not been written yet.
async function runAndReport() {
  /** @type {GateResult[]} */
  const results = [];

  for (const name of wanted) {
    const r = resolve(name);
    if (!r.run) {
      results.push({ name, command: r.command, status: 'not-run', reason: r.reason, blocking: Boolean(r.blocking) });
      say(`NOT RUN  ${name.padEnd(10)} ${r.reason}`);
      continue;
    }
    const left = Math.floor(budgetMs - performance.now());
    if (left <= 0) {
      const reason = 'no time left in the budget';
      results.push({ name, command: r.command, status: 'not-run', reason, blocking: true });
      say(`NOT RUN  ${name.padEnd(10)} ${reason}`);
      continue;
    }
    say(`RUN      ${name.padEnd(10)} ${r.command}`);
    const gateTimeout = Math.min(timeoutMs === 0 ? Infinity : timeoutMs, left);
    const proc = await runGate(/** @type {string} */ (r.command), gateTimeout);
    const verdict = classify(proc, gateTimeout);
    if (!asJson) {
      const out = proc.output.trimEnd();
      if (out) process.stdout.write(out + '\n');
    }
    if (verdict.status === 'not-run') {
      // A shell that could not be spawned printed nothing: no `output`, as for a gate that never started.
      const started = !proc.error || proc.error.code === 'ETIMEDOUT';
      results.push({ name, command: r.command, status: 'not-run', reason: verdict.reason, blocking: true, ...(started ? { output: outputTail(proc.output) } : {}) });
      say(`NOT RUN  ${name.padEnd(10)} ${verdict.reason}`);
      continue;
    }
    results.push({
      name,
      command: r.command,
      status: verdict.status,
      code: verdict.code,
      ...(verdict.status === 'pass' ? {} : { output: outputTail(proc.output) }),
    });
    say(`${verdict.status === 'pass' ? 'PASS' : 'FAIL'}     ${name}`);
  }

  const failed = results.filter((r) => r.status === 'fail');
  const notRun = results.filter((r) => r.status === 'not-run');
  const brokenSetup = notRun.filter((r) => r.blocking);

  // A typed project with no typecheck gate has no compiler verifying it, and on a
  // Vue codebase nothing checks template expressions at all -- the most valuable
  // gate to add, so a missing one is surfaced on every run.
  //
  // Only where types exist. Warning a shell-and-markdown repo to add `tsc` would
  // train people to skip the warning.
  const typecheckMissing = facts.projectRoot.isRoot && !facts.gates.typecheck?.command && facts.stack.typed;
  // Two flags, not one. Nuxt and a plain Vue SPA both need template checking, but
  // the command that delivers it and the file the strictness setting goes in are
  // different, and giving a Nuxt repo the SPA answer produces a gate that passes
  // without checking anything -- see typecheckVacuous above.
  const vue = nuxt || facts.stack.stack === 'vue-spa';
  // vue-tsc needs TypeScript's stable programmatic compiler API, which the 7.x
  // line does not ship. Upgrading TypeScript silently removes a Vue repo's only
  // template type-checking.
  const typescriptTooNewForVueTsc = vue && (facts.stack.typescriptMajor ?? 0) >= 7;

  if (asJson) {
    process.stdout.write(JSON.stringify({
      stage: oneGate ? `gate:${oneGate}` : stageName,
      project: { dir: facts.dir, root: facts.projectRoot.isRoot, stack: facts.stack.stack, packageManager: facts.packageManager.name, baseBranch: facts.baseBranch.name },
      results,
      passed: failed.length === 0 && brokenSetup.length === 0 && facts.projectRoot.isRoot,
      typecheckMissing,
      typescriptTooNewForVueTsc,
      typecheckVacuous,
      note: 'A gate with status "not-run" was NOT executed. Report it as NOT RUN, never as passing. "blocking": true means the setup is broken, not the code.',
    }, null, 2) + '\n');
  } else {
    say('');
    say(`Summary: ${results.filter((r) => r.status === 'pass').length} passed, ${failed.length} failed, ${notRun.length} not run`);
    if (notRun.length) {
      say('');
      say('These gates did NOT run. Do not report them as passing:');
      for (const r of notRun) say(`  - ${r.name}: ${r.reason}${r.blocking ? '  [broken setup, not a code defect]' : ''}`);
    }
    if (typecheckMissing) {
      say('');
      say('!! This project has TypeScript but no typecheck script.');
      say('   Nothing is verifying types.' + (vue ? ' On a Vue codebase that also means no' : ''));
      if (vue) say('   compiler checks template expressions at all.');
      if (nuxt) {
        say('   Add these to package.json:');
        say('     "postinstall": "nuxt prepare",');
        say('     "typecheck": "nuxt typecheck"');
        say('   `nuxt typecheck`, NOT `vue-tsc --noEmit`: Nuxt generates .nuxt/tsconfig.*.json');
        say('   and leaves the root tsconfig.json a solution file (files: [] plus references),');
        say('   so a bare vue-tsc there has no inputs and exits 0 without checking anything.');
        say('   Those generated types exist only after `nuxt prepare`, the dev server or a');
        say('   build -- hence the postinstall, which a clean CI checkout needs.');
        say('   Template checks still default to OFF, and the setting does NOT go in');
        say('   tsconfig.json (generated -- your edit is overwritten). In nuxt.config.ts:');
        say('     typescript: { tsConfig: { vueCompilerOptions: { strictTemplates: true } } }');
        say('   strictTemplates is the master switch: checkUnknownProps, checkUnknownEvents,');
        say('   checkUnknownComponents, checkUnknownDirectives and strictVModel follow from it.');
        say('   That key is not typed in defineNuxtConfig, so a typo fails silently -- run');
        say('   `nuxt prepare` and confirm the option landed in .nuxt/tsconfig.app.json.');
      } else {
        say('   Add one to package.json:');
        say(vue ? '     "typecheck": "vue-tsc --noEmit"' : '     "typecheck": "tsc --noEmit"');
        if (vue) say('   And set vueCompilerOptions.strictTemplates -- template checks default to OFF.');
      }
      say('   On an existing codebase, baseline the current errors rather than fixing all of them first.');
    }
    if (typecheckVacuous) {
      say('');
      say(`!! The typecheck gate on this Nuxt project runs \`${typecheckScript}\`, and the root`);
      say('   tsconfig.json is a solution file (files: [] plus references). That command has');
      say('   NO INPUTS: it would exit 0 having checked nothing. The gate was NOT RUN and');
      say('   blocks until the script is changed to `nuxt typecheck`.');
    }
    if (typescriptTooNewForVueTsc) {
      say('');
      say(`!! TypeScript ${facts.stack.typescriptRange} with a ${nuxt ? 'Nuxt' : 'Vue'} stack: vue-tsc needs the stable`);
      say('   programmatic compiler API, which TypeScript 7 does not ship. Template');
      if (nuxt) {
        say('   type-checking will not work. `nuxt typecheck` runs vue-tsc by default, so two');
        say('   remedies exist here: pin TypeScript to the 6.x line, or select the other');
        say('   checker (`nuxt typecheck --checker golar`). Confirm which checker this repo');
        say('   actually runs before assuming templates are checked at all.');
      } else {
        say('   type-checking will not work. Pin TypeScript to the 6.x line.');
      }
    }
  }

  process.exitCode = failed.length > 0 || brokenSetup.length > 0 || !facts.projectRoot.isRoot ? 1 : 0;
}
