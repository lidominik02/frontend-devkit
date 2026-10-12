#!/usr/bin/env node
// A review base, not a backup: the tree is reachable from no ref, so `git gc` can prune it;
// it leaves out credential paths, `temp/`, untracked ignored files and submodule work trees; staged and
// unstaged versions of one file are not told apart. Recovery of committed work is a backup
// ref's job; uncommitted work is the user's to commit. The tree is built in a temporary copy
// of the index, so the user's index stays byte-identical (git 2.43.0).
//
// Usage:
//   node snapshot.mjs take              print a tree id for the current working state
//   node snapshot.mjs diff <base> [--out <file>]
//       write a header, --stat and a -U10 diff from <base> (a tree, a commit or any rev) to
//       the current state, and print its path: --out resolved from the repository root, else
//       temp/snapshots/<name>.diff. An --out that already exists is refused.
// Exit 0 = the tree id or the diff path is on stdout. Exit 1 = stderr says why: not a git
// work tree, a required clean filter failed, a base that names no tree, an existing --out.

import { spawnSync } from 'node:child_process';
import { closeSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync, rmSync, writeSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Credential material: kept out of every tree and diff. A Windows path arrives with
// backslashes and a case-insensitive filesystem opens `.env` for `.ENV`, so paths are
// compared lowercased with forward slashes. A template (`.env.example`) is not a secret.
const SECRET_DIRS = ['secrets', '.ssh', '.gnupg'];
const KEY_EXTENSIONS = ['pem', 'p12', 'pfx', 'keystore', 'key'];
const KEY_FILES = ['id_rsa', 'id_ed25519', 'id_ecdsa'];
const IN_SECRET_DIR = new RegExp(`(^|/)(${SECRET_DIRS.map((d) => d.replace('.', '\\.')).join('|')})/`);
const KEY_EXTENSION = new RegExp(`\\.(${KEY_EXTENSIONS.join('|')})$`);
const KEY_FILE = new RegExp(`(^|/)(${KEY_FILES.join('|')})(\\.pub)?$`);
const TEMPLATE = /\.(example|sample|template|dist)$/;

/** @param {string} file */
const normalizePath = (file) => file.replace(/\\/g, '/').toLowerCase();

/** @param {string} name a lowercased path segment */
const isDotenvName = (name) => name === '.env' || name.startsWith('.env.');

/** @param {string} file */
function isCredentialPath(file) {
  const p = normalizePath(file);
  if (TEMPLATE.test(p)) return false;
  const parts = p.split('/');
  const base = parts.at(-1) ?? '';
  if (isDotenvName(base)) return true;
  // A file under a dotenv-named directory (`.env.d/secret`).
  if (parts.slice(0, -1).some((dir) => isDotenvName(dir) && !TEMPLATE.test(dir))) return true;
  if (IN_SECRET_DIR.test(p) || /(^|\/)\.aws\/credentials$/.test(p)) return true;
  if (KEY_EXTENSION.test(p) || KEY_FILE.test(p)) return true;
  return /serviceaccount[a-z0-9_.-]*\.json$/.test(base) || base === 'credentials.json';
}

const USAGE = 'usage: snapshot.mjs take | snapshot.mjs diff <base> [--out <file>]';

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
    // `add -u` skips an entry marked assume-unchanged; the mark is cleared in the copy only,
    // so the tree holds the file as it is on disk. skip-worktree stays: its file may be absent
    // on purpose (a sparse checkout), and `add -u` would then record a deletion.
    const assumed = paths(git(top, ['ls-files', '-z', '-v'], { env })).filter((l) => l.startsWith('h ')).map((l) => l.slice(2));
    if (assumed.length) git(top, ['update-index', '-z', '--no-assume-unchanged', '--stdin'], { env, input: assumed.join('\0') });

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

/** @param {string} top @param {string} base @param {string|null} out */
function writeDiff(top, base, out) {
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
  const file = out ? path.resolve(top, out) : path.join(top, 'temp', 'snapshots', name);
  mkdirSync(path.dirname(file), { recursive: true });

  let fd;
  try {
    fd = openSync(file, 'wx');
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === 'EEXIST') throw new Error('--out names an existing file; choose a new path');
    throw err;
  }
  try {
    writeSync(fd, header);
    // Off a terminal --stat truncates long paths to `.../` at 80 columns (git 2.43.0).
    git(top, ['diff', '--no-color', '--no-ext-diff', '--no-textconv', '--stat=200', baseTree, tree, ...pathspec], { stdout: fd });
    writeSync(fd, '\n');
    git(top, ['diff', '--no-color', '--no-ext-diff', '--no-textconv', '-U10', baseTree, tree, ...pathspec], { stdout: fd });
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
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--out') {
      const v = rest[++i];
      if (!v) throw new Error(`${a} needs a value\n${USAGE}`);
      out = v;
    } else if (a.startsWith('-') || base !== null) {
      throw new Error(`unexpected argument '${a}'\n${USAGE}`);
    } else {
      base = a;
    }
  }
  if (base === null) throw new Error(`diff needs a base\n${USAGE}`);
  process.stdout.write(`${writeDiff(toplevel(), base, out)}\n`);
}

try {
  main();
} catch (err) {
  process.stderr.write(`snapshot: ${/** @type {Error} */ (err).message}\n`);
  process.exit(1);
}
