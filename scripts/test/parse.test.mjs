// Every script must parse before any behaviour assertion means anything, and
// every file a hooks.json names must exist: a renamed file is a dead hook.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { REPO_ROOT, runScript, tempDir } from './helpers.mjs';

const rel = (p) => path.relative(REPO_ROOT, p);

const pluginDirs = fs
  .readdirSync(path.join(REPO_ROOT, 'plugins'), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => path.join(REPO_ROOT, 'plugins', e.name));

function mjsIn(dir, { recursive }) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive })
    .filter((f) => f.endsWith('.mjs'))
    .map((f) => path.join(dir, f))
    .filter((p) => fs.statSync(p).isFile());
}

const scripts = [
  ...pluginDirs.flatMap((d) => mjsIn(path.join(d, 'scripts'), { recursive: true })),
  ...mjsIn(path.join(REPO_ROOT, 'scripts'), { recursive: false }),
  ...mjsIn(path.join(REPO_ROOT, 'scripts', 'hooks'), { recursive: false }),
];

const hookConfigs = pluginDirs
  .map((d) => ({ pluginRoot: d, file: path.join(d, 'hooks', 'hooks.json') }))
  .filter(({ file }) => fs.existsSync(file));

describe('parse', () => {
  test('finds scripts and hook configs to check', () => {
    assert.ok(scripts.length > 0, 'no .mjs found');
    assert.ok(hookConfigs.length > 0, 'no plugins/*/hooks/hooks.json found');
  });

  for (const file of scripts) {
    test(`${rel(file)} parses`, () => {
      const res = spawnSync(process.execPath, ['--check', file], { cwd: REPO_ROOT, encoding: 'utf8' });
      if (res.error) throw res.error;
      assert.equal(res.status, 0, `syntax error in ${rel(file)}: ${res.stderr.trim()}`);
    });
  }

  for (const { pluginRoot, file } of hookConfigs) {
    test(`${rel(file)} is valid JSON and every arg names an existing file`, () => {
      const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
      const missing = [];
      for (const entries of Object.values(cfg.hooks ?? {})) {
        for (const entry of entries) {
          for (const hook of entry.hooks ?? []) {
            for (const arg of hook.args ?? []) {
              const substituted = String(arg).replaceAll('${CLAUDE_PLUGIN_ROOT}', pluginRoot);
              const resolved = path.resolve(pluginRoot, substituted.replace(/[\\/]/g, path.sep));
              if (!fs.existsSync(resolved)) missing.push(arg);
            }
          }
        }
      }
      assert.deepEqual(missing, [], `${rel(file)} names files that do not exist`);
    });
  }

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
