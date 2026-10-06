// `node --test` runs files in parallel, so every helper that touches disk works in
// its own mkdtemp directory, never in the repository or the user's git index.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const rel = (p) => path.relative(REPO_ROOT, p) || p;

// A syntax error and a deliberate block can share an exit code, so the parse
// check runs first and fails with its own message.
export function runScript(file, { args = [], input = '', env = {}, cwd = REPO_ROOT } = {}) {
  const check = spawnSync(process.execPath, ['--check', file], { cwd, encoding: 'utf8' });
  if (check.error) throw check.error;
  if (check.status !== 0) assert.fail(`syntax error in ${rel(file)}: ${check.stderr.trim()}`);

  const res = spawnSync(process.execPath, [file, ...args], {
    cwd,
    env: { ...process.env, ...env },
    input,
    encoding: 'utf8',
  });
  if (res.error) throw res.error;
  return { code: res.status, stdout: res.stdout, stderr: res.stderr };
}

export function hookEvent(toolName, toolInput, extra = {}) {
  return JSON.stringify({ tool_name: toolName, tool_input: toolInput, ...extra });
}

// realpath: on macOS the tmpdir is a symlink, and two spellings of a path compare unequal.
export function tempDir(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'devkit-test-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// Inside a git hook, GIT_DIR and GIT_INDEX_FILE would point git at the caller's repository.
function gitEnv() {
  return Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
}

function git(dir, args) {
  const res = spawnSync('git', args, { cwd: dir, env: gitEnv(), encoding: 'utf8' });
  if (res.error) throw res.error;
  if (res.status !== 0) assert.fail(`git ${args.join(' ')} failed in ${dir}: ${res.stderr.trim()}`);
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

// os.tmpdir() reads TMPDIR on POSIX and TMP/TEMP on Windows, so all three move together.
// A spawned npm writes a debug log to ~/.npm and a compile cache to the tmpdir.
export function isolatedEnv(dir) {
  return {
    TMPDIR: dir,
    TMP: dir,
    TEMP: dir,
    npm_config_cache: path.join(dir, 'npm-cache'),
    npm_config_logs_dir: path.join(dir, 'npm-logs'),
    NODE_DISABLE_COMPILE_CACHE: '1',
  };
}
