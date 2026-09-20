#!/usr/bin/env node
// Stop hook: the marketplace's own gates, run before a turn can end.
//
// `core` is enabled in this repo, so verify-before-done.mjs already fires here —
// but it reads gates from package.json scripts and this repo has none, so the
// devkit's own Stop guarantee is silent in the repo that ships it. This closes
// that: the checks CI enforces now run before the turn ends, not after a push.
//
// Node, not bash, for the reason hooks.json states: bash exits 2 on a syntax
// error and 2 is the block signal, so a broken shell hook blocks every tool call
// including the edit that would repair it. Node exits 1 on a SyntaxError, which
// is non-blocking, so a broken hook here fails open.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let event = {};
try {
  const fs = await import('node:fs');
  event = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
} catch { event = {}; }

// Honour the loop guard: without it, a blocked stop re-runs this hook forever.
if (event.stop_hook_active) process.exit(0);

// Silent when nothing this repo validates has changed, matching the devkit's own
// rule that a gate with no diff to judge should not speak.
let dirty = '';
try {
  dirty = execFileSync('git', ['status', '--porcelain', '--', 'plugins', 'scripts', 'README.md'], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch { /* not a git repo, or git missing: fall through and check anyway */ }
if (dirty === '') process.exit(0);

let out = '';
let failed = false;
try {
  out = execFileSync(process.execPath, [path.join(ROOT, 'scripts/validate.mjs')], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  failed = true;
  out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
}

if (!failed) process.exit(0);

// Exit 2 puts stderr in front of Claude and stops the turn ending on a red tree.
// The real output is returned, not a summary of it: a gate that says "something
// failed" sends the next turn re-running it to find out what.
console.error(
  'Marketplace validation failed. These are the same checks CI runs, so this ' +
  'would be a red build.\n\n' + out.trim() +
  '\n\nFix the findings, or run `node scripts/validate.mjs` to see them again.'
);
process.exit(2);
