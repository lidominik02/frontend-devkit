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
//   node run-gates.mjs --gate lint        one named gate
//   node run-gates.mjs --json             machine-readable
//   node run-gates.mjs --list             show what would run, run nothing
//   node run-gates.mjs --timeout 120000   per-gate timeout in ms
//
// Exit 0 = every gate this project HAS, ran and passed.
// Exit 1 = a gate failed, or a gate that this project declares could not run.
//          A gate the project simply does not have is reported, but does not
//          fail the run -- otherwise the exit code would be permanently red on
//          a gate-poor repo, and an exit code people ignore protects nothing.

import { spawnSync } from 'node:child_process';
import { detect } from './project-facts.mjs';

/** @typedef {{ name: string, command: string|null, status: 'pass'|'fail'|'not-run', reason?: string, blocking?: boolean, code?: number }} GateResult */

const STAGES = /** @type {Record<string, string[]>} */ ({
  // Cheap enough to run on every turn -- this is what the Stop hook uses.
  fast: ['typecheck', 'lint'],
  // What a pre-merge review needs. `build` is excluded: on a gate-poor repo it
  // is often the only gate present, and a review that runs a production build
  // verifies nothing about the diff.
  full: ['typecheck', 'lint', 'test'],
  // Everything, including the build. Ask for this explicitly.
  release: ['typecheck', 'lint', 'test', 'build'],
});
// `format` belongs to no stage: it rewrites files, making it a fixer rather
// than a gate. The PostToolUse hook already runs it.

const DEFAULT_TIMEOUT_MS = 600_000;

// Scripts that never exit. A timeout catches these eventually, but only after
// burning the whole budget, so the recognisable ones are named up front.
// Matches an EXPLICIT watcher only: a bare `vitest` runs once when stdout is
// not a TTY (which it is not here), so treating it as a watcher would refuse a
// perfectly good gate.
const WATCHER = /(^|\s)(nodemon|--watch\b|-w\b|--ui\b)|(^|\s)(vite|nuxt|next|astro)\s+(dev|serve)(\s|$)/;

const argv = process.argv.slice(2);
const flagValue = (/** @type {string} */ flag) => {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : null;
};
const asJson = argv.includes('--json');
const listOnly = argv.includes('--list');
const oneGate = flagValue('--gate');
const stageName = flagValue('--stage') || 'fast';

const say = (/** @type {string} */ msg) => { if (!asJson) process.stdout.write(msg + '\n'); };

const facts = detect();
const overrides = /** @type {Record<string, unknown>} */ (facts.overrides ?? {});
const stages = /** @type {Record<string, string[]>} */ (
  overrides && typeof overrides === 'object' && 'stages' in overrides
    ? { ...STAGES, .../** @type {Record<string, string[]>} */ (overrides.stages) }
    : STAGES
);
const timeoutMs = Number(flagValue('--timeout') ?? overrides.timeoutMs ?? DEFAULT_TIMEOUT_MS);
const wanted = oneGate ? [oneGate] : (stages[stageName] ?? STAGES.fast);

/** @param {string} name */
function resolve(name) {
  const gate = facts.gates[name];
  if (!gate || !gate.command) {
    return { run: false, command: null, reason: `this project has no ${name} script`, blocking: false };
  }
  if (gate.script && WATCHER.test(gate.script)) {
    return {
      run: false,
      command: gate.command,
      reason: `"${gate.script}" starts a watcher and would never exit -- point this gate at a run-once variant`,
      blocking: true,
    };
  }
  return { run: true, command: gate.command, source: gate.source };
}

// A non-zero exit is not one thing. Separate "your code is broken" from
// "your toolchain is broken", because they have opposite fixes.
/** @param {ReturnType<typeof spawnSync>} proc */
function classify(proc) {
  if (proc.error) {
    const code = /** @type {NodeJS.ErrnoException} */ (proc.error).code;
    if (code === 'ETIMEDOUT') {
      return { status: /** @type {const} */ ('not-run'), blocking: true, reason: `timed out after ${Math.round(timeoutMs / 1000)}s` };
    }
    return { status: /** @type {const} */ ('not-run'), blocking: true, reason: `could not execute: ${proc.error.message}` };
  }
  const code = proc.status ?? 1;
  if (code === 0) return { status: /** @type {const} */ ('pass'), code };

  const out = `${proc.stdout ?? ''}${proc.stderr ?? ''}`;
  // 127 is the POSIX "command not found". A package manager running a script
  // whose binary is absent exits 127 too -- a broken toolchain, not a defect in
  // the code.
  if (code === 127 || /command not found|: not found|No such file or directory/i.test(out)) {
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

if (listOnly) {
  say(`Stage "${stageName}" in ${facts.dir}`);
  for (const name of wanted) {
    const r = resolve(name);
    say(`  ${r.run ? 'RUN ' : 'SKIP'}  ${name.padEnd(10)} ${r.run ? r.command : r.reason}`);
  }
  process.exit(0);
}

/** @type {GateResult[]} */
const results = [];

for (const name of wanted) {
  const r = resolve(name);
  if (!r.run) {
    results.push({ name, command: r.command, status: 'not-run', reason: r.reason, blocking: Boolean(r.blocking) });
    say(`NOT RUN  ${name.padEnd(10)} ${r.reason}`);
    continue;
  }
  say(`RUN      ${name.padEnd(10)} ${r.command}`);
  // Piped, not inherited: the captured output is what makes the not-run vs fail
  // classification possible. It is echoed below, so nothing is hidden.
  const proc = spawnSync(/** @type {string} */ (r.command), {
    cwd: facts.dir,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    timeout: timeoutMs,
  });
  const verdict = classify(proc);
  if (!asJson) {
    const out = `${proc.stdout ?? ''}${proc.stderr ?? ''}`.trimEnd();
    if (out) process.stdout.write(out + '\n');
  }
  if (verdict.status === 'not-run') {
    results.push({ name, command: r.command, status: 'not-run', reason: verdict.reason, blocking: true });
    say(`NOT RUN  ${name.padEnd(10)} ${verdict.reason}`);
    continue;
  }
  results.push({ name, command: r.command, status: verdict.status, code: verdict.code });
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
const typecheckMissing = !facts.gates.typecheck?.command && facts.stack.typed;
const vue = facts.stack.stack === 'vue-nuxt' || facts.stack.stack === 'vue';
// vue-tsc needs TypeScript's stable programmatic compiler API, which the 7.x
// line does not ship. Upgrading TypeScript silently removes a Vue repo's only
// template type-checking.
const typescriptTooNewForVueTsc = vue && (facts.stack.typescriptMajor ?? 0) >= 7;

if (asJson) {
  process.stdout.write(JSON.stringify({
    stage: oneGate ? `gate:${oneGate}` : stageName,
    project: { dir: facts.dir, stack: facts.stack.stack, packageManager: facts.packageManager.name, baseBranch: facts.baseBranch.name },
    results,
    passed: failed.length === 0 && brokenSetup.length === 0,
    typecheckMissing,
    typescriptTooNewForVueTsc,
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
    say('   Add one to package.json:');
    say(vue ? '     "typecheck": "vue-tsc --noEmit"' : '     "typecheck": "tsc --noEmit"');
    if (vue) say('   And set vueCompilerOptions.strictTemplates -- template checks default to OFF.');
    say('   On an existing codebase, baseline the current errors rather than fixing all of them first.');
  }
  if (typescriptTooNewForVueTsc) {
    say('');
    say(`!! TypeScript ${facts.stack.typescriptRange} with a Vue stack: vue-tsc needs the stable`);
    say('   programmatic compiler API, which TypeScript 7 does not ship. Template');
    say('   type-checking will not work. Pin TypeScript to the 6.x line.');
  }
}

process.exit(failed.length > 0 || brokenSetup.length > 0 ? 1 : 0);
