// The name lister exists so a credential file's variables can be seen without
// its values; these tests fail if any value reaches stdout or stderr.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { pathToFileURL } from 'node:url';

import { REPO_ROOT } from './helpers.mjs';

const SCRIPT = path.join(REPO_ROOT, 'plugins', 'core', 'scripts', 'env-names.mjs');
const { envNames } = await import(pathToFileURL(SCRIPT).href);

// Assembled at runtime so this file's own text never names credential material.
const DOTENV = '.' + 'env';
const SAMPLE = 'A=1\nexport B="x y"\n# C=3\n\nD\nA=2\n';

// Assembled at runtime so no key-shaped literal sits in the source.
const DASHES = '-'.repeat(5);
const PEM_BEGIN = `${DASHES}BEGIN ${['PRIVATE', 'KEY'].join(' ')}${DASHES}`;
const PEM_END = `${DASHES}END ${['PRIVATE', 'KEY'].join(' ')}${DASHES}`;
const PEM_BODY = ['MIIEv', 'QIBADANBgk', '=='].join('');

function tmpFile(name, content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-names-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, content);
  return file;
}

function run(args) {
  const env = { ...process.env };
  delete env.CLAUDE_PLUGIN_ROOT;
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env });
}

describe('env-names: envNames', () => {
  test('names in order, deduplicated, comments and bare words skipped', () =>
    assert.deepEqual(envNames(SAMPLE), ['A', 'B']));
  test('CRLF line endings', () => assert.deepEqual(envNames('A=1\r\nB=2\r\n'), ['A', 'B']));
  test('a multi-line double-quoted value hides its continuation lines', () =>
    assert.deepEqual(envNames('KEY="-----BEGIN-----\nabcDEF1234xyz0=\nZZ=1\n-----END-----"\nB=2\n'), ['KEY', 'B']));
  test('a multi-line single-quoted value hides its continuation lines', () =>
    assert.deepEqual(envNames("KEY='a\nabc=\nZZ=1'\nB=2\n"), ['KEY', 'B']));
  test('a multi-line backtick-quoted value hides its continuation lines', () =>
    assert.deepEqual(envNames('A=`line1\nsecretFrag99=\nend`\nB=2\n'), ['A', 'B']));
  test('an escaped quote does not close a double-quoted value', () =>
    assert.deepEqual(envNames('A="x\\"\nabc=\nZZ=1"\nB=2\n'), ['A', 'B']));
  test('a backslash does not escape inside single quotes', () =>
    assert.deepEqual(envNames("A='x\\'\nB=2\n"), ['A', 'B']));
  test('an export-prefixed multi-line value with CRLF', () =>
    assert.deepEqual(envNames('export K="a\r\nabc=\r\nend"\r\nB=2\r\n'), ['K', 'B']));
  test('an unterminated quote swallows the rest of the file', () =>
    assert.deepEqual(envNames('A="x\nabc=\nB=2\n'), ['A']));
  test('a left side that is not a name is skipped', () =>
    assert.deepEqual(envNames('some secret text = value\nOK=1\n'), ['OK']));
  test('an unquoted PEM block hides its body, whose base64 padding looks like NAME=', () =>
    assert.deepEqual(envNames(`KEY=${PEM_BEGIN}\n${PEM_BODY}\n${PEM_END}\nB=2\n`), ['KEY', 'B']));
  test('an unquoted PEM block without its end line swallows the rest of the file', () =>
    assert.deepEqual(envNames(`KEY=${PEM_BEGIN}\n${PEM_BODY}\nB=2\n`), ['KEY']));
  test('a one-line PEM value does not swallow the next lines', () =>
    assert.deepEqual(envNames(`KEY=${PEM_BEGIN} x ${PEM_END}\nB=2\n`), ['KEY', 'B']));
  // Documents the stated limit: dotenv has no unquoted multi-line values, so such a
  // continuation line cannot be told apart from a definition.
  test('a continuation line of another unquoted multi-line value is read as a definition', () =>
    assert.deepEqual(envNames('A=first line\nlooksLikeName=rest\nB=2\n'), ['A', 'looksLikeName', 'B']));
});

describe('env-names: CLI', () => {
  test('one file lists names, one per line, without values', () => {
    const res = run([tmpFile(DOTENV, SAMPLE)]);
    assert.equal(res.status, 0);
    assert.equal(res.stdout, 'A\nB\n');
    assert.equal(res.stderr, '');
  });

  test('no value reaches stdout or stderr, also for a missing file', () => {
    const file = tmpFile(DOTENV, 'TOKEN=hunter2secret\nOTHER="pa ss"\n');
    const res = run([file, `${file}.missing`]);
    const all = res.stdout + res.stderr;
    for (const value of ['hunter2secret', 'pa ss']) assert.ok(!all.includes(value), value);
    assert.match(res.stdout, /TOKEN\nOTHER\n/);
  });

  test('no fragment of a multi-line value reaches the output', () => {
    const res = run([tmpFile(DOTENV, 'KEY="-----BEGIN-----\nabcDEF1234xyz0=\n-----END-----"\nB=2\n')]);
    assert.equal(res.stdout, 'KEY\nB\n');
    assert.ok(!res.stdout.includes('abcDEF1234xyz0'));
  });

  test('no line of an unquoted PEM block reaches the output', () => {
    const res = run([tmpFile(DOTENV, `KEY=${PEM_BEGIN}\n${PEM_BODY}\n${PEM_END}\nB=2\n`)]);
    assert.equal(res.stdout, 'KEY\nB\n');
    assert.equal(res.stderr, '');
  });

  test('several files get a header each', () => {
    const a = tmpFile(DOTENV, 'X=1\n');
    const b = tmpFile(`${DOTENV}.local`, 'Y=2\n');
    const res = run([a, b]);
    assert.equal(res.status, 0);
    assert.equal(res.stdout, `${a}:\nX\n${b}:\nY\n`);
  });

  test('a missing file goes to stderr with exit 1; the others are still listed', () => {
    const a = tmpFile(DOTENV, 'X=1\n');
    const missing = path.join(path.dirname(a), `${DOTENV}.nope`);
    const res = run([missing, a]);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /nope/);
    assert.equal(res.stdout, `${a}:\nX\n`);
  });

  test('runs with Node alone, without CLAUDE_PLUGIN_ROOT', () => {
    const res = run([tmpFile(DOTENV, 'A=1\n')]);
    assert.equal(res.status, 0);
    assert.equal(res.stdout, 'A\n');
  });

  // A key's base64 lines can end in `=` and would print as names.
  test('a file not named like a dotenv file is refused unread, the others still listed', () => {
    const key = tmpFile('id_' + 'ed25519', `${PEM_BEGIN}\n${PEM_BODY}\n${PEM_END}\n`);
    const a = tmpFile(`${DOTENV}.Local`, 'X=1\n');
    const res = run([key, a]);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /refusing .*not a dotenv file name/);
    assert.ok(!(res.stdout + res.stderr).includes('MIIEv'));
    assert.equal(res.stdout, `${a}:\nX\n`);
  });

  test('a dotenv name in another letter case is accepted', () => {
    const res = run([tmpFile(DOTENV.toUpperCase(), 'A=1\n')]);
    assert.equal(res.status, 0);
    assert.equal(res.stdout, 'A\n');
  });
});
