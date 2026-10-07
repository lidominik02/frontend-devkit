// Every script must parse before any behaviour assertion means anything, and
// every file a hooks.json names must exist: a renamed file is a dead hook.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { REPO_ROOT, runScript, tempDir } from './helpers.mjs';
import { checkScripts } from '../validate.mjs';

const rel = (p) => path.relative(REPO_ROOT, p);

function mjsIn(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true })
    .filter((f) => f.endsWith('.mjs'))
    .map((f) => path.join(dir, f))
    .filter((p) => fs.statSync(p).isFile());
}

// The same two trees validate.mjs's scripts check walks, so both cover every .mjs.
const scripts = [...mjsIn(path.join(REPO_ROOT, 'plugins')), ...mjsIn(path.join(REPO_ROOT, 'scripts'))];

describe('parse', () => {
  test('finds scripts to check', () => {
    assert.ok(scripts.length > 0, 'no .mjs found');
  });

  for (const file of scripts) {
    test(`${rel(file)} parses`, () => {
      const res = spawnSync(process.execPath, ['--check', file], { cwd: REPO_ROOT, encoding: 'utf8' });
      if (res.error) throw res.error;
      assert.equal(res.status, 0, `syntax error in ${rel(file)}: ${res.stderr.trim()}`);
    });
  }

  // validate.mjs's scripts check is the one reading of every listed pack's hooks.json.
  test('every hooks.json is valid JSON and every arg names a file inside its own pack', () => {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, 'plugins', 'core', 'hooks', 'hooks.json')), 'no hooks.json to check');
    assert.deepEqual(checkScripts().findings, []);
  });

  test('runScript reports a syntax error as a syntax error, not a behaviour failure', (t) => {
    const dir = tempDir(t);
    const broken = path.join(dir, 'broken.mjs');
    fs.writeFileSync(broken, 'export const x = ;\n');
    assert.throws(() => runScript(broken, { cwd: dir }), {
      name: 'AssertionError',
      message: /^syntax error in .*broken\.mjs: /,
    });

    const blocking = path.join(dir, 'blocking.mjs');
    fs.writeFileSync(blocking, 'process.exit(2);\n');
    assert.equal(runScript(blocking, { cwd: dir }).code, 2);
  });
});
