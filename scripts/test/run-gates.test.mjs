// run-gates keeps a broken build apart from a broken toolchain: a gate that
// failed found a defect in the code, a gate that could not run found one in the setup.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { REPO_ROOT, gitRepo, isolatedEnv, runScript, tempDir } from './helpers.mjs';

const RUN_GATES = path.join(REPO_ROOT, 'plugins', 'core', 'scripts', 'run-gates.mjs');

const PASS = 'node -e "process.exit(0)"';
const FAIL = 'node -e "process.exit(1)"';
const HANG = 'node -e "setTimeout(function () {}, 30000)"';

const TYPED = { typescript: '5' };

function project(t, packageJson, tsconfig) {
  const dir = gitRepo(t);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(packageJson));
  if (tsconfig !== undefined) {
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), typeof tsconfig === 'string' ? tsconfig : JSON.stringify(tsconfig));
  }
  return dir;
}

const gates = (t, dir, ...args) =>
  runScript(RUN_GATES, { args, env: { CLAUDE_PROJECT_DIR: dir, ...isolatedEnv(tempDir(t)) } });
const gatesJson = (t, dir, ...args) => JSON.parse(gates(t, dir, ...args, '--json').stdout);

const WIN32_NOT_RECOGNIZED =
  'run-gates recognises a missing binary only by exit 127 or a POSIX "not found" message, ' +
  'while cmd.exe prints "is not recognized" and exits 1; remove this skip once run-gates handles it';

function skipOnWin32(t) {
  if (process.platform !== 'win32') return false;
  t.skip(WIN32_NOT_RECOGNIZED);
  return true;
}

describe('run-gates: pass and fail', () => {
  test('a passing gate exits 0', (t) => {
    assert.equal(gates(t, project(t, { scripts: { lint: PASS, test: FAIL } }), '--gate', 'lint').code, 0);
  });

  test('a failing gate exits 1', (t) => {
    assert.equal(gates(t, project(t, { scripts: { lint: PASS, test: FAIL } }), '--gate', 'test').code, 1);
  });

  test('a real failure is reported as fail', (t) => {
    const r = gatesJson(t, project(t, { scripts: { lint: PASS, test: FAIL } }), '--gate', 'test');
    assert.equal(r.results[0].status, 'fail');
  });
});

// A script whose binary is absent is the case a bare exit-code check misreports as a code defect.
describe('run-gates: a missing binary is a broken toolchain', () => {
  const missingBinary = (t) =>
    project(t, { scripts: { typecheck: 'definitely-not-installed-xyz --noEmit' }, devDependencies: TYPED });

  test('a missing binary is not-run, never fail, and blocking', (t) => {
    if (skipOnWin32(t)) return;
    const [r] = gatesJson(t, missingBinary(t), '--gate', 'typecheck').results;
    assert.equal(r.status, 'not-run');
    assert.equal(r.blocking, true);
  });

  test('a broken toolchain still exits non-zero', (t) => {
    assert.equal(gates(t, missingBinary(t), '--gate', 'typecheck').code, 1);
  });
});

describe('run-gates: what does not fail the run, and what never runs', () => {
  test('an absent gate does not fail the run', (t) => {
    assert.equal(gates(t, project(t, { scripts: { lint: PASS } }), '--stage', 'full').code, 0);
  });

  test('a watch-mode script is refused', (t) => {
    const [r] = gatesJson(t, project(t, { scripts: { test: 'vitest --watch' } }), '--gate', 'test').results;
    assert.match(r.reason, /never exit/);
  });

  test('a hanging gate times out as not-run', (t) => {
    const [r] = gatesJson(t, project(t, { scripts: { test: HANG } }), '--gate', 'test', '--timeout', '1200').results;
    assert.equal(r.status, 'not-run');
    assert.match(r.reason, /timed out/);
  });

  // On a gate-poor repo build is often the only gate, and running it verifies nothing about the diff.
  test('stage full does not include build', (t) => {
    assert.doesNotMatch(gates(t, project(t, { scripts: { build: PASS } }), '--list', '--stage', 'full').stdout, /build/);
  });

  test('stage release includes build', (t) => {
    assert.match(gates(t, project(t, { scripts: { build: PASS } }), '--list', '--stage', 'release').stdout, /build/);
  });
});

describe('run-gates: the typecheck nag fires only where types exist', () => {
  test('flags a missing typecheck on a typed project', (t) => {
    assert.equal(gatesJson(t, project(t, { scripts: { lint: PASS }, devDependencies: TYPED })).typecheckMissing, true);
  });

  test('does not nag an untyped project', (t) => {
    assert.equal(gatesJson(t, project(t, { scripts: { lint: PASS } })).typecheckMissing, false);
  });

  test('resolves the type-check alias', (t) => {
    assert.equal(gates(t, project(t, { scripts: { 'type-check': PASS } }), '--gate', 'typecheck').code, 0);
  });
});

// On Nuxt 4 the root tsconfig.json is a solution file, so a bare vue-tsc there
// has no inputs and exits 0: advice that manufactures a silently-passing gate.
describe('run-gates: Nuxt is pointed at nuxt typecheck, a Vue SPA at vue-tsc', () => {
  const SOLUTION = { files: [], references: [{ path: './.nuxt/tsconfig.app.json' }] };
  const nuxtAdvice = (t) =>
    gates(t, project(t, { dependencies: { nuxt: '^4' }, devDependencies: TYPED, scripts: { lint: PASS } }, SOLUTION)).stdout;
  const vueAdvice = (t) =>
    gates(t, project(t, { dependencies: { vue: '^3' }, devDependencies: TYPED, scripts: { lint: PASS } })).stdout;

  test('a Nuxt project is pointed at nuxt typecheck', (t) => assert.match(nuxtAdvice(t), /nuxt typecheck/));
  test('a Nuxt project is told it needs nuxt prepare', (t) => assert.match(nuxtAdvice(t), /nuxt prepare/));
  test('a Nuxt project is not handed the vue-tsc gate', (t) => {
    assert.ok(!nuxtAdvice(t).includes('"typecheck": "vue-tsc --noEmit"'));
  });
  test('a Vue SPA is still pointed at vue-tsc', (t) => {
    assert.ok(vueAdvice(t).includes('"typecheck": "vue-tsc --noEmit"'));
  });
  test('a plain Vue SPA is not told about nuxt typecheck', (t) => {
    assert.doesNotMatch(vueAdvice(t), /nuxt typecheck/);
  });
});

// A gate that exits 0 having checked nothing is reported, but only where it is genuinely vacuous.
describe('run-gates: typecheckVacuous', () => {
  const SOLUTION = { files: [], references: [{ path: './.nuxt/tsconfig.app.json' }] };
  const vacuous = (t, nuxt, typecheck, tsconfig) =>
    gatesJson(t, project(t, { dependencies: { nuxt }, devDependencies: TYPED, scripts: { typecheck } }, tsconfig))
      .typecheckVacuous;

  test('a bare vue-tsc on a Nuxt solution tsconfig is vacuous', (t) => {
    assert.equal(vacuous(t, '^4', 'vue-tsc --noEmit', SOLUTION), true);
  });
  test('nuxt typecheck is not called vacuous', (t) => {
    assert.equal(vacuous(t, '^4', 'nuxt typecheck', SOLUTION), false);
  });
  test('build mode has inputs and is not called vacuous', (t) => {
    assert.equal(vacuous(t, '^4', 'vue-tsc -b --noEmit', SOLUTION), false);
  });
  test('an extends tsconfig gives vue-tsc inputs', (t) => {
    assert.equal(vacuous(t, '^3', 'vue-tsc --noEmit', { extends: './.nuxt/tsconfig.json' }), false);
  });
  // A JSONC tsconfig cannot be parsed, so the answer is unknown and stays silent.
  test('an unparseable tsconfig does not produce a warning', (t) => {
    const jsonc = '{\n  // generated\n  "files": [],\n  "references": []\n}';
    assert.equal(vacuous(t, '^3', 'vue-tsc --noEmit', jsonc), false);
  });
});
