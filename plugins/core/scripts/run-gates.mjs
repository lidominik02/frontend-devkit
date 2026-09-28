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
//          A directory that is not a project root (projectRoot in
//          project-facts.mjs) also exits 1: nothing there can have passed. Its
//          gates are not-run without `blocking`, so the Stop hook stays silent.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { detect, readJson } from './project-facts.mjs';

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
const typecheckMissing = facts.projectRoot.isRoot && !facts.gates.typecheck?.command && facts.stack.typed;
// Two flags, not one. Nuxt and a plain Vue SPA both need template checking, but
// the command that delivers it and the file the strictness setting goes in are
// different, and giving a Nuxt repo the SPA answer produces a gate that passes
// without checking anything -- see typecheckVacuous below.
const nuxt = facts.stack.stack === 'nuxt';
const vue = nuxt || facts.stack.stack === 'vue-spa';
// vue-tsc needs TypeScript's stable programmatic compiler API, which the 7.x
// line does not ship. Upgrading TypeScript silently removes a Vue repo's only
// template type-checking.
const typescriptTooNewForVueTsc = vue && (facts.stack.typescriptMajor ?? 0) >= 7;

// The worst outcome this file can produce is a gate that exits 0 without having
// checked anything, because that is indistinguishable from a pass to everyone
// downstream -- the same confusion the pass/not-run split exists to prevent.
//
// Nuxt 4 generates .nuxt/tsconfig.*.json and leaves the root tsconfig.json as a
// solution file: `files: []` plus `references`. A bare `vue-tsc --noEmit` there
// has no inputs, finds nothing, and exits 0. So a Nuxt repo whose typecheck
// script is plain `vue-tsc`/`tsc` with no project or build flag is reported.
//
// Gated on the root tsconfig actually looking like a solution file, because the
// documented workaround for a vue-tsc build-mode bug is to keep the Nuxt-3-style
// `extends: ./.nuxt/tsconfig.json`, where `vue-tsc --noEmit` does check. And
// readJson is plain JSON.parse while a real tsconfig.json is JSONC, so an
// unparseable file yields null -- which stays silent rather than warning wrongly.
// A warning that cries wolf protects nothing.
//
// The SCRIPT BODY, not `command` -- `command` is the runner invocation
// ("npm run typecheck") and never names the compiler being run.
const typecheckScript = facts.gates.typecheck?.script ?? '';
const rootTsconfig = readJson(path.join(facts.dir, 'tsconfig.json'));
const typecheckVacuous = nuxt
  && /\b(vue-tsc|tsc)\b/.test(typecheckScript)
  && !/\bnuxt\s+typecheck\b|\bnuxi\s+typecheck\b|(^|\s)(-b|--build|-p|--project)(\s|$)/.test(typecheckScript)
  && Array.isArray(rootTsconfig?.references)
  && Array.isArray(rootTsconfig?.files) && rootTsconfig.files.length === 0;

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
    say('   NO INPUTS: it exits 0 having checked nothing. This gate reports "pass" and');
    say('   verifies nothing -- treat it as NOT RUN until it is changed to `nuxt typecheck`.');
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

process.exit(failed.length > 0 || brokenSetup.length > 0 || !facts.projectRoot.isRoot ? 1 : 0);
