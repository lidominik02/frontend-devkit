// validate.mjs is the gate CI, the Stop hook and two PostToolUse hooks share. Each check
// must catch the defect it exists for, report a CRLF checkout exactly as an LF one, and
// print `/` paths on every OS.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { REPO_ROOT, hookEvent, runScript, tempDir } from './helpers.mjs';
import { CHECKS, budget, checkFrontmatter, components, frontmatter, localComponents, runChecks } from '../validate.mjs';

const SKILL = 'plugins/core/skills/demo/SKILL.md';
const GUIDE = 'plugins/core/skills/demo/references/guide.md';
const AGENT = 'plugins/core/agents/helper.md';
const LOCAL_SKILL = '.claude/skills/local/SKILL.md';
const LOCAL_AGENT = '.claude/agents/local-agent.md';
const DESCRIPTION = 'Demo skill used as a validate.mjs fixture; it exists only in a temporary tree.';
const AGENT_DESCRIPTION = 'Demo agent used as a validate.mjs fixture.';
// Long enough to move the rounded budget figure, were it counted.
const LOCAL_DESCRIPTION = `Repo-local fixture component, never shipped. ${'Padding. '.repeat(30)}`.trim();
const CHANGELOG = '# Changelog\n\n## 1.0.0 — 2026-01-01\n\nFirst release.\n';

function skillText({ extraField = '', blocked = 'mcp__srv__tool_a', cite = 'references/guide.md', script = 'ok.mjs' } = {}) {
  return [
    '---',
    'name: demo',
    `description: ${DESCRIPTION}`,
    `disallowed-tools: ${blocked}`,
    ...(extraField ? [extraField] : []),
    '---',
    '',
    `Read \`${cite}\` first. Blocked: \`tool_a\`.`,
    'Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/' + script + '"`.',
    '',
  ].join('\n');
}

function agentText({ name = 'helper', description = AGENT_DESCRIPTION, extraField = '' } = {}) {
  return [
    '---',
    ...(name === null ? [] : [`name: ${name}`]),
    `description: ${description}`,
    ...(extraField ? [extraField] : []),
    '---',
    '',
    'Helps.',
    '',
  ].join('\n');
}

function readmeText(figure = Math.round((DESCRIPTION.length + AGENT_DESCRIPTION.length) / 100) / 10) {
  return `Listing cost: **${figure}k characters** in total.\nThe ceiling is 2,000 characters.\n`;
}

// A minimal marketplace on which every check passes; `defect` names the one to break, and
// `override` replaces or (with null) removes single files.
function fixture(t, { defect = null, crlf = false, override = {} } = {}) {
  const root = tempDir(t);
  const files = {
    '.claude-plugin/marketplace.json': JSON.stringify({ plugins: [{ name: 'core', source: './plugins/core' }] }),
    'plugins/core/.claude-plugin/plugin.json': JSON.stringify({
      name: 'core',
      version: defect === 'versions' ? '1.0' : '1.0.0',
    }),
    [SKILL]: skillText({
      extraField: defect === 'frontmatter' ? 'disable-model-invokation: true' : '',
      blocked: defect === 'mcp-names' ? 'mcp__srv__tool_a, mcp__srv__tool_b' : 'mcp__srv__tool_a',
      cite: defect === 'references' ? 'references/missing.md' : 'references/guide.md',
      script: defect === 'plugin-root' ? 'missing.mjs' : 'ok.mjs',
    }),
    [GUIDE]: '# Guide\n',
    [AGENT]: agentText(),
    // A project agent honours permissionMode, so only a plugin agent is flagged for it.
    [LOCAL_AGENT]: agentText({ name: 'local-agent', description: LOCAL_DESCRIPTION, extraField: 'permissionMode: plan' }),
    [LOCAL_SKILL]: ['---', 'name: local', `description: ${LOCAL_DESCRIPTION}`, 'argument-hint: "<target>"', '---', '', 'Local.', ''].join('\n'),
    'plugins/core/scripts/ok.mjs': 'export const ok = true;\n',
    'plugins/core/hooks/hooks.json': JSON.stringify({
      hooks: { PostToolUse: [{ hooks: [{ type: 'command', command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/scripts/ok.mjs'] }] }] },
    }),
    'README.md': readmeText(defect === 'budget' ? 9.9 : undefined),
    'CHANGELOG.md': defect === 'changelog' ? CHANGELOG.replace('1.0.0', '0.9.0') : CHANGELOG,
  };
  if (defect === 'scripts') files['plugins/core/scripts/broken.mjs'] = 'export const x = ;\n';
  if (defect === 'skill-dirs') files['plugins/core/skills/orphan/notes.md'] = '# Notes\n';
  Object.assign(files, override);

  for (const [rel, text] of Object.entries(files)) {
    if (text === null) continue;
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, crlf && rel.endsWith('.md') ? text.replace(/\n/g, '\r\n') : text);
  }
  return root;
}

// The scripts derive their root from their own location, so a copy runs against the fixture.
function copyScript(root, rel) {
  const dest = path.join(root, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(REPO_ROOT, rel), dest);
  return dest;
}

// validate.mjs imports pack-graph.mjs, so a runnable copy needs both.
function copyValidate(root) {
  copyScript(root, 'scripts/pack-graph.mjs');
  return copyScript(root, 'scripts/validate.mjs');
}

const byName = (results) => Object.fromEntries(results.map((r) => [r.name, r]));

describe('validate.mjs checks run against the root they are given', () => {
  test('every check passes on a sound fixture', (t) => {
    const results = runChecks(undefined, fixture(t));
    for (const r of results) assert.deepEqual(r.findings, [], `${r.name} failed on the sound fixture`);
    assert.deepEqual(results.map((r) => r.name), Object.keys(CHECKS));
  });

  const defects = {
    frontmatter: /plugins\/core\/skills\/demo\/SKILL\.md -> unknown frontmatter field 'disable-model-invokation'/,
    budget: /README\.md says 9\.9k/,
    references: /plugins\/core\/skills\/demo\/SKILL\.md -> references\/missing\.md: no such file/,
    'mcp-names': /mcp__srv__tool_b is blocked but "tool_b" is undocumented anywhere under plugins\/core\/skills\/demo$/,
    scripts: /^plugins\/core\/scripts\/broken\.mjs -> SyntaxError/,
    versions: /^plugins\/core\/\.claude-plugin\/plugin\.json -> version "1\.0" is not X\.Y\.Z$/,
    'skill-dirs': /^plugins\/core\/skills\/orphan -> no SKILL\.md$/,
    'plugin-root': /^plugins\/core\/skills\/demo\/SKILL\.md -> \$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/missing\.mjs does not resolve inside plugins\/core$/,
    changelog: /^CHANGELOG\.md has no "## 1\.0\.0" section/,
  };

  for (const [name, finding] of Object.entries(defects)) {
    test(`${name} fails on a fixture carrying its defect, and only ${name} does`, (t) => {
      const results = byName(runChecks(undefined, fixture(t, { defect: name })));
      assert.equal(results[name].ok, false);
      assert.ok(
        results[name].findings.some((f) => finding.test(f)),
        `findings: ${results[name].findings.join(' | ')}`,
      );
      for (const other of Object.values(results)) {
        if (other.name !== name) assert.deepEqual(other.findings, [], `${other.name} failed too`);
      }
    });
  }

  test('components() and checkFrontmatter() take the root too', (t) => {
    const root = fixture(t, { defect: 'frontmatter' });
    assert.deepEqual(components(root).sort(), [path.join(root, AGENT), path.join(root, SKILL)].sort());
    assert.equal(checkFrontmatter(undefined, root).ok, false);
    assert.equal(checkFrontmatter([path.join(root, SKILL)], root).ok, false);
  });
});

describe('validate.mjs frontmatter rules', () => {
  const cases = {
    'a skill name that is not kebab-case': {
      override: { 'plugins/core/skills/Demo_Skill/SKILL.md': skillText().replace('name: demo', 'name: Demo_Skill') },
      finding: /^plugins\/core\/skills\/Demo_Skill\/SKILL\.md -> name "Demo_Skill" is not kebab-case$/,
    },
    'an agent without a name': {
      override: { [AGENT]: agentText({ name: null }) },
      finding: /^plugins\/core\/agents\/helper\.md -> no name$/,
    },
    'an agent name containing a colon': {
      override: { [AGENT]: agentText({ name: 'core:helper' }) },
      finding: /^plugins\/core\/agents\/helper\.md -> name "core:helper" contains ':'/,
    },
    'an angle bracket in a description': {
      override: { [AGENT]: agentText({ description: 'Turns <input> into output.' }) },
      finding: /^plugins\/core\/agents\/helper\.md -> description contains an angle bracket$/,
    },
    'permissionMode in a plugin agent': {
      override: { [AGENT]: agentText({ extraField: 'permissionMode: plan' }) },
      finding: /^plugins\/core\/agents\/helper\.md -> 'permissionMode' is ignored in a plugin agent/,
    },
    'an unknown field in a repo-local skill': {
      override: { [LOCAL_SKILL]: ['---', 'name: local', `description: ${LOCAL_DESCRIPTION}`, 'disable-model-invokation: true', '---', ''].join('\n') },
      finding: /^\.claude\/skills\/local\/SKILL\.md -> unknown frontmatter field 'disable-model-invokation'/,
    },
    'a repo-local agent without a name': {
      override: { [LOCAL_AGENT]: agentText({ name: null, description: LOCAL_DESCRIPTION }) },
      finding: /^\.claude\/agents\/local-agent\.md -> no name$/,
    },
  };

  for (const [label, { override, finding }] of Object.entries(cases)) {
    test(`frontmatter fails on ${label}, the same on CRLF`, (t) => {
      const lf = byName(runChecks(undefined, fixture(t, { override })));
      assert.equal(lf.frontmatter.ok, false);
      assert.ok(lf.frontmatter.findings.some((f) => finding.test(f)), `findings: ${lf.frontmatter.findings.join(' | ')}`);
      assert.deepEqual(runChecks(['frontmatter'], fixture(t, { override, crlf: true })), [lf.frontmatter]);
    });
  }

  test('an angle bracket outside the description, and permissionMode in a project agent, pass', (t) => {
    const root = fixture(t);
    assert.match(fs.readFileSync(path.join(root, LOCAL_SKILL), 'utf8'), /argument-hint: "<target>"/);
    assert.deepEqual(byName(runChecks(['frontmatter'], root)).frontmatter.findings, []);
  });

  test('localComponents() lists the .claude skills and agents; the budget counts only plugins/', (t) => {
    const root = fixture(t);
    assert.deepEqual(localComponents(root), [path.join(root, LOCAL_SKILL), path.join(root, LOCAL_AGENT)]);
    assert.equal(budget(root).listed, DESCRIPTION.length + AGENT_DESCRIPTION.length);
  });
});

test('plugin-root fails on a path that leaves its pack through .., even when the target exists', (t) => {
  const root = fixture(t, { override: { 'plugins/vue/scripts/ok.mjs': 'export const ok = true;\n' } });
  const skill = fs.readFileSync(path.join(root, SKILL), 'utf8').replace('scripts/ok.mjs', '../vue/scripts/ok.mjs');
  fs.writeFileSync(path.join(root, SKILL), skill);
  const result = byName(runChecks(['plugin-root'], root))['plugin-root'];
  assert.deepEqual(result.findings, [
    'plugins/core/skills/demo/SKILL.md -> ${CLAUDE_PLUGIN_ROOT}/../vue/scripts/ok.mjs does not resolve inside plugins/core',
  ]);
});

describe('validate.mjs reports a marketplace pack-graph cannot follow as a finding', () => {
  const cases = {
    'a missing plugin.json': {
      override: { 'plugins/core/.claude-plugin/plugin.json': null },
      finding: /^plugins\/core\/\.claude-plugin\/plugin\.json is missing or not valid JSON, so no pack was checked$/,
    },
    'an invalid plugin.json': {
      override: { 'plugins/core/.claude-plugin/plugin.json': '{ "name": "core", ' },
      finding: /^plugins\/core\/\.claude-plugin\/plugin\.json is missing or not valid JSON, so no pack was checked$/,
    },
    'an object source': {
      override: {
        '.claude-plugin/marketplace.json': JSON.stringify({
          plugins: [{ name: 'core', source: { source: 'github', repo: 'owner/repo' } }],
        }),
      },
      finding: /^\.claude-plugin\/marketplace\.json -> entry "core" has a non-path source, so no pack was checked$/,
    },
  };

  for (const [label, { override, finding }] of Object.entries(cases)) {
    test(`${label}`, (t) => {
      const results = byName(runChecks(undefined, fixture(t, { override })));
      for (const name of ['skill-dirs', 'plugin-root', 'versions', 'changelog']) {
        assert.equal(results[name].ok, false, `${name} passed`);
        assert.ok(results[name].findings.some((f) => finding.test(f)), `${name}: ${results[name].findings.join(' | ')}`);
      }
    });
  }
});

describe('validate.mjs reports a CRLF checkout exactly as an LF one', () => {
  test('frontmatter() reads a CRLF block', () => {
    assert.equal(frontmatter('---\r\nname: demo\r\n---\r\nbody\r\n'), 'name: demo');
  });

  for (const defect of [null, ...Object.keys(CHECKS)]) {
    test(`${defect ?? 'sound'} fixture`, (t) => {
      const lf = runChecks(undefined, fixture(t, { defect }));
      const crlf = runChecks(undefined, fixture(t, { defect, crlf: true }));
      assert.deepEqual(crlf, lf);
    });
  }
});

describe('validate.mjs from the command line', () => {
  test('passes a sound fixture and fails a broken one', (t) => {
    const sound = fixture(t);
    const ok = runScript(copyValidate(sound), { cwd: sound });
    assert.equal(ok.code, 0, `stderr: ${ok.stderr.trim()}`);
    assert.match(ok.stdout, new RegExp(`\\n${Object.keys(CHECKS).length} check\\(s\\) passed`));

    const broken = fixture(t, { defect: 'references' });
    const bad = runScript(copyValidate(broken), { cwd: broken, env: { GITHUB_ACTIONS: '' } });
    assert.equal(bad.code, 1);
    assert.match(bad.stderr, /FAIL {2}references\n {8}plugins\/core\/skills\/demo\/SKILL\.md -> /);
  });

  test('runs its checks when started through a symlink', (t) => {
    const root = fixture(t);
    const target = copyValidate(root);
    const link = path.join(tempDir(t), 'validate-link.mjs');
    try {
      fs.symlinkSync(target, link);
    } catch (e) {
      if (e.code === 'EPERM') return t.skip('creating a symlink needs a privilege this account lacks');
      throw e;
    }
    const res = runScript(link, { cwd: root });
    assert.equal(res.code, 0, `stderr: ${res.stderr.trim()}`);
    assert.match(res.stdout, new RegExp(`\\n${Object.keys(CHECKS).length} check\\(s\\) passed`));
  });
});

describe('the PostToolUse hooks that import validate.mjs', () => {
  function hookFixture(t, opts) {
    const root = fixture(t, opts);
    copyValidate(root);
    return {
      root,
      frontmatterHook: copyScript(root, 'scripts/hooks/frontmatter-on-write.mjs'),
      budgetHook: copyScript(root, 'scripts/hooks/budget-on-write.mjs'),
    };
  }

  test('importing validate.mjs never runs its command line', (t) => {
    const { root, frontmatterHook, budgetHook } = hookFixture(t);
    for (const hook of [frontmatterHook, budgetHook]) {
      const res = runScript(hook, { cwd: root, input: hookEvent('Write', {}) });
      assert.deepEqual(res, { code: 0, stdout: '', stderr: '' });
    }
  });

  const hooks = {
    'frontmatter-on-write': {
      key: 'frontmatterHook',
      defect: 'frontmatter',
      finding: /plugins\/core\/skills\/demo\/SKILL\.md -> unknown frontmatter field 'disable-model-invokation'/,
    },
    'budget-on-write': {
      key: 'budgetHook',
      defect: 'budget',
      finding: new RegExp(`always-on listing is ${DESCRIPTION.length + AGENT_DESCRIPTION.length} chars .*README\\.md says 9\\.9k`),
    },
  };

  for (const [name, { key, defect, finding }] of Object.entries(hooks)) {
    const run = (t, opts) => {
      const fx = hookFixture(t, opts);
      return runScript(fx[key], { cwd: fx.root, input: hookEvent('Write', { file_path: path.join(fx.root, SKILL) }) });
    };

    test(`${name} reports a CRLF component exactly as an LF one`, (t) => {
      const sound = run(t, { crlf: false });
      assert.deepEqual(sound, { code: 0, stdout: '', stderr: '' });
      assert.deepEqual(run(t, { crlf: true }), sound);

      const broken = run(t, { defect, crlf: false });
      assert.equal(broken.code, 2);
      assert.match(broken.stderr, finding);
      assert.deepEqual(run(t, { defect, crlf: true }), broken);
    });
  }
});
