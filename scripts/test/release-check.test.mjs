// release-check.mjs gates the release commit: it must pass a valid release, fail on a
// finding, and fail when validate.mjs exits 0 without having run its checks.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { REPO_ROOT, git, gitRepo, runScript, write } from './helpers.mjs';

const SCRIPT = path.join(REPO_ROOT, '.claude', 'skills', 'release', 'scripts', 'release-check.mjs');
const DESCRIPTION = 'Demo skill used as a release-check fixture; it exists only in a temporary repository.';

const manifest = (version) => JSON.stringify({ name: 'core', version });
const changelog = (...versions) => `# Changelog\n\n${versions.map((v) => `## ${v} - 2026-01-01\n\nRelease.\n`).join('\n')}`;

// A committed 1.0.0 marketplace that every validate.mjs check passes, with the real
// validate.mjs and the pack-graph.mjs and ci/release-notes.mjs it imports.
function releasedRepo(t, { skillField = '' } = {}) {
  const root = gitRepo(t);
  for (const rel of ['scripts/validate.mjs', 'scripts/pack-graph.mjs', 'scripts/ci/release-notes.mjs']) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.copyFileSync(path.join(REPO_ROOT, rel), path.join(root, rel));
  }
  write(root, {
    '.claude-plugin/marketplace.json': JSON.stringify({ plugins: [{ name: 'core', source: './plugins/core' }] }),
    'plugins/core/.claude-plugin/plugin.json': manifest('1.0.0'),
    'plugins/core/skills/demo/SKILL.md': [
      '---',
      'name: demo',
      `description: ${DESCRIPTION}`,
      'disallowed-tools: mcp__srv__tool_a',
      ...(skillField ? [skillField] : []),
      '---',
      '',
      'Blocked: `tool_a`.',
      '',
    ].join('\n'),
    'README.md': '# Demo\n',
    'devkit.config.json': JSON.stringify({ budget: { ceiling: 2000 }, docs: { roots: ['README.md'] } }),
    'CHANGELOG.md': changelog('1.0.0'),
  });
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '--no-verify', '-m', 'release 1.0.0']);
  return root;
}

// The release files as /release leaves them before its commit: changed, not yet committed.
function bumpTo110(root) {
  write(root, { 'plugins/core/.claude-plugin/plugin.json': manifest('1.1.0'), 'CHANGELOG.md': changelog('1.1.0', '1.0.0') });
}

test('a valid release passes, and the check leaves the index as it found it', (t) => {
  const root = releasedRepo(t);
  bumpTo110(root);
  // A staged change would vanish if the check read HEAD into the user's index.
  git(root, ['add', 'CHANGELOG.md']);
  const before = git(root, ['diff', '--cached', '--name-only']);
  assert.equal(before, 'CHANGELOG.md\n');

  const { code, stdout, stderr } = runScript(SCRIPT, { cwd: root });

  assert.equal(code, 0, stderr);
  assert.match(stdout, /^\d+ check\(s\) passed$/m);
  assert.equal(git(root, ['diff', '--cached', '--name-only']), before);
});

// The bumped version only validates if the uncommitted release files reach the checked tree.
test('the uncommitted release files are what get validated, not HEAD alone', (t) => {
  const root = releasedRepo(t);
  write(root, { 'plugins/core/.claude-plugin/plugin.json': manifest('1.1.0') });

  const { code, stderr } = runScript(SCRIPT, { cwd: root });

  assert.equal(code, 1);
  assert.match(stderr, /1\.1\.0/);
});

test('a frontmatter finding in the release commit fails it', (t) => {
  const root = releasedRepo(t, { skillField: 'disable-model-invokation: true' });
  bumpTo110(root);

  const { code, stderr } = runScript(SCRIPT, { cwd: root });

  assert.equal(code, 1);
  assert.match(stderr, /disable-model-invokation/);
});

test('a validate.mjs that runs nothing and exits 0 fails the check', (t) => {
  const root = releasedRepo(t);
  write(root, { 'scripts/validate.mjs': 'process.exit(0);\n' });
  git(root, ['commit', '-q', '--no-verify', '-am', 'silent validate']);
  bumpTo110(root);

  const { code, stderr } = runScript(SCRIPT, { cwd: root });

  assert.equal(code, 1);
  assert.match(stderr, /without reporting its checks/);
});
