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
//
// Opt out per repo with `"verifyOnStop": false` in .claude/project.json.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RUN_GATES = fileURLToPath(new URL('./run-gates.mjs', import.meta.url));
const OVERALL_TIMEOUT_MS = 180_000;

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

/** @param {string} dir */
function hasUncommittedWork(dir) {
  const r = spawnSync('git', ['-C', dir, 'status', '--porcelain'], { encoding: 'utf8', timeout: 10_000 });
  if (r.status !== 0) return null; // not a git repo, or git unavailable
  return String(r.stdout).trim().length > 0;
}

/** @param {string} input */
function main(input) {
  /** @type {any} */
  let evt = {};
  try { evt = JSON.parse(input); } catch { return; }

  // Already inside a block triggered by this hook: let the turn end.
  if (evt.stop_hook_active === true) return;

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
  if (hasUncommittedWork(dir) === false) return;

  const proc = spawnSync(process.execPath, [RUN_GATES, '--stage', 'fast', '--json'], {
    cwd: dir,
    encoding: 'utf8',
    timeout: OVERALL_TIMEOUT_MS,
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
