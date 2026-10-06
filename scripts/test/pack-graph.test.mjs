// pack-graph.mjs derives the pack layering from the manifests. It must read any
// marketplace root it is given, and print `/` paths on every OS.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { REPO_ROOT, runScript, tempDir } from './helpers.mjs';
import { families, packs } from '../pack-graph.mjs';

function write(root, rel, text) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
}

// core is the floor; base specialises nothing; spec specialises base.
function marketplace(t) {
  const root = tempDir(t);
  const plugins = [
    { name: 'core', deps: [] },
    { name: 'base', deps: ['core'], skill: 'base-engineering', refs: ['review-checklist.md', 'routing.md'] },
    { name: 'spec', deps: ['core', 'base'], skill: 'spec-engineering', refs: ['spec-review-checklist.md', 'server.md'] },
  ];
  write(root, '.claude-plugin/marketplace.json', JSON.stringify({
    plugins: plugins.map((p) => ({ name: p.name, source: `./plugins/${p.name}` })),
  }));
  for (const p of plugins) {
    write(root, `plugins/${p.name}/.claude-plugin/plugin.json`, JSON.stringify({
      name: p.name,
      dependencies: p.deps.map((name) => ({ name })),
    }));
    if (p.skill) {
      write(root, `plugins/${p.name}/skills/${p.skill}/SKILL.md`, '---\nname: x\n---\n');
      for (const ref of p.refs) write(root, `plugins/${p.name}/skills/${p.skill}/references/${ref}`, '# x\n');
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
  function cli(t, args = []) {
    const root = marketplace(t);
    const script = path.join(root, 'scripts', 'pack-graph.mjs');
    fs.mkdirSync(path.dirname(script), { recursive: true });
    fs.copyFileSync(path.join(REPO_ROOT, 'scripts', 'pack-graph.mjs'), script);
    const res = runScript(script, { args, cwd: root });
    assert.equal(res.code, 0, `stderr: ${res.stderr.trim()}`);
    return res.stdout;
  }

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
