// snapshot.mjs captures a working state as a tree without touching the user's index, and
// keeps temp/ and credential material out of every tree and diff it writes.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { REPO_ROOT, git, gitRepo, runScript, tempDir, write } from './helpers.mjs';

const SNAPSHOT = path.join(REPO_ROOT, 'plugins/core/scripts/snapshot.mjs');

// Inside a git hook, GIT_DIR and GIT_INDEX_FILE would point snapshot.mjs's git at the caller's repository.
const NO_GIT_ENV = Object.fromEntries(Object.keys(process.env).filter((k) => k.startsWith('GIT_')).map((k) => [k, undefined]));

const snapshot = (repo, args) => runScript(SNAPSHOT, { args, cwd: repo, env: NO_GIT_ENV });
const indexBytes = (repo) => fs.readFileSync(path.join(repo, '.git', 'index'));

// A commit with a credential file in it, then tracked, staged and untracked changes on top.
function workingRepo(t) {
  const repo = gitRepo(t);
  write(repo, { 'src/a.txt': 'a\n', 'src/b.txt': 'b\n', '.env': 'TOKEN=committed-secret\n' });
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '--no-verify', '-m', 'base']);
  write(repo, { 'src/a.txt': 'a changed\n', 'src/b.txt': 'b staged\n', 'src/c.txt': 'c untracked\n' });
  git(repo, ['add', 'src/b.txt']);
  return repo;
}

test('take and diff leave the index byte-identical', (t) => {
  const repo = workingRepo(t);
  const before = indexBytes(repo);

  const take = snapshot(repo, ['take']);
  assert.equal(take.code, 0, take.stderr);
  assert.match(take.stdout, /^[0-9a-f]{40,64}\n$/);
  assert.deepEqual(indexBytes(repo), before);

  const out = path.join(tempDir(t), 'snapshot.diff');
  const diff = snapshot(repo, ['diff', 'HEAD', '--out', out]);
  assert.equal(diff.code, 0, diff.stderr);
  assert.deepEqual(indexBytes(repo), before);
  assert.equal(fs.existsSync(path.join(repo, '.git', 'index.lock')), false);

  // The tree still holds every change, staged or not.
  const files = git(repo, ['ls-tree', '-r', '--name-only', take.stdout.trim()]).split('\n').filter(Boolean);
  assert.deepEqual(files, ['src/a.txt', 'src/b.txt', 'src/c.txt']);
});

test('temp/ and credential paths reach neither the tree nor the diff', (t) => {
  const repo = workingRepo(t);
  write(repo, {
    '.env': 'TOKEN=changed-secret\n',
    'temp/notes.md': 'temp-marker\n',
    'config/secrets/api.json': '{"key":"untracked-secret"}\n',
  });

  const take = snapshot(repo, ['take']);
  assert.equal(take.code, 0, take.stderr);
  const files = git(repo, ['ls-tree', '-r', '--name-only', take.stdout.trim()]).split('\n').filter(Boolean);
  assert.deepEqual(files, ['src/a.txt', 'src/b.txt', 'src/c.txt']);

  const out = path.join(tempDir(t), 'snapshot.diff');
  const diff = snapshot(repo, ['diff', 'HEAD', '--out', out]);
  assert.equal(diff.code, 0, diff.stderr);
  const text = fs.readFileSync(out, 'utf8');
  const cut = text.indexOf('\n\n');
  const header = text.slice(0, cut);
  const body = text.slice(cut + 2);
  assert.match(body, /src\/c\.txt/);
  for (const leaked of ['temp/', 'temp-marker', '.env', 'secrets/']) {
    assert.equal(body.includes(leaked), false, `the diff body contains ${leaked}`);
  }
  assert.doesNotMatch(text, /-secret/);
  // The header names each changed credential path, since the diff cannot show it.
  assert.match(header, /\nchanged credential paths left out of this diff: \.env, config\/secrets\/api\.json$/);
});

test('a failing required clean filter exits 1 with nothing on stdout', (t) => {
  const repo = workingRepo(t);
  git(repo, ['config', 'filter.broken.clean', 'exit 1']);
  git(repo, ['config', 'filter.broken.required', 'true']);
  write(repo, { '.gitattributes': '*.bin filter=broken\n', 'data.bin': 'payload\n' });
  const before = indexBytes(repo);

  const res = snapshot(repo, ['take']);
  assert.equal(res.code, 1);
  assert.equal(res.stdout, '');
  assert.match(res.stderr, /^snapshot: .*data\.bin/s);
  assert.deepEqual(indexBytes(repo), before);
});
