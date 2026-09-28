#!/usr/bin/env node
// Stop hook -- runs this project's fast gates before the turn can end, and
// hands back the real output when they fail. Every other component here only
// instructs Claude to verify before reporting done; this makes the turn depend
// on it.
//
// What it does not do:
//   - Run expensive gates. Fast stage only (typecheck + lint). Tests and builds
//     belong to review and CI, not to every turn.
//   - Block a repo that has no gates. Nothing to verify is not a failure.
//   - Block on a broken toolchain. A missing binary is reported as context
//     rather than a wall, so an uninstalled dependency cannot produce a session
//     that will not end.
//   - Loop. `stop_hook_active` is honoured, and the platform caps consecutive
//     blocks at 8 (CLAUDE_CODE_STOP_HOOK_BLOCK_CAP).
//   - Re-run on a repository whose tracked and untracked non-ignored files are
//     unchanged since the last green run in this session. A change only to
//     ignored files, such as generated types, is not detected.
//   - Run at all while a background subagent is still running.
//
// Opt out per repo with `"verifyOnStop": false` in .claude/project.json.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RUN_GATES = fileURLToPath(new URL('./run-gates.mjs', import.meta.url));
// The git calls and the gates share one budget inside the 200 s Stop timeout in
// hooks.json: a hook killed at that timeout writes no block.
const DEADLINE_MS = 190_000;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', () => {
  try { main(raw); } catch (err) {
    // Same principle as the PreToolUse hook: a gate that cannot run must not
    // become a turn you can never end.
    process.stderr.write(`devkit verify-before-done: skipped, ${String(err)}\n`);
  }
  process.exit(0);
});

/**
 * Stdout of a git command, or null when it fails (not a git repo, no HEAD yet, git unavailable).
 * @param {string} dir @param {string[]} args @param {string} [input]
 */
function git(dir, args, input) {
  // --no-optional-locks: a Stop hook must never rewrite the index behind the session.
  const r = spawnSync('git', ['--no-optional-locks', '-C', dir, ...args], {
    encoding: 'utf8', timeout: 10_000, input, maxBuffer: 64 * 1024 * 1024,
  });
  return r.status === 0 ? String(r.stdout) : null;
}

/** @param {string} dir @param {string} status */
function fingerprint(dir, status) {
  // HEAD itself is part of the tree: a branch switch can carry the same diff
  // onto different committed content. An unborn branch diffs against the empty tree.
  const head = git(dir, ['rev-parse', '--verify', '-q', 'HEAD'])?.trim() ?? null;
  const base = head ?? git(dir, ['hash-object', '-t', 'tree', '--stdin'], '')?.trim();
  if (!base) return null;
  const diff = git(dir, ['diff', '--binary', '--no-ext-diff', '--no-textconv', base, '--']);
  if (diff === null) return null;
  // `:/` and --full-name: untracked files of the whole repository, as status and diff cover,
  // named from the top level, where hash-object resolves --stdin-paths (git 2.43.0).
  const untracked = git(dir, ['ls-files', '-o', '--exclude-standard', '--full-name', '-z', '--', ':/']);
  if (untracked === null) return null;
  const paths = untracked.split('\0').filter(Boolean);
  // --stdin-paths reads one path per line, so a name containing a newline cannot be passed.
  if (paths.some((p) => p.includes('\n'))) return null;
  // No -w and no filters: hashing must not write objects or run a clean filter.
  const hashes = paths.length > 0
    ? git(dir, ['hash-object', '--no-filters', '--stdin-paths'], paths.join('\n') + '\n')
    : '';
  if (hashes === null) return null;
  return createHash('sha256').update([head ?? 'unborn', status, diff, untracked, hashes].join('\0')).digest('hex');
}

/** @param {string} sessionId @param {string} dir */
function statePath(sessionId, dir) {
  const key = createHash('sha256').update(`${sessionId}\0${path.resolve(dir)}`).digest('hex').slice(0, 32);
  return path.join(os.tmpdir(), `devkit-verify-before-done-${key}`);
}

/** @param {string} input */
function main(input) {
  /** @type {any} */
  let evt = {};
  try { evt = JSON.parse(input); } catch { return; }

  // Already inside a block triggered by this hook: let the turn end.
  if (evt.stop_hook_active === true) return;

  // Observed on 2.1.283: always sent, [] when idle; each entry is {id, type: "shell" |
  // "subagent", status: "running", description, command | agent_type}. Absent counts as empty.
  const tasks = Array.isArray(evt.background_tasks) ? evt.background_tasks : [];
  // A running subagent may still be writing files and wakes the session when it ends. A
  // background shell such as a dev server can outlive every turn, so it never skips the gates.
  if (tasks.some((/** @type {any} */ t) => t?.type === 'subagent' && t?.status === 'running')) return;

  const dir = process.env.CLAUDE_PROJECT_DIR || evt.cwd || process.cwd();

  const manifestPath = path.join(dir, '.claude', 'project.json');
  if (existsSync(manifestPath)) {
    try {
      const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (m?.verifyOnStop === false) return;
    } catch { /* ignore a malformed manifest */ }
  }

  // Nothing changed means nothing to verify, which also keeps a pure
  // question-and-answer turn from paying for a type-check.
  const status = git(dir, ['status', '--porcelain']);
  if (status !== null && status.trim() === '') return;

  // A tree identical to the last green one in this session needs no second run. session_id
  // is sent on 2.1.283 (observed); without it, or on any failure here, the gates just run.
  let stateFile = null;
  let fp = null;
  if (typeof evt.session_id === 'string' && evt.session_id && status !== null) {
    fp = fingerprint(dir, status);
    if (fp) {
      stateFile = statePath(evt.session_id, dir);
      try {
        if (readFileSync(stateFile, 'utf8') === fp) return;
      } catch { /* no state yet, or unreadable */ }
    }
  }

  const proc = spawnSync(process.execPath, [RUN_GATES, '--stage', 'fast', '--json'], {
    cwd: dir,
    encoding: 'utf8',
    // performance.now() counts from process start, so time spent on git comes off the gates.
    timeout: Math.max(1, Math.floor(DEADLINE_MS - performance.now())),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (proc.error) return;

  /** @type {any} */
  let report;
  try { report = JSON.parse(String(proc.stdout)); } catch { return; }

  const results = Array.isArray(report?.results) ? report.results : [];
  const failed = results.filter((/** @type {any} */ r) => r.status === 'fail');
  const brokenSetup = results.filter((/** @type {any} */ r) => r.status === 'not-run' && r.blocking);
  const ran = results.filter((/** @type {any} */ r) => r.status === 'pass' || r.status === 'fail');

  // Only a green or gate-less tree is remembered, so an unchanged red tree
  // still blocks on the next Stop.
  if (stateFile && fp && failed.length === 0 && brokenSetup.length === 0) {
    try { writeFileSync(stateFile, fp); } catch { /* the next Stop just runs again */ }
  }

  // A project with no gates at all. Stay silent: the reviewer and the skills
  // already report the gap, and repeating it every turn is noise.
  if (ran.length === 0 && brokenSetup.length === 0) return;

  if (failed.length > 0) {
    const detail = failed.map((/** @type {any} */ r) => `  - ${r.name}: FAILED (${r.command})`).join('\n');
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason:
        `The turn cannot end yet: this project's fast gates are failing.\n\n${detail}\n\n` +
        `Run \`node "${RUN_GATES}" --stage fast\` to see the full output, fix what it reports, ` +
        `and try again. If a failure is pre-existing and unrelated to your change, say so ` +
        `explicitly rather than fixing it silently.`,
    }));
    return;
  }

  if (brokenSetup.length > 0) {
    // Not a code defect, so it does not block but the report must never read
    // as though these gates passed.
    const detail = brokenSetup.map((/** @type {any} */ r) => `  - ${r.name}: NOT RUN (${r.reason})`).join('\n');
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'Stop',
        additionalContext:
          `Gates that could not run in this project (broken setup, not a code defect):\n${detail}\n` +
          `Do not describe these as passing.`,
      },
    }));
  }
}
