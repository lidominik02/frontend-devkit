// The Windows probes only run on Windows, but what they report is decided by pure functions,
// so a probe that misreads a missing binary is caught on every OS.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, test } from 'node:test';
import { pathToFileURL } from 'node:url';

import { REPO_ROOT, isolatedEnv, runScript, runScriptAsync, tempDir, write } from './helpers.mjs';
import { classification, findGitBash, summarize } from '../../.claude/skills/windows-check/scripts/probes.mjs';

const PROBES = path.join(REPO_ROOT, '.claude', 'skills', 'windows-check', 'scripts', 'probes.mjs');
const RUN_GATES = path.join(REPO_ROOT, 'plugins', 'core', 'scripts', 'run-gates.mjs');

describe('probes.mjs from the command line', () => {
  test('stops with exit 2 on any OS but Windows, naming it', { skip: process.platform === 'win32' && 'this is Windows' }, () => {
    const res = runScript(PROBES);
    assert.equal(res.code, 2);
    assert.match(res.stderr, new RegExp(`runs only on Windows; this is ${process.platform}`));
    assert.equal(res.stdout, '');
  });

  test('any argument is exit 2', () => {
    const res = runScript(PROBES, { args: ['--json'] });
    assert.equal(res.code, 2);
    assert.match(res.stderr, /unknown argument --json/);
  });
});

describe('classification reads the lint gate out of run-gates.mjs --json', () => {
  const gates = (...results) => JSON.stringify({ stage: 'fast', results, passed: false });

  // The reason comes from run-gates itself, so rewording it there cannot leave these tests green
  // while every real probe fails.
  test('a real missing binary, as run-gates classifies it here, is a pass', async (t) => {
    const dir = tempDir(t);
    write(dir, { 'package.json': JSON.stringify({ name: 'probe', private: true, scripts: { lint: 'devkit-windows-check-missing-binary --check' } }) });
    const res = await runScriptAsync(RUN_GATES, { args: ['--stage', 'fast', '--json'], cwd: dir, env: isolatedEnv(dir) });
    const c = classification(res.stdout);
    assert.equal(c.classification, 'not-run', res.stdout);
    const [row] = summarize({ probes: [{ name: 'here', available: true, exitCode: 127, ...c }] });
    assert.equal(row.result, 'pass', row.detail);
  });

  test('a failure in the code', () => {
    assert.deepEqual(classification(gates({ name: 'lint', command: 'npm run lint', status: 'fail', code: 1 })), { classification: 'fail', reason: null });
  });

  test('no JSON, or no lint gate, is unknown rather than a guess', () => {
    assert.equal(classification('npm ERR! something').classification, 'unknown');
    assert.equal(classification(gates({ name: 'typecheck', status: 'pass' })).classification, 'unknown');
  });

  test('a run-gates run that was killed or never started is not observed', () => {
    assert.deepEqual(classification('', { signal: 'SIGTERM' }), { classification: 'not-observed', reason: 'run-gates.mjs did not finish: killed by SIGTERM' });
    assert.equal(classification('', { error: new Error('spawnSync node ETIMEDOUT') }).reason, 'run-gates.mjs did not finish: spawnSync node ETIMEDOUT');
  });
});

describe('summarize', () => {
  const probe = (name, fields) => ({ name, shell: 'cmd.exe', packageManager: 'npm', available: true, exitCode: 1, stderr: '', classification: 'not-run', reason: 'the command is not installed here -- run the package manager install first', ...fields });

  test('a missing binary classified not installed passes; any other classification fails', () => {
    const rows = summarize({
      probes: [
        probe('cmd.exe'),
        probe('PowerShell 7 script shell', { classification: 'fail', reason: null }),
        probe('Yarn Berry', { reason: 'the package manager has no such script' }),
        probe('pnpm', { classification: 'unknown', reason: 'run-gates.mjs printed no JSON' }),
      ],
    });
    assert.deepEqual(rows.map((r) => r.result), ['pass', 'fail', 'fail', 'fail']);
    assert.equal(rows[1].detail, 'exit 1, classified fail');
  });

  // What was not observed is neither a pass nor a fail.
  test('an unavailable probe, or one whose run did not finish, is NOT RUN with its reason', () => {
    const rows = summarize({
      probes: [
        probe('Git Bash script shell', { available: false, exitCode: null, classification: null, reason: 'Git Bash not found' }),
        probe('pnpm', { classification: 'not-observed', reason: 'run-gates.mjs did not finish: killed by SIGTERM' }),
      ],
    });
    assert.deepEqual(rows, [
      { item: 'Git Bash script shell', result: 'NOT RUN', detail: 'Git Bash not found' },
      { item: 'pnpm', result: 'NOT RUN', detail: 'run-gates.mjs did not finish: killed by SIGTERM' },
    ]);
  });
});

describe('findGitBash', () => {
  const on = (...present) => (p) => present.includes(p);
  const BASH = 'C:\\Program Files\\Git\\bin\\bash.exe';

  test('from git.exe in <Git>\\cmd, <Git>\\bin or <Git>\\mingw64\\bin', () => {
    for (const git of ['C:\\Program Files\\Git\\cmd\\git.exe', 'C:\\Program Files\\Git\\bin\\git.exe', 'C:\\Program Files\\Git\\mingw64\\bin\\git.exe']) {
      assert.equal(findGitBash([git], [], on(BASH, 'C:\\Program Files\\Git\\git-bash.exe')), BASH, git);
    }
  });

  // MSYS2's bash would report its own behaviour under the Git Bash row.
  test('a bash.exe next to a git.exe outside a Git for Windows install is not Git Bash', () => {
    const msys = 'C:\\msys64\\usr\\bin\\bash.exe';
    assert.equal(findGitBash(['C:\\msys64\\usr\\bin\\git.exe'], [], on(msys)), null);
    assert.equal(findGitBash(['C:\\Program Files\\Git\\cmd\\git.exe'], [], on(BASH)), null, 'a Git root is recognised by git-bash.exe or cmd\\git.exe');
    assert.equal(findGitBash(['C:\\Program Files\\Git\\cmd\\git.exe'], [], on(BASH, 'C:\\Program Files\\Git\\cmd\\git.exe')), BASH);
  });

  test('behind a shim, from the bash.exe of a Git install, never from WSL', () => {
    const scoop = 'C:\\Users\\Dev\\scoop\\apps\\git\\current\\bin\\bash.exe';
    const wsl = 'C:\\Windows\\System32\\bash.exe';
    assert.equal(findGitBash(['C:\\Users\\Dev\\scoop\\shims\\git.exe'], [wsl, scoop], on(wsl, scoop)), scoop);
    assert.equal(findGitBash(['C:\\Users\\Dev\\scoop\\shims\\git.exe'], [wsl], on(wsl)), null);
  });
});

// The entry guard must not resolve argv[1] as a path: under `node -e` it is whatever follows.
for (const file of [PROBES, path.join(REPO_ROOT, '.claude', 'skills', 'try-unreleased', 'scripts', 'driver.mjs')]) {
  test(`${path.basename(file)} imports, without running, when argv[1] is not a path`, () => {
    const res = spawnSync(process.execPath, ['-e', `import(${JSON.stringify(pathToFileURL(file).href)}).then(() => console.log('imported'))`, 'notapath'], { encoding: 'utf8' });
    assert.equal(res.status, 0, res.stderr);
    assert.equal(res.stdout.trim(), 'imported');
  });
}
