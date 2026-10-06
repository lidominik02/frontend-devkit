#!/usr/bin/env node
// Warns when plugins/ or .claude-plugin/ changed since the latest `v*` tag. Always exits 0:
// unreleased commits are not an error, since a release is a deliberate bump.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHIPPED = ['plugins/', '.claude-plugin/'];

const git = (...args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });

const described = git('describe', '--tags', '--match', 'v*', '--abbrev=0');
const tag = described.status === 0 ? described.stdout.trim() : '';

if (!tag) {
  console.log('::warning::Nothing is released yet: no v* tag exists.');
} else {
  const diff = git('diff', '--quiet', tag, 'HEAD', '--', ...SHIPPED);
  if (diff.status === 0) {
    console.log(`plugins/ and .claude-plugin/ unchanged since ${tag}`);
  } else if (diff.status === 1) {
    console.log(`::warning::plugins/ or .claude-plugin/ changed since ${tag} and is unreleased; run /release to ship it.`);
  } else {
    console.log(`::warning::Could not compare against ${tag}: ${(diff.stderr || diff.error?.message || '').trim()}`);
  }
}

process.exit(0);
