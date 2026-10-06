// format-on-write must never block, and must format only files that resolve
// inside the project, so the user's auto-memory is never rewritten.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { REPO_ROOT, hookEvent, runScript, tempDir } from './helpers.mjs';

const HOOK = path.join(REPO_ROOT, 'plugins', 'core', 'scripts', 'format-on-write.mjs');

const writeEvent = (file) => hookEvent('Write', { file_path: file });

describe('format-on-write: must never block, whatever it is given', () => {
  for (const [name, input] of [
    ['missing file', writeEvent('/nope/gone.ts')],
    ['empty payload', '{}'],
    ['garbage stdin', 'not json at all'],
  ]) {
    test(name, () => assert.equal(runScript(HOOK, { input }).code, 0));
  }
});

// A project with a fake prettier that logs its arguments, one per line, plus a
// directory outside it standing in for the user's auto-memory.
function fixture(t) {
  const root = tempDir(t);
  const proj = path.join(root, 'proj');
  const outside = path.join(root, 'memory');
  const log = path.join(root, 'formatted');
  const bin = path.join(proj, 'node_modules', '.bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(path.join(proj, 'src'));
  fs.mkdirSync(outside);

  const prettier = path.join(bin, 'prettier');
  fs.writeFileSync(
    prettier,
    '#!/usr/bin/env node\n' +
      `require('node:fs').appendFileSync(${JSON.stringify(log)}, process.argv.slice(2).map((a) => a + '\\n').join(''));\n`,
  );
  fs.chmodSync(prettier, 0o755);

  fs.writeFileSync(path.join(proj, 'src', 'a.ts'), 'x\n');
  fs.writeFileSync(path.join(outside, 'note.md'), 'x\n');

  const run = (projectDir, file) => {
    const res = runScript(HOOK, { input: writeEvent(file), env: { CLAUDE_PROJECT_DIR: projectDir } });
    assert.equal(res.code, 0, `stderr: ${res.stderr.trim()}`);
  };
  const formatted = (file) =>
    fs.existsSync(log) && fs.readFileSync(log, 'utf8').split(/\r?\n/).includes(file);

  return { root, proj, outside, run, formatted };
}

// Creating a file symlink on Windows needs a privilege a default account lacks.
function symlinkOrSkip(t, target, link, type) {
  try {
    fs.symlinkSync(target, link, type);
    return true;
  } catch (err) {
    if (err.code !== 'EPERM') throw err;
    t.skip('symlink needs privileges');
    return false;
  }
}

const WIN32_NO_SHIM =
  'format-on-write does not yet resolve or launch a .cmd shim on Windows ' +
  '(it spawns node_modules/.bin/prettier without a shell); remove this skip once it does';

function skipOnWin32(t) {
  if (process.platform !== 'win32') return false;
  t.skip(WIN32_NO_SHIM);
  return true;
}

describe('format-on-write: formats inside the project only, judged by resolved path', () => {
  test('a file inside the project is formatted', (t) => {
    if (skipOnWin32(t)) return;
    const { proj, run, formatted } = fixture(t);
    const file = path.join(proj, 'src', 'a.ts');
    run(proj, file);
    assert.ok(formatted(file));
  });

  test("a file outside the project, such as the user's auto-memory, is not formatted", (t) => {
    const { proj, outside, run, formatted } = fixture(t);
    const file = path.join(outside, 'note.md');
    run(proj, file);
    assert.ok(!formatted(file));
  });

  test('a symlink in the project that resolves outside it is not formatted', (t) => {
    const { proj, outside, run, formatted } = fixture(t);
    const link = path.join(proj, 'linked.md');
    if (!symlinkOrSkip(t, path.join(outside, 'note.md'), link, 'file')) return;
    run(proj, link);
    assert.ok(!formatted(link));
  });

  test('a project reached through a symlink is still formatted', (t) => {
    if (skipOnWin32(t)) return;
    const { root, proj, run, formatted } = fixture(t);
    const projLink = path.join(root, 'proj-link');
    if (!symlinkOrSkip(t, proj, projLink, 'junction')) return;
    const file = path.join(projLink, 'src', 'a.ts');
    run(projLink, file);
    assert.ok(formatted(file));
  });
});
