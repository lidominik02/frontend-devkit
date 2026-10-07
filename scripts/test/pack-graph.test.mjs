// pack-graph.mjs derives the pack layering from the manifests. It must read any
// marketplace root it is given, and print `/` paths on every OS.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { pathToFileURL } from 'node:url';

import { REPO_ROOT, runScript, tempDir, write } from './helpers.mjs';
import { families, packs } from '../pack-graph.mjs';

// core is the floor; base specialises nothing; spec specialises base.
function marketplace(t) {
  const root = tempDir(t);
  const plugins = [
    { name: 'core', deps: [] },
    { name: 'base', deps: ['core'], skill: 'base-engineering', refs: ['review-checklist.md', 'routing.md'] },
    { name: 'spec', deps: ['core', 'base'], skill: 'spec-engineering', refs: ['spec-review-checklist.md', 'server.md'] },
  ];
  write(root, {
    '.claude-plugin/marketplace.json': JSON.stringify({
      plugins: plugins.map((p) => ({ name: p.name, source: `./plugins/${p.name}` })),
    }),
  });
  for (const p of plugins) {
    write(root, {
      [`plugins/${p.name}/.claude-plugin/plugin.json`]: JSON.stringify({
        name: p.name,
        dependencies: p.deps.map((name) => ({ name })),
      }),
    });
    if (p.skill) {
      write(root, { [`plugins/${p.name}/skills/${p.skill}/SKILL.md`]: '---\nname: x\n---\n' });
      for (const ref of p.refs) write(root, { [`plugins/${p.name}/skills/${p.skill}/references/${ref}`]: '# x\n' });
    }
  }
  return root;
}

describe('pack-graph.mjs', () => {
  test('packs() reads the marketplace at the root it is given', (t) => {
    const all = packs(marketplace(t));
    assert.deepEqual(
      all.map(({ name, deps, base, dir }) => ({ name, deps, base, dir })),
      [
        { name: 'core', deps: [], base: null, dir: 'plugins/core' },
        { name: 'base', deps: ['core'], base: null, dir: 'plugins/base' },
        { name: 'spec', deps: ['core', 'base'], base: 'base', dir: 'plugins/spec' },
      ],
    );
    assert.deepEqual(all[2].skills, [
      { name: 'spec-engineering', refs: ['server.md', 'spec-review-checklist.md'], dir: 'plugins/spec/skills/spec-engineering' },
    ]);
    assert.deepEqual(families(all).map((f) => [f.base.name, f.specialisation.name]), [['base', 'spec']]);
  });

  // The script derives its root from its own location, so a copy runs against the fixture.
  function copy(t) {
    const root = marketplace(t);
    const script = path.join(root, 'scripts', 'pack-graph.mjs');
    fs.mkdirSync(path.dirname(script), { recursive: true });
    fs.copyFileSync(path.join(REPO_ROOT, 'scripts', 'pack-graph.mjs'), script);
    return { root, script };
  }

  function cli(t, args = []) {
    const { root, script } = copy(t);
    const res = runScript(script, { args, cwd: root });
    assert.equal(res.code, 0, `stderr: ${res.stderr.trim()}`);
    return res.stdout;
  }

  test('runs when started through a symlink', (t) => {
    const { root, script } = copy(t);
    const link = path.join(tempDir(t), 'pack-graph-link.mjs');
    try {
      fs.symlinkSync(script, link);
    } catch (e) {
      if (e.code === 'EPERM') return t.skip('creating a symlink needs a privilege this account lacks');
      throw e;
    }
    const res = runScript(link, { cwd: root });
    assert.equal(res.code, 0, `stderr: ${res.stderr.trim()}`);
    assert.match(res.stdout, /^packs\n {2}core /);
  });

  test('the printed report uses / in every path', (t) => {
    const out = cli(t);
    assert.match(out, /^ {2}plugins\/base\/skills\/base-engineering {2}\(2 refs\)$/m);
    assert.match(out, /^ {2}plugins\/spec\/skills\/spec-engineering {2}\(2 refs\)$/m);
    assert.match(out, /review-checklist\.md +base: review-checklist\.md {3}spec: spec-review-checklist\.md/);
    assert.ok(!out.includes('\\'), out);
  });

  test('the --json report uses / in every path', (t) => {
    const out = JSON.parse(cli(t, ['--json']));
    const dirs = [
      ...out.packs.flatMap((p) => [p.dir, ...p.skills.map((s) => s.dir)]),
      ...out.families.flatMap((f) => [f.references.baseSkill.dir, f.references.specSkill.dir]),
    ];
    assert.deepEqual(dirs, [
      'plugins/core',
      'plugins/base',
      'plugins/base/skills/base-engineering',
      'plugins/spec',
      'plugins/spec/skills/spec-engineering',
      'plugins/base/skills/base-engineering',
      'plugins/spec/skills/spec-engineering',
    ]);
  });
});

// A Node before 22.18 leaves import.meta.main undefined; the CI matrix never runs one, so the
// guard is driven with each value it can receive.
describe('runAsEntry: the entry guard of the devkit scripts', () => {
  const guard = (main) => {
    const url = pathToFileURL(path.join(REPO_ROOT, 'scripts', 'pack-graph.mjs')).href;
    const code = `import { runAsEntry } from ${JSON.stringify(url)};\n` +
      `runAsEntry(${main}, () => console.log('cli ran'), 'demo.mjs');\nconsole.log('returned');\n`;
    const res = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
    if (res.error) throw res.error;
    return { code: res.status, stdout: res.stdout, stderr: res.stderr };
  };

  test('undefined exits 1 naming the script and the Node it needs, running nothing', () => {
    const res = guard('undefined');
    assert.equal(res.code, 1);
    assert.equal(res.stdout, '');
    assert.match(res.stderr, /^demo\.mjs requires Node 22\.18\+ or 24\.2\+, this is Node \d+\.\d+\.\d+\.\n$/);
  });

  test('true runs the command line', () => {
    assert.deepEqual(guard('true'), { code: 0, stdout: 'cli ran\nreturned\n', stderr: '' });
  });

  test('false, an import, runs nothing', () => {
    assert.deepEqual(guard('false'), { code: 0, stdout: 'returned\n', stderr: '' });
  });

  for (const [rel, name] of [['scripts/validate.mjs', 'validate.mjs'], ['scripts/pack-graph.mjs', 'pack-graph.mjs'], ['scripts/ci/release-notes.mjs', 'release-notes.mjs']]) {
    test(`${rel} starts through the guard`, () => {
      const source = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
      assert.match(source, new RegExp(`^runAsEntry\\(import\\.meta\\.main, cli, '${name.replace('.', '\\.')}'\\);$`, 'm'));
    });
  }
});
