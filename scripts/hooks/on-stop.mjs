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

// A gate with no diff to judge does not speak. Without a usable watch list in
// devkit.config.json, its gate runs on every stop and says why.
const isPathList = (l) => Array.isArray(l) && l.length > 0 && l.every((p) => typeof p === 'string' && p);
let watch = null;
let testWatch = null;
try {
  const fs = await import('node:fs');
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'devkit.config.json'), 'utf8'));
  const roots = config?.docs?.roots;
  if (isPathList(config?.stopHook?.watch)) watch = [...new Set([...config.stopHook.watch, ...(isPathList(roots) ? roots : [])])];
  if (isPathList(config?.stopHook?.testWatch)) testWatch = config.stopHook.testWatch;
} catch { /* unreadable config: run both gates below */ }

function changes(paths) {
  if (!paths) return 'unknown';
  try {
    return execFileSync('git', ['status', '--porcelain', '--', ...paths], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch { return 'unknown'; /* not a git repo, or git missing: check anyway */ }
}
const validateDirty = changes(watch);
const testDirty = changes(testWatch);
if (validateDirty === '' && testDirty === '') process.exit(0);

// Returns the gate's output when it fails, null when it passes.
function gate(args, { env = process.env, timeout } = {}) {
  try {
    execFileSync(process.execPath, args, { cwd: ROOT, env, timeout, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return null;
  } catch (e) {
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim();
    return e.code === 'ETIMEDOUT' ? `Timed out after ${timeout / 1000} s.\n\n${out}` : out;
  }
}

// Exit 2 puts stderr in front of Claude and stops the turn ending on a red tree.
// The real output is returned, not a summary of it: a gate that says "something
// failed" sends the next turn re-running it to find out what.
const failures = [];
if (validateDirty !== '') {
  const out = gate([path.join(ROOT, 'scripts/validate.mjs')]);
  if (out !== null) failures.push(
    'Marketplace validation failed. These are the same checks CI runs, so this ' +
    'would be a red build.\n\n' + out +
    '\n\nFix the findings, or run `node scripts/validate.mjs` to see them again.'
  );
}
if (testDirty !== '') {
  // CLAUDE_* would point the scripts under test at this repository; NODE_TEST_CONTEXT
  // makes a nested `node --test` skip every file and exit 0.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE_') && k !== 'NODE_TEST_CONTEXT'),
  );
  // Under the hook's own timeout, so a hung test is reported instead of ending the turn unchecked.
  const out = gate(['--test', '--test-reporter=dot', 'scripts/test/*.test.mjs'], { env, timeout: 150_000 });
  if (out !== null) failures.push(
    'The test suite failed. CI runs the same suite, so this would be a red build.\n\n' + out +
    '\n\nFix the failures, or run `node --test "scripts/test/*.test.mjs"` to see them again.'
  );
}
if (failures.length) {
  console.error(failures.join('\n\n'));
  process.exit(2);
}

// A green tree with an unusable watch list still stops once: otherwise every turn would
// run that gate with nobody told why.
const unusable = [[watch, 'stopHook.watch', 'validates'], [testWatch, 'stopHook.testWatch', 'runs the test suite']]
  .filter(([list]) => !list)
  .map(([, key, does]) => `devkit.config.json has no usable ${key} list (a non-empty list of paths), so this hook ${does} on every stop. Fix the key.`);
if (unusable.length) {
  console.error(unusable.join('\n'));
  process.exit(2);
}
