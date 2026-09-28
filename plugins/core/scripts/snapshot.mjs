#!/usr/bin/env node
// Captures a repository's working state as a git tree, so a diff can cover
// uncommitted and untracked work without anything being committed or staged.
//
// The working state is tracked changes, staged changes and untracked files
// that are not ignored. `temp/` and every path isCredentialPath matches are
// left out of the tree and the diff, whether or not `temp/` is gitignored. The
// diff's header names each credential path that changed, since the diff cannot.
//
// The tree is built in a temporary copy of the index, unique to this process
// and removed when it exits, so the user's index stays byte-identical. Blobs
// and trees are written to the object store -- unreachable, harmless, removed
// by gc -- but no ref, index or HEAD changes (git 2.43.0).
//
// Submodule working-tree changes are invisible: a submodule is recorded at the
// commit it has checked out, never with its uncommitted edits (git 2.43.0).
//
// Usage:
//   node snapshot.mjs take
//       print a tree id for the current working state
//   node snapshot.mjs diff <base> [--out <file>] [--feature <slug>]
//       write a header, --stat and a -U10 diff from <base> (a tree id, a
//       commit, or any rev such as a merge-base) to the current state into a
//       file, and print its path. The default path is
//       temp/<slug>/tasks/<name>.diff with --feature, else
//       temp/snapshots/<name>.diff, under the repository root. A relative
//       --out resolves from the repository root too, whatever the current
//       directory. Nothing is written outside the repository's temp/ unless
//       --out names the file.
//
// Exit 0 = the tree id or the diff path is on stdout. Exit 1 = nothing is on
// stdout and stderr says why: not a git work tree, a required clean filter
// failed (Git LFS sets required), a base that names no tree, or a usage error.
// A failing clean filter that is not required stores the unfiltered content,
// and snapshot still exits 0 (git 2.43.0).

import { spawnSync } from 'node:child_process';
import { closeSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync, rmSync, writeSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isCredentialPath } from './lib/credential-paths.mjs';

const USAGE = 'usage: snapshot.mjs take | snapshot.mjs diff <base> [--out <file>] [--feature <slug>]';

/**
 * @param {string} cwd
 * @param {string[]} args
 * @param {{ env?: NodeJS.ProcessEnv, input?: string, stdout?: number }} [opts]
 * @returns {string} stdout, or '' when it went to a file descriptor
 */
function git(cwd, args, opts = {}) {
  const r = spawnSync('git', ['--no-optional-locks', ...args], {
    cwd,
    env: opts.env ?? process.env,
    input: opts.input,
    stdio: ['pipe', opts.stdout ?? 'pipe', 'pipe'],
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  });
  if (r.error) throw new Error(`could not run git: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${String(r.stderr).trim() || `exit ${r.status}`}`);
  return String(r.stdout ?? '');
}

/** @param {string} out */
const paths = (out) => out.split('\0').filter(Boolean);

// Relative, with the leading slash some rules expect: an absolute path would
// exclude every file of a checkout that lives under a directory named secrets/.
/** @param {string} p a repository-relative path, as git prints it */
const isCredential = (p) => isCredentialPath(`/${p}`);

/** @param {string} p a repository-relative path, as git prints it */
const excluded = (p) => p.startsWith('temp/') || isCredential(p);

function toplevel() {
  try {
    return git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
  } catch (err) {
    throw new Error(`not inside a git work tree: ${/** @type {Error} */ (err).message}`);
  }
}

/**
 * @param {string} top
 * @param {{ tree: string, credentials: string[] }} [base] the diff's base tree and the
 *   credential paths in it; when given, the credential paths that differ from it are returned
 * @returns {{ tree: string, changedCredentials: string[] }}
 */
function buildTree(top, base) {
  // --git-path honours an inherited GIT_INDEX_FILE, relative ones resolved from the
  // top level as every git command resolves them (git 2.43.0).
  const real = path.resolve(top, git(top, ['rev-parse', '--git-path', 'index']).trim());
  const dir = mkdtempSync(path.join(os.tmpdir(), 'devkit-snapshot-'));
  const index = path.join(dir, 'index');
  const env = { ...process.env, GIT_INDEX_FILE: index };
  try {
    if (existsSync(real)) copyFileSync(real, index);

    const tracked = [...new Set(paths(git(top, ['ls-files', '-z'], { env })))];
    const untracked = paths(git(top, ['ls-files', '-z', '--others', '--exclude-standard'], { env }));

    /** @type {string[]} */
    let changedCredentials = [];
    if (base) {
      // Compared through the copy, before the credential entries leave it: a porcelain
      // diff rewrites the index it reads, even under --no-optional-locks (git 2.43.0).
      const known = [...new Set([...base.credentials, ...tracked.filter(isCredential)])];
      const differ = known.length
        ? paths(git(top, ['--literal-pathspecs', 'diff', '--name-only', '-z', '--no-ext-diff', '--no-textconv', base.tree, '--', ...known], { env }))
        : [];
      changedCredentials = [...new Set([...differ, ...untracked.filter(isCredential)])].sort();
    }

    // Excluded paths leave the index before anything is added, so none reaches the object store.
    // An `:(exclude)temp/` pathspec on `git add` fails when temp/ is gitignored (git 2.43.0).
    const drop = tracked.filter(excluded);
    if (drop.length) git(top, ['update-index', '-z', '--force-remove', '--stdin'], { env, input: drop.join('\0') });
    git(top, ['add', '-u'], { env });

    const add = untracked.filter((p) => !excluded(p));
    if (add.length) {
      git(top, ['--literal-pathspecs', 'add', '--pathspec-from-file=-', '--pathspec-file-nul'], { env, input: add.join('\0') });
    }
    return { tree: git(top, ['write-tree'], { env }).trim(), changedCredentials };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** @param {string} top @param {string} base @param {string|null} out @param {string|null} feature */
function writeDiff(top, base, out, feature) {
  let baseTree;
  try {
    baseTree = git(top, ['rev-parse', '--verify', '--end-of-options', `${base}^{tree}`]).trim();
  } catch {
    throw new Error(`'${base}' names no tree, commit or rev in this repository`);
  }
  // The snapshot never holds a credential file, but the base may: without an
  // exclusion, the diff would print its content as a deletion.
  const credentials = paths(git(top, ['ls-tree', '-r', '-z', '--name-only', baseTree])).filter(isCredential);
  const pathspec = ['--', '.', ':(exclude)temp/', ...credentials.map((p) => `:(exclude,literal)${p}`)];
  const { tree, changedCredentials } = buildTree(top, { tree: baseTree, credentials });

  /** @param {string[]} args */
  const tryGit = (args) => { try { return git(top, args).trim(); } catch { return null; } };
  const branch = tryGit(['symbolic-ref', '--quiet', '--short', 'HEAD']) ?? '(detached HEAD)';
  const head = tryGit(['rev-parse', '--verify', '--quiet', 'HEAD']) ?? '(no commits yet)';
  const header = `branch ${branch} · HEAD ${head} · base ${base} (tree ${baseTree}) · snapshot tree ${tree}\n` +
    (changedCredentials.length ? `changed credential paths left out of this diff: ${changedCredentials.join(', ')}\n` : '') +
    '\n';

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const name = `${stamp}-${baseTree.slice(0, 7)}-${tree.slice(0, 7)}.diff`;
  // Relative to the root, where temp/ is excluded, not to a subdirectory the caller is in.
  const file = out ? path.resolve(top, out) : path.join(top, 'temp', ...(feature ? [feature, 'tasks'] : ['snapshots']), name);
  mkdirSync(path.dirname(file), { recursive: true });

  const fd = openSync(file, 'w');
  try {
    writeSync(fd, header);
    // Off a terminal --stat truncates long paths to `.../` at 80 columns (git 2.43.0).
    git(top, ['diff', '--no-color', '--no-ext-diff', '--stat=200', baseTree, tree, ...pathspec], { stdout: fd });
    writeSync(fd, '\n');
    git(top, ['diff', '--no-color', '--no-ext-diff', '-U10', baseTree, tree, ...pathspec], { stdout: fd });
  } catch (err) {
    closeSync(fd);
    rmSync(file, { force: true });
    throw err;
  }
  closeSync(fd);
  return file;
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'take' && rest.length === 0) {
    process.stdout.write(`${buildTree(toplevel()).tree}\n`);
    return;
  }
  if (cmd !== 'diff') throw new Error(USAGE);

  /** @type {string|null} */ let base = null;
  /** @type {string|null} */ let out = null;
  /** @type {string|null} */ let feature = null;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--out' || a === '--feature') {
      const v = rest[++i];
      if (!v) throw new Error(`${a} needs a value\n${USAGE}`);
      if (a === '--out') out = v;
      else feature = v;
    } else if (a.startsWith('-') || base !== null) {
      throw new Error(`unexpected argument '${a}'\n${USAGE}`);
    } else {
      base = a;
    }
  }
  if (base === null) throw new Error(`diff needs a base\n${USAGE}`);
  // A slash or a leading dot in the slug could place the file outside temp/.
  if (feature !== null && !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(feature)) {
    throw new Error(`--feature '${feature}' must be a single path segment of letters, digits, '.', '_' or '-'`);
  }
  process.stdout.write(`${writeDiff(toplevel(), base, out, feature)}\n`);
}

try {
  main();
} catch (err) {
  process.stderr.write(`snapshot: ${/** @type {Error} */ (err).message}\n`);
  process.exit(1);
}
