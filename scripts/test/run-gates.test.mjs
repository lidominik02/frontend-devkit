// run-gates keeps a broken build apart from a broken toolchain: a gate that
// failed found a defect in the code, a gate that could not run found one in the setup.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { REPO_ROOT, gitRepo, isolatedEnv, runScript, tempDir } from './helpers.mjs';

const RUN_GATES = path.join(REPO_ROOT, 'plugins', 'core', 'scripts', 'run-gates.mjs');

const PASS = 'node -e "process.exit(0)"';
const FAIL = 'node -e "process.exit(1)"';
const HANG = 'node -e "setTimeout(function () {}, 30000)"';
// No `>` or `&`: cmd.exe would read them as redirection and a command separator.
const HANG_WITH_GRANDCHILD =
  "node -e \"var c = require('child_process').spawn(process.execPath, ['-e', 'setTimeout(function () {}, 30000)'], { stdio: 'inherit' }); " +
  "require('fs').writeFileSync('grandchild.pid', String(c.pid)); setTimeout(function () {}, 30000)\"";

// A killed POSIX process stays a zombie until something reaps it, so liveness is polled briefly.
async function exited(pid) {
  for (let i = 0; i < 50; i++) {
    try {
      process.kill(pid, 0);
    } catch (err) {
      if (err.code === 'ESRCH') return true;
      throw err;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

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

  // The grandchild is the package manager's node, which a timeout that stopped only
  // the shell left running in the gate's cwd.
  test('a hanging gate times out as not-run, with its whole process tree stopped', async (t) => {
    const dir = project(t, { scripts: { test: HANG_WITH_GRANDCHILD } });
    const [r] = gatesJson(t, dir, '--gate', 'test', '--timeout', '3000').results;
    assert.equal(r.status, 'not-run');
    assert.match(r.reason, /timed out/);
    const pidFile = path.join(dir, 'grandchild.pid');
    assert.ok(fs.existsSync(pidFile), 'the gate did not start its grandchild before the timeout');
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    assert.equal(await exited(pid), true, `grandchild ${pid} is still running`);
    fs.rmSync(dir, { recursive: true });
  });

  test('a budget stops the run, and the gates after it are not-run', (t) => {
    const dir = project(t, { scripts: { lint: HANG, test: HANG } });
    const [first, second] = gatesJson(t, dir, '--stage', 'full', '--timeout', '60000', '--budget', '2500').results
      .filter((r) => r.name !== 'typecheck');
    assert.equal(first.status, 'not-run');
    assert.match(first.reason, /timed out/);
    assert.equal(second.status, 'not-run');
    assert.equal(second.reason, 'no time left in the budget');
    assert.equal(second.blocking, true);
  });

  // On POSIX the gate leads its own process group, so neither a terminal's Ctrl-C nor
  // a SIGTERM sent to run-gates alone reaches it.
  test('a SIGTERM to run-gates stops the gate in flight with its whole tree, and exits 143', async (t) => {
    if (process.platform === 'win32') {
      return t.skip('Windows has no catchable SIGTERM: kill() there ends the process outright');
    }
    const dir = project(t, { scripts: { test: HANG_WITH_GRANDCHILD } });
    const child = spawn(process.execPath, [RUN_GATES, '--gate', 'test', '--json'], {
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir, ...isolatedEnv(tempDir(t)) },
      stdio: 'ignore',
    });
    const closed = new Promise((done) => child.on('close', (code, signal) => done({ code, signal })));
    const pidFile = path.join(dir, 'grandchild.pid');
    for (let i = 0; i < 100 && !fs.existsSync(pidFile); i++) await new Promise((r) => setTimeout(r, 100));
    if (!fs.existsSync(pidFile)) {
      child.kill('SIGKILL');
      assert.fail('the gate did not start its grandchild');
    }
    // The file can exist before its content is written.
    let pid = NaN;
    for (let i = 0; i < 20 && !(pid > 0); i++) {
      pid = Number(fs.readFileSync(pidFile, 'utf8'));
      if (!(pid > 0)) await new Promise((r) => setTimeout(r, 50));
    }
    child.kill('SIGTERM');
    assert.deepEqual(await closed, { code: 143, signal: null });
    assert.equal(await exited(pid), true, `grandchild ${pid} is still running`);
  });

  // setTimeout turns NaN or anything above 2^31-1 into 1 ms, which timed out every gate.
  for (const [flag, value] of [['--budget', '3m'], ['--timeout', 'abc'], ['--timeout', '3000000000']]) {
    test(`${flag} ${value} is a usage error naming the flag, and runs no gate`, (t) => {
      const dir = project(t, { scripts: { lint: 'node -e "require(\'fs\').writeFileSync(\'ran\', \'\')"' } });
      const res = gates(t, dir, '--gate', 'lint', flag, value);
      assert.equal(res.code, 1);
      assert.match(res.stderr, new RegExp(`${flag}.*${value}`));
      assert.equal(res.stdout, '');
      assert.equal(fs.existsSync(path.join(dir, 'ran')), false);
    });
  }

  // Under spawnSync a timeout of 0 meant none; a 0 ms timer would time out every gate.
  test('--timeout 0 sets no per-gate timeout, so a passing gate passes', (t) => {
    assert.equal(gates(t, project(t, { scripts: { lint: PASS } }), '--gate', 'lint', '--timeout', '0').code, 0);
  });

  test('--budget 0 still leaves no time for a gate', (t) => {
    const [r] = gatesJson(t, project(t, { scripts: { lint: PASS } }), '--gate', 'lint', '--timeout', '0', '--budget', '0').results;
    assert.equal(r.status, 'not-run');
    assert.equal(r.reason, 'no time left in the budget');
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
