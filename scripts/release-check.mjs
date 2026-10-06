#!/usr/bin/env node
// Validates what a release commit will hold rather than the working tree: HEAD checked out
// into a temporary directory through a temporary GIT_INDEX_FILE, so the user's index stays
// untouched, the working tree's CHANGELOG.md and plugins/*/.claude-plugin/plugin.json copied
// over it, and that tree's validate.mjs run. No POSIX shell or tar, so it runs on any OS.
//
// Exit 0 = the release content is valid. Exit 1 = a finding, or validate.mjs did not run
// every one of its checks.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

class CheckFailed extends Error {}

function git(cwd, args, env = process.env) {
  const res = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
  if (res.error) throw new CheckFailed(`git ${args[0]} could not start: ${res.error.message}`);
  if (res.status !== 0) throw new CheckFailed(`git ${args.join(' ')} failed: ${res.stderr.trim()}`);
  return res.stdout;
}

/** @param {string} top */
function releaseFiles(top) {
  const files = fs.existsSync(path.join(top, 'CHANGELOG.md')) ? ['CHANGELOG.md'] : [];
  const plugins = path.join(top, 'plugins');
  if (!fs.existsSync(plugins)) return files;
  for (const pack of fs.readdirSync(plugins).sort()) {
    const manifest = path.join('plugins', pack, '.claude-plugin', 'plugin.json');
    if (fs.existsSync(path.join(top, manifest))) files.push(manifest);
  }
  return files;
}

/** @param {string} tree */
function validate(tree) {
  const script = path.join(tree, 'scripts', 'validate.mjs');
  if (!fs.existsSync(script)) throw new CheckFailed('HEAD has no scripts/validate.mjs');

  const run = spawnSync(process.execPath, [script], { cwd: tree, encoding: 'utf8' });
  if (run.error) throw new CheckFailed(`validate.mjs could not start: ${run.error.message}`);
  process.stdout.write(run.stdout);
  process.stderr.write(run.stderr);
  if (run.status !== 0) throw new CheckFailed(`validate.mjs exited ${run.status ?? run.signal}`);

  const reported = /^(\d+) check\(s\) passed$/m.exec(run.stdout);
  if (!reported) throw new CheckFailed('validate.mjs exited 0 without reporting its checks as passed');

  // Counted in a child process: importing the module here would let a top-level
  // process.exit(0) in it end this check with a pass.
  const count = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', 'const { CHECKS } = await import(process.argv[1]); console.log(Object.keys(CHECKS).length);', pathToFileURL(script).href],
    { cwd: tree, encoding: 'utf8' },
  );
  const total = count.status === 0 ? Number(count.stdout.trim()) : NaN;
  if (!Number.isInteger(total) || total < 1) {
    throw new CheckFailed(`could not count the CHECKS validate.mjs exports: ${(count.stderr || count.stdout).trim()}`);
  }
  if (Number(reported[1]) !== total) {
    throw new CheckFailed(`validate.mjs reported ${reported[1]} check(s) passed, but it defines ${total}`);
  }
}

function main() {
  const top = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'devkit-release-')));
  try {
    const tree = path.join(tmp, 'tree');
    const env = { ...process.env, GIT_INDEX_FILE: path.join(tmp, 'index') };
    git(top, ['read-tree', 'HEAD'], env);
    // checkout-index joins prefix and path as plain strings, so the prefix needs its trailing slash.
    git(top, ['checkout-index', '-a', `--prefix=${tree.split(path.sep).join('/')}/`], env);

    for (const file of releaseFiles(top)) {
      fs.mkdirSync(path.dirname(path.join(tree, file)), { recursive: true });
      fs.copyFileSync(path.join(top, file), path.join(tree, file));
    }
    validate(tree);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

try {
  main();
} catch (err) {
  if (!(err instanceof CheckFailed)) throw err;
  console.error(`release-check: ${err.message}`);
  process.exitCode = 1;
}
