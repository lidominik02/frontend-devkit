// The hooks in scripts/hooks/ guard this marketplace while it is edited. A PostToolUse hook
// speaks only about a file it checks and exits 2 on a finding; the Stop hook blocks a turn
// ending on a red tree, and never twice in a row.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { REPO_ROOT, git, gitRepo, hookEvent, runScript, tempDir, write } from './helpers.mjs';

const SKILL = 'plugins/core/skills/demo/SKILL.md';
const LOCAL_SKILL = '.claude/skills/local/SKILL.md';
const LOCAL_AGENT = '.claude/agents/local-agent.md';
const DESCRIPTION = 'Demo skill used as a repo-local hook fixture; it exists only in a temporary tree.';

const skillText = (extra = '') =>
  ['---', 'name: demo', `description: ${DESCRIPTION}`, ...(extra ? [extra] : []), '---', '', 'Demo.', ''].join('\n');
const WATCH = ['plugins', 'scripts', 'docs', '.claude-plugin', '.claude', 'README.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'CLAUDE.md', 'devkit.config.json'];
const TEST_WATCH = ['scripts', 'plugins/*/scripts/*', 'plugins/*/hooks/*', '.claude/skills/*/scripts/*'];
// A ceiling under the one demo description puts the tree over budget.
const configText = ({ ceiling = 2000, watch = WATCH, testWatch = TEST_WATCH, roots = ['README.md'], extra = {} } = {}) => {
  const stopHook = { ...(watch ? { watch } : {}), ...(testWatch ? { testWatch } : {}) };
  return JSON.stringify({ budget: { ceiling }, ...(watch || testWatch ? { stopHook } : {}), docs: { roots }, ...extra });
};
const PASSING_TEST = "import { test } from 'node:test';\ntest('passes', () => {});\n";
const FAILING_TEST = "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\ntest('breaks on purpose', () => assert.equal(1, 2));\n";

// The hooks bind their root from their own location, so copies run against the fixture.
function copyScript(root, rel) {
  const dest = path.join(root, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(REPO_ROOT, rel), dest);
  return dest;
}

// validate.mjs imports pack-graph.mjs and ci/release-notes.mjs, so every hook copy needs them
// beside it. Its checks read the packs marketplace.json lists, so the fixture lists core.
function fixture(root, files = {}) {
  write(root, {
    '.claude-plugin/marketplace.json': JSON.stringify({ plugins: [{ name: 'core', source: './plugins/core' }] }),
    'plugins/core/.claude-plugin/plugin.json': JSON.stringify({ name: 'core', version: '1.0.0' }),
    [SKILL]: skillText(),
    'README.md': '# Demo\n',
    'devkit.config.json': configText(),
    'scripts/test/pass.test.mjs': PASSING_TEST,
    ...files,
  });
  copyScript(root, 'scripts/validate.mjs');
  copyScript(root, 'scripts/pack-graph.mjs');
  copyScript(root, 'scripts/ci/release-notes.mjs');
  return {
    root,
    frontmatter: copyScript(root, 'scripts/hooks/frontmatter-on-write.mjs'),
    budget: copyScript(root, 'scripts/hooks/budget-on-write.mjs'),
    stop: copyScript(root, 'scripts/hooks/on-stop.mjs'),
  };
}

const runHook = (hook, fx, input) => runScript(fx[hook], { cwd: fx.root, input });
const onWrite = (hook, fx, rel) => runHook(hook, fx, hookEvent('Write', { file_path: path.join(fx.root, rel) }));
const SILENT = { code: 0, stdout: '', stderr: '' };

describe('the PostToolUse hooks stay silent on what they do not check', () => {
  for (const hook of ['frontmatter', 'budget']) {
    test(`${hook}-on-write exits 0 on stdin that is not JSON`, (t) => {
      // A tree with a finding, so a hook that checked anyway would exit 2.
      const fx = fixture(tempDir(t), { [SKILL]: skillText('disable-model-invokation: true'), 'devkit.config.json': configText({ ceiling: 10 }) });
      assert.deepEqual(runHook(hook, fx, 'not json {'), SILENT);
    });
  }

  test('frontmatter-on-write exits 0 on a file outside the components, however broken', (t) => {
    const broken = skillText('disable-model-invokation: true');
    const outside = {
      'docs/agents/notes.md': broken,
      'plugins/core/skills/demo/references/guide.md': broken,
      '.claude/notes/SKILL.md': broken,
      '.claude/skills/local/notes.txt': broken,
    };
    const fx = fixture(tempDir(t), outside);
    for (const rel of Object.keys(outside)) assert.deepEqual(onWrite('frontmatter', fx, rel), SILENT, rel);
  });

  test('budget-on-write exits 0 on a file that cannot move the budget, while the listing is over the ceiling', (t) => {
    const fx = fixture(tempDir(t), { 'devkit.config.json': configText({ ceiling: 10 }), 'docs/notes.md': '# Notes\n', [LOCAL_SKILL]: skillText() });
    for (const rel of ['docs/notes.md', 'scripts/validate.mjs', LOCAL_SKILL, 'README.md']) {
      assert.deepEqual(onWrite('budget', fx, rel), SILENT, rel);
    }
  });
});

describe('the PostToolUse hooks exit 2 on a finding', () => {
  test('frontmatter-on-write: a pack skill with an unknown field', (t) => {
    const fx = fixture(tempDir(t));
    assert.deepEqual(onWrite('frontmatter', fx, SKILL), SILENT);

    write(fx.root, { [SKILL]: skillText('disable-model-invokation: true') });
    const res = onWrite('frontmatter', fx, SKILL);
    assert.equal(res.code, 2);
    assert.match(res.stderr, /plugins\/core\/skills\/demo\/SKILL\.md -> unknown frontmatter field 'disable-model-invokation'/);
  });

  test('frontmatter-on-write checks the repo-local skills and agents too', (t) => {
    const fx = fixture(tempDir(t), {
      [LOCAL_SKILL]: ['---', 'name: local', `description: ${DESCRIPTION}`, '---', ''].join('\n'),
      [LOCAL_AGENT]: ['---', 'name: local-agent', `description: ${DESCRIPTION}`, '---', ''].join('\n'),
    });
    assert.deepEqual(onWrite('frontmatter', fx, LOCAL_SKILL), SILENT);
    assert.deepEqual(onWrite('frontmatter', fx, LOCAL_AGENT), SILENT);

    write(fx.root, {
      [LOCAL_SKILL]: ['---', 'name: local', `description: ${DESCRIPTION}`, 'disable-model-invokation: true', '---', ''].join('\n'),
      [LOCAL_AGENT]: ['---', `description: ${DESCRIPTION}`, '---', ''].join('\n'),
    });
    const skill = onWrite('frontmatter', fx, LOCAL_SKILL);
    assert.equal(skill.code, 2);
    assert.match(skill.stderr, /\.claude\/skills\/local\/SKILL\.md -> unknown frontmatter field 'disable-model-invokation'/);
    const agent = onWrite('frontmatter', fx, LOCAL_AGENT);
    assert.equal(agent.code, 2);
    assert.match(agent.stderr, /\.claude\/agents\/local-agent\.md -> no name/);
  });

  test('budget-on-write: a total over the ceiling, on a skill or a config write', (t) => {
    const fx = fixture(tempDir(t));
    assert.deepEqual(onWrite('budget', fx, SKILL), SILENT);

    write(fx.root, { 'devkit.config.json': configText({ ceiling: 10 }) });
    for (const rel of [SKILL, 'devkit.config.json']) {
      const res = onWrite('budget', fx, rel);
      assert.equal(res.code, 2, rel);
      assert.match(res.stderr, new RegExp(`always-on listing is ${DESCRIPTION.length} chars, over the 10-char ceiling in devkit\\.config\\.json`), rel);
      assert.match(res.stderr, /raise budget\.ceiling in devkit\.config\.json only with the user's approval/, rel);
    }
  });

  test('budget-on-write: an unreadable marketplace.json gets its finding, not the ceiling advice', (t) => {
    const fx = fixture(tempDir(t), { '.claude-plugin/marketplace.json': '{ "plugins": [' });
    const res = onWrite('budget', fx, SKILL);
    assert.equal(res.code, 2);
    assert.match(res.stderr, /marketplace\.json is missing, not valid JSON, or has no plugins list, so no pack was checked/);
    assert.doesNotMatch(res.stderr, /Always-on listing now/);
    assert.doesNotMatch(res.stderr, /raise budget\.ceiling/);
  });
});

// Inside a git hook, GIT_DIR and GIT_INDEX_FILE would point on-stop.mjs's git at the caller's repository.
const NO_GIT_ENV = Object.fromEntries(Object.keys(process.env).filter((k) => k.startsWith('GIT_')).map((k) => [k, undefined]));

describe('on-stop.mjs', () => {
  // A committed tree on which validate.mjs fails: the listing is over the ceiling.
  function committed(t, config = {}, files = {}) {
    const fx = fixture(gitRepo(t), { 'devkit.config.json': configText({ ceiling: 10, ...config }), ...files });
    git(fx.root, ['add', '-A']);
    git(fx.root, ['commit', '-q', '--no-verify', '-m', 'fixture']);
    return fx;
  }
  const stop = (fx, extra = {}) =>
    runScript(fx.stop, { cwd: fx.root, env: NO_GIT_ENV, input: JSON.stringify({ hook_event_name: 'Stop', ...extra }) });

  test('exits 2 with the findings when validate.mjs fails on a changed tree', (t) => {
    const fx = committed(t);
    write(fx.root, { [SKILL]: skillText() + '\nMore.\n' });
    const res = stop(fx);
    assert.equal(res.code, 2);
    assert.match(res.stderr, /Marketplace validation failed/);
    assert.match(res.stderr, /FAIL {2}budget\n.*over the 10-char ceiling in devkit\.config\.json/);
  });

  test('exits 0 on stop_hook_active, so a blocked stop does not loop', (t) => {
    const fx = committed(t);
    write(fx.root, { [SKILL]: skillText() + '\nMore.\n' });
    assert.deepEqual(stop(fx, { stop_hook_active: true }), SILENT);
  });

  const watched = {
    plugins: 'plugins/core/notes.md',
    scripts: 'scripts/notes.md',
    'README.md': 'README.md',
    '.claude-plugin': '.claude-plugin/marketplace.json',
    'CHANGELOG.md': 'CHANGELOG.md',
    '.claude': '.claude/skills/local/notes.md',
    docs: 'docs/notes.md',
    'CONTRIBUTING.md': 'CONTRIBUTING.md',
    'CLAUDE.md': 'CLAUDE.md',
  };
  for (const [spec, rel] of Object.entries(watched)) {
    test(`runs validate.mjs when ${spec} changed`, (t) => {
      const fx = committed(t);
      const p = path.join(fx.root, rel);
      write(fx.root, { [rel]: `${fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''}changed\n` });
      assert.equal(stop(fx).code, 2);
    });
  }

  test('stays silent when only paths it does not validate changed', (t) => {
    const fx = committed(t);
    assert.deepEqual(stop(fx), SILENT);
    write(fx.root, { 'notes/scratch.md': '# Notes\n' });
    assert.deepEqual(stop(fx), SILENT);
  });

  // The edit keeps the config valid JSON, so only the watch list can make the hook look.
  test('runs validate.mjs when devkit.config.json changed, and only because it is watched', (t) => {
    const fx = committed(t);
    write(fx.root, { 'devkit.config.json': configText({ ceiling: 10, extra: { note: 'changed' } }) });
    assert.equal(stop(fx).code, 2);

    const unwatched = committed(t, { watch: WATCH.filter((p) => p !== 'devkit.config.json') });
    write(unwatched.root, { 'devkit.config.json': configText({ ceiling: 10, watch: WATCH.filter((p) => p !== 'devkit.config.json'), extra: { note: 'changed' } }) });
    assert.deepEqual(stop(unwatched), SILENT);
  });

  test('watches every docs.roots entry, even one stopHook.watch leaves out', (t) => {
    const fx = committed(t, { watch: ['plugins'], roots: ['README.md', 'GUIDE.md'] });
    write(fx.root, { 'GUIDE.md': '# Guide\n' });
    assert.equal(stop(fx).code, 2);
  });

  // What validate.mjs needs beyond the base fixture to pass every check.
  const GREEN = {
    [SKILL]: skillText('disallowed-tools: mcp__srv__tool_a') + 'Blocked: `tool_a`.\n',
    'CHANGELOG.md': '# Changelog\n\n## 1.0.0 - 2026-01-01\n\nFirst release.\n',
  };
  const unusable = {
    'a missing watch list': { watch: null },
    'a watch list that is a string': { watch: 'plugins' },
    'a watch list holding an empty path': { watch: ['plugins', ''] },
  };
  for (const [label, config] of Object.entries(unusable)) {
    test(`validates on every stop, and says why, with ${label}`, (t) => {
      const red = committed(t, config);
      assert.match(stop(red).stderr, /Marketplace validation failed/);

      const green = committed(t, { ...config, ceiling: 2000 }, GREEN);
      const res = stop(green);
      assert.equal(res.code, 2);
      assert.match(res.stderr, /no usable stopHook\.watch list/);
    });
  }

  test('exits 2 with the failing test when a testWatch path changed', (t) => {
    const fx = committed(t, { ceiling: 2000 }, { ...GREEN, 'scripts/test/fail.test.mjs': FAILING_TEST });
    write(fx.root, { 'plugins/core/scripts/new.mjs': 'export {};\n' });
    const res = stop(fx);
    assert.equal(res.code, 2);
    assert.match(res.stderr, /The test suite failed/);
    assert.match(res.stderr, /breaks on purpose/);
    assert.doesNotMatch(res.stderr, /Marketplace validation failed/);
  });

  // The suite costs a turn tens of seconds, so a docs edit must not pay for it.
  test('does not run the test suite when only paths outside testWatch changed', (t) => {
    const fx = committed(t, { ceiling: 2000 }, { ...GREEN, 'scripts/test/fail.test.mjs': FAILING_TEST });
    write(fx.root, { 'docs/notes.md': '# Notes\n', 'README.md': '# Demo\n\nChanged.\n' });
    assert.deepEqual(stop(fx), SILENT);
  });

  test('reports a validation failure and a test failure in one stop', (t) => {
    const fx = committed(t, {}, { 'scripts/test/fail.test.mjs': FAILING_TEST });
    write(fx.root, { 'scripts/new.mjs': 'export {};\n' });
    const res = stop(fx);
    assert.equal(res.code, 2);
    assert.match(res.stderr, /Marketplace validation failed/);
    assert.match(res.stderr, /breaks on purpose/);
  });

  // Inherited from a parent test run, it would turn a red suite into a silent pass.
  test('runs the test suite even when started with NODE_TEST_CONTEXT set', (t) => {
    const fx = committed(t, { ceiling: 2000 }, { ...GREEN, 'scripts/test/fail.test.mjs': FAILING_TEST });
    write(fx.root, { 'scripts/new.mjs': 'export {};\n' });
    const res = runScript(fx.stop, {
      cwd: fx.root, env: { ...NO_GIT_ENV, NODE_TEST_CONTEXT: 'child-v8' }, input: JSON.stringify({ hook_event_name: 'Stop' }),
    });
    assert.equal(res.code, 2);
    assert.match(res.stderr, /breaks on purpose/);
  });

  // A hook inherits CLAUDE_PROJECT_DIR, which would point a script under test at this repository.
  test('runs the test suite without the CLAUDE_* variables the hook inherits', (t) => {
    const envTest = "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\n" +
      "test('sees no CLAUDE_ variable', () => assert.deepEqual(Object.keys(process.env).filter((k) => k.startsWith('CLAUDE_')), []));\n";
    const fx = committed(t, { ceiling: 2000 }, { ...GREEN, 'scripts/test/env.test.mjs': envTest });
    write(fx.root, { 'scripts/new.mjs': 'export {};\n' });
    const res = runScript(fx.stop, {
      cwd: fx.root, env: { ...NO_GIT_ENV, CLAUDE_PROJECT_DIR: REPO_ROOT }, input: JSON.stringify({ hook_event_name: 'Stop' }),
    });
    assert.deepEqual(res, SILENT);
  });

  const unusableTestWatch = {
    'a missing testWatch list': { testWatch: null },
    'a testWatch list that is a string': { testWatch: 'scripts' },
    'a testWatch list holding an empty path': { testWatch: ['scripts', ''] },
  };
  // A clean tree, so only the fallback can make the hook run the suite.
  for (const [label, config] of Object.entries(unusableTestWatch)) {
    test(`runs the test suite on every stop, and says why, with ${label}`, (t) => {
      const red = committed(t, { ceiling: 2000, ...config }, { ...GREEN, 'scripts/test/fail.test.mjs': FAILING_TEST });
      const failed = stop(red);
      assert.equal(failed.code, 2);
      assert.match(failed.stderr, /breaks on purpose/);

      const res = stop(committed(t, { ceiling: 2000, ...config }, GREEN));
      assert.equal(res.code, 2);
      assert.match(res.stderr, /no usable stopHook\.testWatch list/);
      assert.doesNotMatch(res.stderr, /stopHook\.watch/);
    });
  }

  test('validates on every stop when the config is not JSON', (t) => {
    const fx = committed(t);
    write(fx.root, { 'devkit.config.json': '{ "stopHook": ' });
    git(fx.root, ['commit', '-qam', 'broken config', '--no-verify']);
    const res = stop(fx);
    assert.equal(res.code, 2);
    assert.match(res.stderr, /devkit\.config\.json is not a JSON object/);
  });
});

describe('budget-on-write with an unusable config', () => {
  for (const [label, text] of Object.entries({ missing: null, 'not JSON': '{ "budget": ', 'a string ceiling': JSON.stringify({ budget: { ceiling: '6,500' } }) })) {
    test(`${label}: prints the config finding and no advice to shorten a description`, (t) => {
      const fx = fixture(tempDir(t));
      if (text === null) fs.rmSync(path.join(fx.root, 'devkit.config.json'));
      else write(fx.root, { 'devkit.config.json': text });
      const res = onWrite('budget', fx, SKILL);
      assert.equal(res.code, 2);
      assert.match(res.stderr, /devkit\.config\.json/);
      assert.doesNotMatch(res.stderr, /Always-on listing now|raise budget\.ceiling/);
    });
  }
});
