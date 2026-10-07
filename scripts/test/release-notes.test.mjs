// The release workflow publishes a version's CHANGELOG.md section as its notes; a heading
// without a date must not reach a release.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { REPO_ROOT, runScript, tempDir, write } from './helpers.mjs';
import { changelogHeading, releaseNotes } from '../ci/release-notes.mjs';

const CHANGELOG = [
  '# Changelog',
  '',
  '## 1.1.0 - 2026-02-01',
  '',
  'Second release.',
  '',
  '## 1.0.0 - 2026-01-01',
  '',
  'First release.',
  '',
].join('\n');

describe('release-notes: the section under a dated heading', () => {
  test('finds the version\'s section and stops at the next heading', () => {
    assert.equal(releaseNotes(CHANGELOG, '1.1.0'), '## 1.1.0 - 2026-02-01\n\nSecond release.');
    assert.equal(releaseNotes(CHANGELOG, '1.0.0'), '## 1.0.0 - 2026-01-01\n\nFirst release.');
  });

  test('reads a CRLF file as an LF one', () => {
    assert.equal(releaseNotes(CHANGELOG.replace(/\n/g, '\r\n'), '1.1.0'), releaseNotes(CHANGELOG, '1.1.0'));
  });

  for (const heading of ['## 1.0.0 - TBD', '## 1.0.0 — 2026-01-01', '## 1.0.0', '## 1.0.0 - 2026-01-01 (yanked)']) {
    test(`\`${heading}\` is not a release heading`, () => {
      assert.equal(changelogHeading('1.0.0').test(heading), false);
      assert.equal(releaseNotes(`# Changelog\n\n${heading}\n\nFirst release.\n`, '1.0.0'), null);
    });
  }

  test('a dot in the version is literal', () => {
    assert.equal(changelogHeading('1.0.0').test('## 1x0x0 - 2026-01-01'), false);
  });
});

describe('release-notes from the command line', () => {
  // The script reads CHANGELOG.md beside its own location, so a copy runs against the fixture.
  function copy(t, changelog) {
    const root = tempDir(t);
    write(root, { 'CHANGELOG.md': changelog });
    for (const rel of ['scripts/ci/release-notes.mjs', 'scripts/pack-graph.mjs']) {
      write(root, { [rel]: fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8') });
    }
    return { root, script: path.join(root, 'scripts', 'ci', 'release-notes.mjs'), out: path.join(root, 'notes.md') };
  }

  test('writes the tagged version\'s section', (t) => {
    const { root, script, out } = copy(t, CHANGELOG);
    const res = runScript(script, { args: ['v1.0.0', out], cwd: root });
    assert.equal(res.code, 0, `stderr: ${res.stderr.trim()}`);
    assert.equal(fs.readFileSync(out, 'utf8'), '## 1.0.0 - 2026-01-01\n\nFirst release.\n');
  });

  test('exits 1 and writes nothing for a version without a dated section', (t) => {
    const { root, script, out } = copy(t, '# Changelog\n\n## 1.0.0 - TBD\n\nFirst release.\n');
    const res = runScript(script, { args: ['v1.0.0', out], cwd: root });
    assert.equal(res.code, 1);
    assert.match(res.stderr, /CHANGELOG\.md has no "## 1\.0\.0 - YYYY-MM-DD" section/);
    assert.equal(fs.existsSync(out), false);
  });
});
