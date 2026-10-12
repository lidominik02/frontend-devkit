// `node --test` runs files in parallel, so every helper that touches disk works in
// its own mkdtemp directory, never in the repository or the user's git index.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// The script gets the environment without GIT_*, as git() does, plus `env`.
export function runScript(file, { args = [], input = '', env = {}, cwd = REPO_ROOT } = {}) {
  const res = spawnSync(process.execPath, [file, ...args], {
    cwd,
    env: { ...gitEnv(), ...env },
    input,
    encoding: 'utf8',
  });
  if (res.error) throw res.error;
  return { code: res.status, stdout: res.stdout, stderr: res.stderr };
}

// On Windows a process stopped by taskkill releases its handle on its cwd a moment
// later, so a removal straight after it can fail with EBUSY; rmSync retries that.
export const RM_RETRY = { maxRetries: 10, retryDelay: 200 };

// realpath: on macOS the tmpdir is a symlink, and two spellings of a path compare unequal.
export function tempDir(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'devkit-test-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, ...RM_RETRY }));
  return dir;
}

// Inside a git hook, GIT_DIR and GIT_INDEX_FILE would point git at the caller's repository,
// both for the tests' own git calls and for the git a script under test spawns, so
// git() and runScript() both start from this environment.
function gitEnv() {
  return Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
}

/** Runs git in `dir`, fails the test on a non-zero exit, and returns stdout. */
export function git(dir, args) {
  const res = spawnSync('git', args, { cwd: dir, env: gitEnv(), encoding: 'utf8' });
  if (res.error) throw res.error;
  if (res.status !== 0) assert.fail(`git ${args.join(' ')} failed in ${dir}: ${res.stderr.trim()}`);
  return res.stdout;
}

/** Writes each file, relative to `root`, creating its directories. */
export function write(root, files) {
  for (const [rel, text] of Object.entries(files)) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text);
  }
}

export function gitRepo(t, { commit = false } = {}) {
  const dir = tempDir(t);
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.name', 'Devkit Test']);
  git(dir, ['config', 'user.email', 'devkit-test@example.invalid']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  if (commit) git(dir, ['commit', '-q', '--allow-empty', '--no-verify', '-m', 'init']);
  return dir;
}
