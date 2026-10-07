// run-gates keeps a broken build apart from a broken toolchain: a gate that
// failed found a defect in the code, a gate that could not run found one in the setup.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { REPO_ROOT, gitRepo, isolatedEnv, runScript, runScriptAsync, tempDir } from './helpers.mjs';

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
const gatesAsync = (t, dir, ...args) =>
  runScriptAsync(RUN_GATES, { args, env: { CLAUDE_PROJECT_DIR: dir, ...isolatedEnv(tempDir(t)) } });

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

  test('a missing binary is not-run, never fail, and blocking, with the shell saying why, and exits non-zero', (t) => {
    const res = gates(t, missingBinary(t), '--gate', 'typecheck', '--json');
    assert.equal(res.code, 1);
    const [r] = JSON.parse(res.stdout).results;
    assert.equal(r.status, 'not-run');
    assert.equal(r.blocking, true);
    assert.match(r.output, /definitely-not-installed-xyz/);
  });

  // The words alone prove nothing: a failing test can print them. Exit 127 on every OS, or a
  // stderr line starting with the shell's own wording on Windows, marks a missing binary.
  test('missing-binary wording is a fail, except the Windows wording at the start of a stderr line on Windows; exit 127 is not-run everywhere', async (t) => {
    const onWindows = (status) => (process.platform === 'win32' ? status : 'fail');
    const cmdLine = "'xyz' is not recognized as an internal or external command";
    const psLine = "The term 'xyz' is not recognized as the name of a cmdlet";
    // [stdout, stderr, exit code, expected status]
    const cases = [
      ['No such file or directory', '', 1, 'fail'],
      ['sh: 1: xyz: not found', '', 1, 'fail'],
      ['xyz: command not found', '', 1, 'fail'],
      [`${cmdLine}\n`, '', 1, 'fail'],
      ['', `${cmdLine}\n`, 1, onWindows('not-run')],
      ['', `TypeError: ${cmdLine}\n`, 1, 'fail'],
      ['', `${psLine}\n`, 1, onWindows('not-run')],
      ['', `xyz : ${psLine}\n`, 1, onWindows('not-run')],
      ['', `xyz: ${psLine}\n`, 1, onWindows('not-run')],
      [`${psLine}\n`, '', 1, 'fail'],
      // stdout with no trailing newline must not take the stderr line's start away.
      ['partial', `${cmdLine}\n`, 1, onWindows('not-run')],
      ['', 'sh: 1: xyz: not found\n', 127, 'not-run'],
      ['', '', 127, 'not-run'],
    ];
    const results = await Promise.all(
      cases.map(async ([stdout, stderr, code]) => {
        const dir = project(t, { scripts: { lint: 'node say.js' } });
        fs.writeFileSync(
          path.join(dir, 'say.js'),
          `process.stdout.write(${JSON.stringify(stdout)}); process.stderr.write(${JSON.stringify(stderr)}); process.exitCode = ${code};`,
        );
        const res = await gatesAsync(t, dir, '--gate', 'lint', '--json');
        return JSON.parse(res.stdout).results[0].status;
      }),
    );
    assert.deepEqual(results, cases.map(([, , , expected]) => expected));
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

  // Under spawnSync a timeout of 0 meant none; a 0 ms timer would time out every gate.
  test('--timeout 0 sets no per-gate timeout, so a passing gate passes', (t) => {
    assert.equal(gates(t, project(t, { scripts: { lint: PASS } }), '--gate', 'lint', '--timeout', '0').code, 0);
  });

  test('--budget 0 still leaves no time for a gate', (t) => {
    const [r] = gatesJson(t, project(t, { scripts: { lint: PASS } }), '--gate', 'lint', '--timeout', '0', '--budget', '0').results;
    assert.equal(r.status, 'not-run');
    assert.equal(r.reason, 'no time left in the budget');
  });

  // build is the slowest gate and guards the release, so only the release stage runs it.
  test('stage full does not include build', (t) => {
    assert.doesNotMatch(gates(t, project(t, { scripts: { build: PASS } }), '--list', '--stage', 'full').stdout, /build/);
  });

  test('stage release includes build', (t) => {
    assert.match(gates(t, project(t, { scripts: { build: PASS } }), '--list', '--stage', 'release').stdout, /build/);
  });
});

// A mistyped name that silently ran another stage, or no gate at all, would read as a pass.
describe('run-gates: a usage error exits 2 and runs no gate', { concurrency: true }, () => {
  const MARK = 'node -e "require(\'fs\').writeFileSync(\'ran\', \'\')"';
  const NAMES = /use one of: typecheck, lint, test, build, format$/;
  const cases = [
    [['--stage', 'nope'], /^unknown stage "nope"; use one of: fast, full, release$/],
    [['--gate', 'test:unit'], NAMES],
    [['--gate', 'tset'], NAMES],
    [['--stage'], /^--stage needs a value$/],
    [['--gate'], /^--gate needs a value$/],
    [['--stage', '--json'], /^--stage needs a value$/],
    [['--gate', '--list'], /^--gate needs a value$/],
    [['--list', '--stage', 'nope'], /^unknown stage "nope"/],
    [['--stag', 'full'], /^unknown flag "--stag"$/],
    [['--jsn'], /^unknown flag "--jsn"$/],
    [['--stage', 'fast', 'extra'], /^unexpected argument "extra"$/],
    [['lint'], /^unexpected argument "lint"$/],
    // Only one occurrence is read, so a second one must not be silently ignored.
    [['--list', '--stage', 'full', '--stage', 'nope'], /^--stage given more than once$/],
    [['--list', '--stage', 'fast', '--stage'], /^--stage given more than once$/],
    [['--list', '--gate', 'lint', '--gate', 'tset'], /^--gate given more than once$/],
    [['--gate', 'lint', '--timeout', '1000', '--timeout', '2000'], /^--timeout given more than once$/],
    // setTimeout turns NaN or anything above 2^31-1 into 1 ms, which timed out every gate.
    [['--gate', 'lint', '--budget', '3m'], /^--budget .*"3m"$/],
    [['--gate', 'lint', '--timeout', 'abc'], /^--timeout .*"abc"$/],
    [['--gate', 'lint', '--timeout', '3000000000'], /^--timeout .*"3000000000"$/],
  ];
  for (const [args, message] of cases) {
    test(`${args.join(' ')}: plain and under --json`, async (t) => {
      const dir = project(t, { scripts: { typecheck: MARK, lint: MARK, test: MARK, build: MARK, format: MARK } });
      const withJson = args.includes('--json') ? args : [...args, '--json'];
      const [plain, json] = await Promise.all([
        args.includes('--json') ? null : gatesAsync(t, dir, ...args),
        gatesAsync(t, dir, ...withJson),
      ]);
      if (plain) {
        assert.equal(plain.code, 2);
        assert.equal(plain.stdout, '');
        assert.ok(plain.stderr.startsWith('run-gates: '), plain.stderr);
        assert.match(plain.stderr.slice('run-gates: '.length).trimEnd(), message);
      }
      assert.equal(json.code, 2);
      const report = JSON.parse(json.stdout);
      assert.deepEqual(Object.keys(report), ['passed', 'usageError']);
      assert.equal(report.passed, false);
      assert.match(report.usageError, message);
      assert.equal(json.stderr, `run-gates: ${report.usageError}\n`);
      assert.equal(fs.existsSync(path.join(dir, 'ran')), false, 'a gate ran');
    });
  }

  test('every flag the plugins pass is still accepted', async (t) => {
    const dir = project(t, { scripts: { lint: PASS, test: PASS } });
    const patterns = [
      ['--list', '--stage', 'fast'],
      ['--stage', 'fast', '--json', '--budget', '60000'],
      ['--gate', 'test', '--json'],
      ['--stage', 'full', '--timeout', '0', '--list', '--json'],
    ];
    const runs = await Promise.all(patterns.map((args) => gatesAsync(t, dir, ...args)));
    runs.forEach((res, i) => assert.ok(res.code === 0 || res.code === 1, `${patterns[i].join(' ')}: exit ${res.code}`));
  });

  test('a canonical gate outside every stage is not a usage error', async (t) => {
    const res = await gatesAsync(t, project(t, { scripts: { format: PASS } }), '--gate', 'format');
    assert.equal(res.code, 0);
  });
});

// The Stop hook and every skill act on what a failing gate said, so it must reach them,
// bounded, and in the order a terminal would have shown it.
describe('run-gates: a gate\'s output reaches every caller', { concurrency: true }, () => {
  // No `<`, `>`, `&` or `|`: cmd.exe would read them as redirection, a separator or a pipe.
  // process.exitCode, not process.exit(): exiting would cut the gate's own piped output short.
  const HUNDRED_LINES = "node -e \"for (var i = 1; i !== 101; i++) console.log('line ' + i); process.exitCode = 1\"";
  const LONG_LINE = "node -e \"process.stdout.write('y'.repeat(10000)); process.exitCode = 1\"";
  const OVER_64_KIB = "node -e \"process.stdout.write('z'.repeat(100000) + '\\n'); process.exitCode = 1\"";
  // The writes are 30 ms apart, so each is read before the next arrives.
  const INTERLEAVED =
    "node -e \"var w = [[1, 'o1'], [2, 'e1'], [1, 'o2'], [2, 'e2']]; (function next(i) { " +
    "if (i === w.length) { process.exitCode = 1; return; } require('fs').writeSync(w[i][0], w[i][1] + '\\n'); " +
    'setTimeout(next, 30, i + 1); })(0)"';
  const run = (t, scripts, ...args) => gatesAsync(t, project(t, { scripts }), ...args);

  test('a failing gate carries its last 60 lines; a pass and a gate that never started carry none', async (t) => {
    const res = await run(t, { lint: PASS, test: HUNDRED_LINES }, '--stage', 'full', '--json');
    const byName = Object.fromEntries(JSON.parse(res.stdout).results.map((r) => [r.name, r]));
    assert.equal(byName.test.status, 'fail');
    assert.equal(byName.test.output.split('\n').length, 60);
    assert.match(byName.test.output, /^line 100\r?$/m);
    assert.doesNotMatch(byName.test.output, /^line 40\r?$/m);
    assert.equal(byName.lint.status, 'pass');
    assert.equal('output' in byName.lint, false);
    assert.equal(byName.typecheck.status, 'not-run');
    assert.equal('output' in byName.typecheck, false);
  });

  // An empty `output` would read as a gate that ran and printed nothing.
  test('a gate whose shell could not be spawned carries no output', async (t) => {
    if (process.platform === 'win32') {
      return t.skip('Windows refuses to delete a directory a running process has as its cwd');
    }
    // typecheck runs first and deletes the project directory, so lint's spawn has no cwd.
    const removeProject = "node -e \"require('fs').rmSync(process.cwd(), { recursive: true })\"";
    const res = await run(t, { typecheck: removeProject, lint: PASS }, '--json');
    const lint = JSON.parse(res.stdout).results.find((r) => r.name === 'lint');
    assert.equal(lint.status, 'not-run');
    assert.match(lint.reason, /^could not execute/);
    assert.equal('output' in lint, false);
  });

  test('a single long line is cut to its last 4000 characters', async (t) => {
    const [r] = JSON.parse((await run(t, { test: LONG_LINE }, '--gate', 'test', '--json')).stdout).results;
    assert.equal(r.status, 'fail');
    assert.equal(r.output.length, 4000);
  });

  test('stdout and stderr keep their arrival order, in the output field and on screen', async (t) => {
    const [json, plain] = await Promise.all([
      run(t, { test: INTERLEAVED }, '--gate', 'test', '--json'),
      run(t, { test: INTERLEAVED }, '--gate', 'test'),
    ]);
    const order = /o1\r?\ne1\r?\no2\r?\ne2/;
    assert.match(JSON.parse(json.stdout).results[0].output, order);
    assert.match(plain.stdout, order);
  });

  // stdout on a pipe can still be draining when the script ends, and exiting
  // outright dropped everything past the first 64 KiB, the summary included.
  test('over 64 KiB of gate output reaches a pipe whole, summary included', async (t) => {
    const res = await run(t, { test: OVER_64_KIB }, '--gate', 'test');
    assert.equal(res.code, 1);
    assert.match(res.stdout, /z{100000}/);
    assert.match(res.stdout, /^Summary: 0 passed, 1 failed, 0 not run$/m);
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
describe('run-gates: typecheckVacuous', { concurrency: true }, () => {
  const SOLUTION = { files: [], references: [{ path: './.nuxt/tsconfig.app.json' }] };
  const MARKER = 'checked-something.txt';
  // The script writes MARKER when it runs, so a gate that was not executed leaves no file.
  const WRITES = (compiler) => `node -e "require('fs').writeFileSync('${MARKER}','x')" && ${compiler}`;
  const fixture = (t, nuxt, compiler, tsconfig) =>
    project(t, { dependencies: { nuxt }, devDependencies: TYPED, scripts: { typecheck: WRITES(compiler) } }, tsconfig);
  const runJson = async (t, dir, ...args) => {
    const out = await gatesAsync(t, dir, ...args, '--json');
    const report = JSON.parse(out.stdout);
    return { report, code: out.code, gate: report.results.find((r) => r.name === 'typecheck'), ran: fs.existsSync(path.join(dir, MARKER)) };
  };
  const run = (t, nuxt, compiler, tsconfig) => runJson(t, fixture(t, nuxt, compiler, tsconfig));
  // `vue-tsc` is not installed in the fixture, so a gate that does run exits non-zero.
  const notExecuted = (r) => !r.ran && r.gate.status === 'not-run' && r.gate.blocking === true;

  test('a bare vue-tsc on a Nuxt solution tsconfig is vacuous, does not run, and the printed text says NOT RUN', async (t) => {
    const dir = fixture(t, '^4', 'vue-tsc --noEmit', SOLUTION);
    const [r, { stdout }] = await Promise.all([runJson(t, dir), gatesAsync(t, dir, '--gate', 'typecheck')]);
    assert.equal(r.report.typecheckVacuous, true);
    assert.ok(notExecuted(r));
    assert.match(r.gate.reason, /nuxt typecheck/);
    assert.equal(r.report.passed, false);
    assert.equal(r.code, 1);
    assert.match(stdout, /NOT RUN {2}typecheck/);
    assert.match(stdout, /NOT RUN and/);
    assert.doesNotMatch(stdout, /reports "pass"/);
  });
  test('nuxt typecheck is not called vacuous and runs', async (t) => {
    const r = await run(t, '^4', 'nuxt typecheck', SOLUTION);
    assert.equal(r.report.typecheckVacuous, false);
    assert.ok(r.ran);
  });
  test('build mode has inputs, is not called vacuous and runs', async (t) => {
    const r = await run(t, '^4', 'vue-tsc -b --noEmit', SOLUTION);
    assert.equal(r.report.typecheckVacuous, false);
    assert.ok(r.ran);
  });
  test('an extends tsconfig gives vue-tsc inputs, so the gate runs', async (t) => {
    const r = await run(t, '^3', 'vue-tsc --noEmit', { extends: './.nuxt/tsconfig.json' });
    assert.equal(r.report.typecheckVacuous, false);
    assert.ok(r.ran);
  });
  // A JSONC tsconfig cannot be parsed, so the answer is unknown and the gate runs.
  test('an unparseable tsconfig does not block the gate', async (t) => {
    const jsonc = '{\n  // generated\n  "files": [],\n  "references": []\n}';
    const r = await run(t, '^3', 'vue-tsc --noEmit', jsonc);
    assert.equal(r.report.typecheckVacuous, false);
    assert.ok(r.ran);
  });
  test('--gate lint leaves every result alone and typecheckVacuous false', async (t) => {
    const dir = project(t, { dependencies: { nuxt: '^4' }, devDependencies: TYPED, scripts: { typecheck: 'vue-tsc --noEmit', lint: PASS } }, SOLUTION);
    const report = JSON.parse((await gatesAsync(t, dir, '--gate', 'lint', '--json')).stdout);
    assert.equal(report.typecheckVacuous, false);
    assert.deepEqual(report.results.map((r) => [r.name, r.status]), [['lint', 'pass']]);
    assert.equal(report.passed, true);
  });
});

// A gate that rewrites what it checks passes on its own edits, so a fixer is never run.
// Its not-run is not blocking: the script is not broken, and create-vue's default `lint` fixes.
describe('run-gates: a fixer is never run as a gate', { concurrency: true }, () => {
  const SOURCE = 'const a = 1\n';
  // A stand-in fixer that really rewrites src.js, so an executed gate leaves a trace.
  const FIXER_JS = "require('fs').writeFileSync('src.js', 'fixed\\n');";
  const run = async (t, scripts, ...args) => {
    const dir = project(t, { scripts });
    fs.writeFileSync(path.join(dir, 'src.js'), SOURCE);
    fs.writeFileSync(path.join(dir, 'fix.js'), FIXER_JS);
    fs.writeFileSync(path.join(dir, 'check.js'), 'process.exitCode = 0;');
    const res = await gatesAsync(t, dir, ...args, '--json');
    const report = JSON.parse(res.stdout);
    return {
      code: res.code,
      report,
      byName: Object.fromEntries(report.results.map((r) => [r.name, r])),
      src: fs.readFileSync(path.join(dir, 'src.js'), 'utf8'),
    };
  };
  const refused = (r) => r.status === 'not-run' && r.blocking === false && /rewrites files/.test(r.reason);

  test('create-vue\'s eslint --fix is not run, its reason is the package.json fix, and the run passes', async (t) => {
    const r = await run(t, { typecheck: PASS, lint: 'eslint . --fix --cache' });
    assert.ok(refused(r.byName.lint), JSON.stringify(r.byName.lint));
    assert.match(r.byName.lint.reason, /--fix/);
    assert.match(r.byName.lint.reason, /package\.json, make this script check only/);
    assert.match(r.byName.lint.reason, /"lint:fix"/);
    assert.doesNotMatch(r.byName.lint.reason, /project\.json/);
    assert.equal(r.byName.typecheck.status, 'pass');
    assert.equal(r.report.passed, true);
    assert.equal(r.code, 0);
  });

  test('a fixer gate leaves the files it would rewrite unchanged', async (t) => {
    const r = await run(t, { lint: 'node fix.js --fix' }, '--gate', 'lint');
    assert.ok(refused(r.byName.lint));
    assert.equal(r.src, SOURCE);
  });

  test('passed and the exit code follow the other gates', async (t) => {
    const r = await run(t, { typecheck: FAIL, lint: 'node fix.js --fix' });
    assert.ok(refused(r.byName.lint));
    assert.equal(r.byName.typecheck.status, 'fail');
    assert.equal(r.report.passed, false);
    assert.equal(r.code, 1);
  });

  test('create-vue\'s oxlint run-s "lint:*" chain is followed one level down', async (t) => {
    const r = await run(t, { lint: 'run-s "lint:*"', 'lint:oxlint': 'oxlint . --fix', 'lint:eslint': 'eslint . --fix --cache' }, '--gate', 'lint');
    assert.ok(refused(r.byName.lint));
    assert.match(r.byName.lint.reason, /"lint:oxlint" script/);
  });

  test('run-p, npm-run-all and a ** pattern are followed too', async (t) => {
    const runs = await Promise.all([
      run(t, { lint: 'run-p lint:*', 'lint:fmt': 'node fix.js --write' }, '--gate', 'lint'),
      run(t, { lint: 'npm-run-all --parallel "lint:*"', 'lint:biome': 'node fix.js --apply' }, '--gate', 'lint'),
      run(t, { lint: 'run-s "lint:**"', 'lint:a:b': 'node fix.js --fix' }, '--gate', 'lint'),
    ]);
    for (const r of runs) {
      assert.ok(refused(r.byName.lint), JSON.stringify(r.byName.lint));
      assert.equal(r.src, SOURCE);
    }
  });

  test('a single * does not cross a ":" segment', async (t) => {
    const r = await run(t, { lint: 'run-s "lint:*"', 'lint:a': PASS, 'lint:a:fix': 'node fix.js --fix' }, '--gate', 'lint');
    assert.equal(refused(r.byName.lint), false);
  });

  test('biome check --write is not run', async (t) => {
    const r = await run(t, { lint: 'biome check --write .' }, '--gate', 'lint');
    assert.ok(refused(r.byName.lint));
    assert.match(r.byName.lint.reason, /--write/);
  });

  test('npm run, pnpm and yarn delegation is followed', async (t) => {
    const runs = await Promise.all(
      ['npm run lint:eslint', 'pnpm lint:eslint', 'pnpm run lint:eslint', 'yarn lint:eslint', 'yarn run lint:eslint'].map((lint) =>
        run(t, { lint, 'lint:eslint': 'node fix.js --fix' }, '--gate', 'lint')),
    );
    for (const r of runs) {
      assert.ok(refused(r.byName.lint), JSON.stringify(r.byName.lint));
      assert.match(r.byName.lint.reason, /"lint:eslint" script/);
      assert.equal(r.src, SOURCE);
    }
  });

  test('--fix-dry-run and a longer flag are not fixers, and a chain with no fixer runs', async (t) => {
    const [dryRun, longer, chain] = await Promise.all([
      run(t, { lint: 'node check.js --fix-dry-run' }, '--gate', 'lint'),
      run(t, { lint: 'node check.js --fixtures' }, '--gate', 'lint'),
      run(t, { lint: 'npm run lint:check', 'lint:check': PASS }, '--gate', 'lint'),
    ]);
    assert.equal(dryRun.byName.lint.status, 'pass');
    assert.equal(longer.byName.lint.status, 'pass');
    assert.equal(chain.byName.lint.status, 'pass');
  });

  test('--gate format with prettier --write is not run', async (t) => {
    const r = await run(t, { format: 'prettier --write src/' }, '--gate', 'format');
    assert.ok(refused(r.byName.format));
    assert.equal(r.report.passed, true);
    assert.equal(r.code, 0);
  });

  test('an unparseable package.json does not break the run', async (t) => {
    const dir = gitRepo(t);
    fs.writeFileSync(path.join(dir, 'package.json'), '{ "scripts": { "lint": "eslint --fix" ');
    const res = await gatesAsync(t, dir, '--json');
    assert.equal(res.code, 0, res.stderr);
    assert.ok(JSON.parse(res.stdout).results.every((r) => r.status === 'not-run' && r.blocking === false));
  });
});
