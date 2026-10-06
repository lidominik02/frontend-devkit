// The hooks in scripts/hooks/ guard this marketplace while it is edited. A PostToolUse hook
// speaks only about a file it checks and exits 2 on a finding; the Stop hook blocks a turn
// ending on a red tree, and never twice in a row.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { REPO_ROOT, gitRepo, hookEvent, runScript, tempDir } from './helpers.mjs';

const SKILL = 'plugins/core/skills/demo/SKILL.md';
const LOCAL_SKILL = '.claude/skills/local/SKILL.md';
const LOCAL_AGENT = '.claude/agents/local-agent.md';
const DESCRIPTION = 'Demo skill used as a repo-local hook fixture; it exists only in a temporary tree.';
const FIGURE = Math.round(DESCRIPTION.length / 100) / 10;

const skillText = (extra = '') =>
  ['---', 'name: demo', `description: ${DESCRIPTION}`, ...(extra ? [extra] : []), '---', '', 'Demo.', ''].join('\n');
const readmeText = (figure = FIGURE) =>
  `Listing cost: **${figure}k characters** in total.\nThe ceiling is 2,000 characters.\n`;

// The hooks bind their root from their own location, so copies run against the fixture.
function copyScript(root, rel) {
  const dest = path.join(root, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(REPO_ROOT, rel), dest);
  return dest;
}

function write(root, files) {
  for (const [rel, text] of Object.entries(files)) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text);
  }
}

// validate.mjs imports pack-graph.mjs, so every hook copy needs both beside it.
function fixture(root, files = {}) {
  write(root, { [SKILL]: skillText(), 'README.md': readmeText(), ...files });
  copyScript(root, 'scripts/validate.mjs');
  copyScript(root, 'scripts/pack-graph.mjs');
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
      const fx = fixture(tempDir(t), { [SKILL]: skillText('disable-model-invokation: true'), 'README.md': readmeText(9.9) });
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

  test('budget-on-write exits 0 on a file that cannot move the budget, while README.md is stale', (t) => {
    const fx = fixture(tempDir(t), { 'README.md': readmeText(9.9), 'docs/notes.md': '# Notes\n', [LOCAL_SKILL]: skillText() });
    for (const rel of ['docs/notes.md', 'scripts/validate.mjs', LOCAL_SKILL]) {
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

  test('budget-on-write: a total that no longer matches README.md, on a skill or a README write', (t) => {
    const fx = fixture(tempDir(t));
    assert.deepEqual(onWrite('budget', fx, SKILL), SILENT);

    write(fx.root, { 'README.md': readmeText(9.9) });
    for (const rel of [SKILL, 'README.md']) {
      const res = onWrite('budget', fx, rel);
      assert.equal(res.code, 2, rel);
      assert.match(res.stderr, new RegExp(`always-on listing is ${DESCRIPTION.length} chars .*README\\.md says 9\\.9k`), rel);
    }
  });
});

// Inside a git hook, GIT_DIR and GIT_INDEX_FILE would point git at the caller's repository.
const NO_GIT_ENV = Object.fromEntries(Object.keys(process.env).filter((k) => k.startsWith('GIT_')).map((k) => [k, undefined]));

function git(dir, args) {
  const res = spawnSync('git', args, { cwd: dir, env: { ...process.env, ...NO_GIT_ENV }, encoding: 'utf8' });
  if (res.error) throw res.error;
  assert.equal(res.status, 0, `git ${args.join(' ')}: ${res.stderr.trim()}`);
}

describe('on-stop.mjs', () => {
  // A committed tree on which validate.mjs fails: README.md misstates the budget.
  function committed(t) {
    const fx = fixture(gitRepo(t), { 'README.md': readmeText(9.9) });
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
    assert.match(res.stderr, /FAIL {2}budget\n.*README\.md says 9\.9k/);
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
    write(fx.root, { 'docs/notes.md': '# Notes\n' });
    assert.deepEqual(stop(fx), SILENT);
  });
});
