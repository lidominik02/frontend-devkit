#!/usr/bin/env node
// PreToolUse hook -- denies a `git commit` whose message carries an
// attribution trailer, or names something that exists only between the
// user and Claude (a session, a handoff file, a roadmap artifact, a phase
// or a decision id). Both are the specific failures the user reported: a
// commit message is read by another developer, who has no access to either.
// It also denies `git commit-tree` outright, whatever its message, and, since
// the user pushes and merges: every `git push`, `send-pack` and `http-push`; a
// `git merge` other than a bare `git merge --abort`; a `git pull` without
// `--rebase`, which merges; `git subtree push|pull|merge|add`; `git svn
// dcommit|set-tree|commit-diff`; and `git p4 submit`. A git subcommand word
// that is an expansion (`git $X push`, `git "$@"`) may be any of them, so it
// is denied too, at the cost of denying a harmless one such as `git $X status`.
//
// Node rather than bash, for the reason block-secrets.mjs states: bash exits
// 2 on a syntax error and 2 is also the hook protocol's block signal, so a
// broken shell hook blocks every tool call including the edit that would fix
// it. Node exits 1 on a SyntaxError, non-blocking, so a broken hook here
// fails open. Fail closed on a policy decision; fail open on a broken
// interpreter -- the same split every hook in this plugin makes.
//
// This checks Bash commands only, matching the plugin's own convention:
// there is no `allowed-tools` grant for `git commit` anywhere in this
// plugin, so the only way a commit happens is through a Bash call the model
// composes itself, and that is exactly what this inspects.
//
// The command is tokenised the way a shell reads it -- quotes, escapes,
// separators, heredoc bodies -- by lib/shell-parse.mjs, so only a real
// invocation of one of those git subcommands is judged. Unless the command is
// led by one that never runs its arguments (echo, grep, cat, ...), a git or
// shell invocation among its arguments counts too, which covers sudo, xargs,
// timeout and the like, and `env -S` has its string split into words. A
// command word is compared by its basename at `/` or `\`, without a trailing
// `.exe`, `.cmd` or `.bat`, in any case, so `git.exe`, `GIT.EXE`,
// `/c/Program\ Files/Git/cmd/git.exe` and `C:\Progra~1\Git\cmd\git` are git.
// The shells followed are sh, bash, zsh, dash, ksh, pwsh, powershell and cmd. A
// shell's script is followed two levels deep, whether it comes from `-c`, a
// pwsh or powershell `-Command` (`-c`) or first word that is not an option, a
// cmd `/c` or `/k` (with the command glued on or not), a heredoc or a
// here-string, and so are `$(...)`, backtick and `<(...)` substitutions; a
// pwsh, powershell or cmd script is read with the same POSIX tokeniser. When a
// shell reads its script from a pipe or a `<` redirect, the whole command gets
// a plain-text scan instead.
//
// A commit is judged on its message alone: each -m/--message and --trailer
// value and each -F/--file text, bundled (-am, -aF) and abbreviated (--mess)
// spellings included, never its options or paths. A message read from stdin
// or a process substitution, or from a file this hook cannot read or that
// the same command also names, may be written anywhere in the command, so
// the whole command is scanned instead, each `--trailer key=value` in it
// (git interpret-trailers' too) read as the `key: value` git 2.43.0 writes,
// and every occurrence of a -F/--file path left out of it, the redirect that
// writes the file included; a heredoc body and a -m value stay in. A relative -F path resolves against CLAUDE_PROJECT_DIR, else the event's
// cwd, else this hook's own, and a `cd` earlier in the command is not
// followed. On Windows a Git Bash drive path (`/c/...`) reads as `C:/...` and
// any other POSIX-absolute path is unreadable. A file that cannot be read is
// named in the reason when the command is denied, and on stderr when it passes.
//
// Out of reach, and let through: git aliases, a quoted `eval` string, deeper
// nesting, a git command name produced by an expansion (`$g`, `$(command -v
// git)`), a script or stdin message read from a file (`bash f`, `sh ./f.sh`,
// `source f`, `. f`, `bash < f`, `-F - < f`), a command another interpreter or
// a task runner runs (`python3 -c`, `node -e`, `make`, `npm run` and every
// other package script), a git subcommand that runs another command (`git
// submodule foreach`, `git rebase --exec`, `git bisect run`), a mistyped
// subcommand that `help.autocorrect` runs as the one it resembles (`git -c
// help.autocorrect=immediate psuh` pushed, git 2.43.0), `git submodule update
// --merge|--rebase`, `git p4 commit` and `git svn branch|tag` (from the man
// pages, unverified: git-p4 and git-svn were not installed), a host CLI (`gh
// pr merge`, `glab mr merge`), a message assembled in a variable or read by a
// substitution (`-m "$(cat f)"`), a message from a template, an editor or
// another commit (-t, -c, -C), a trailer key that `trailer.<name>.key` config
// renames (git 2.43.0), and a stale -F file the command rewrites under another
// name. `pull.rebase` config is not read, so a `git pull` passes only with
// `--rebase` or `-r` on the command line. Deliberately denied, at the cost of a
// false alarm: `git pull -qr` (a bundled `-r`) and `git pull --reb` (too short
// to read as a rebase), `git merge --abo` (only a bare `--abort` passes), and
// `git push -h` or `--help`; `git help push` passes. A command that does not
// tokenise falls back to a plain-text scan of the whole string, so `echo don't
// git push` is denied.

import { readFileSync } from 'node:fs';
import path from 'node:path';

/** @typedef {import('./lib/shell-parse.mjs').SimpleCommand} SimpleCommand */

/** @type {typeof import('./lib/shell-parse.mjs')} */
let shell;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', async () => {
  try {
    // Imported here rather than statically, so a missing lib reaches the catch
    // below instead of failing module linking with a raw trace.
    shell = await import('./lib/shell-parse.mjs');
    main(raw);
  } catch (err) {
    // A hook that cannot evaluate its own policy must not take the session down
    // with it: a permanently blocked session is worse and likelier than the commit it would catch.
    process.stderr.write(`devkit commit-hygiene: could not evaluate, allowing through: ${String(err)}\n`);
    process.exit(0);
  }
});

/** @param {string} reason */
function deny(reason) {
  process.stderr.write(`Blocked by devkit: ${reason}\n`);
  process.exit(2);
}

const COMMIT_TREE_REASON = 'that commit uses `git commit-tree`. Commits go through `git commit`, so the repository\'s own hooks and this hook see the message; a plumbing commit bypasses both.';
const HAND_BACK_REASON = 'that command pushes or merges, or may (`git push`, `git merge`, `git pull` without `--rebase`, a subtree, svn or p4 push or merge, or a git subcommand given as an expansion such as `git $X`). The user pushes and merges: hand this step back to the user with the command to run, rather than retrying it in another form. `git fetch`, `git rebase`, `git pull --rebase`, `git merge-base` and `git merge --abort` stay available.';
// The --rebase values git 2.43.0 reads as a rebase; anything else is judged a merge.
const PULL_REBASE_VALUES = ['true', 'yes', 'on', '1', 'merges', 'm', 'interactive', 'i'];
const PUSH_SUBCOMMANDS = ['push', 'send-pack', 'http-push'];
// Git subcommands whose own subcommand pushes or merges.
const NESTED_HAND_BACK = new Map([
  ['subtree', ['push', 'pull', 'merge', 'add']],
  ['svn', ['dcommit', 'set-tree', 'commit-diff']],
  ['p4', ['submit']],
]);

// Git's global options that take their value as the next word, shared by the
// tokeniser and the plain-text matchers. Not `--exec-path`: without `=` it
// prints the path and exits (git 2.43.0).
const GIT_VALUE_OPTIONS = ['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env', '--attr-source'];

// Plain-text matchers, used only for a command that does not tokenise. The
// value alternatives are disjoint so a failed match cannot backtrack
// exponentially through repeated options.
const VALUE_OPTS = `(?:${GIT_VALUE_OPTIONS.join('|')})`;
const OPT_VALUE = String.raw`(?:"[^"]*"|'[^']*'|[^\s"']\S*)`;
const GLOBAL_OPTS = String.raw`(?:${VALUE_OPTS}\s+${OPT_VALUE}\s+|(?!${VALUE_OPTS}\s)-\S+\s+)*`;
const GIT_COMMIT = new RegExp(String.raw`\bgit\s+${GLOBAL_OPTS}commit(?:\s|$)`);
const GIT_COMMIT_TREE = new RegExp(String.raw`\bgit\s+${GLOBAL_OPTS}commit-tree(?:\s|$)`);
// The subcommand and the rest of its simple command, split into words below.
const GIT_HAND_BACK = new RegExp(String.raw`\bgit\s+${GLOBAL_OPTS}([^\s;&|)]+)([^;&|\n)]*)`, 'g');

// A generic-word denylist, deliberately: naming a private project would make
// this list itself a disclosure of it, which is the rule every check in this
// repository that would otherwise need repo-specific names already follows.
const TRAILERS = [
  { re: /co-?authored-?by\s*:/i, label: 'a Co-Authored-By trailer' },
  { re: /generated\s+with\b/i, label: 'a "Generated with" line' },
];
// git 2.43.0 splits a --trailer value at its first `=` or `:` and writes either as `:`.
/** @param {string} value */
const trailerText = (value) => value.replace(/^([^:=]*)=/, '$1:');
// trailerText over raw command text, for a --trailer of git commit or git interpret-trailers
// spelled down to `--tr` (git commit 2.43.0's shortest; interpret-trailers needs `--tra`).
/** @param {string} text */
const trailerOptionsText = (text) => text.replace(/(--tr[a-z]*[=\s]+["']?[^\s:="']*)\s*=/g, '$1:');
// Literal artifact filenames the planning skill writes into every consuming
// repository -- this is the workflow's own naming convention, not a
// project's content, so matching them carries none of the disclosure risk a
// denylist of real names would.
// SPEC.md and PLAN.md are left out: both are ordinary names for a repository's own
// docs, and a path into temp/<feature>/planning/ is caught below either way.
const ARTIFACT_FILES = /\b(?:HANDOFF|PROGRESS|DECISIONS|MASTER-PLAN|OPEN-QUESTIONS|ASSUMPTIONS|IMPLEMENTATION-PLAN|CONTRACT-GAPS)\.md\b/;

// "session", "roadmap" and "phase N" are all common, legitimate engineering
// vocabulary on their own -- a login session, a product's own visible
// roadmap page, "phase 2 of the rollout" -- so none of them is banned bare:
// the check has to be specific enough to catch the real failure without
// denying ordinary work. Only "handoff" stays bare, matching the user's own
// wording, because it collides with almost nothing in ordinary commit
// messages.
//
// No decision-or-ADR-id pattern (`ADR-\d+`, `decision #\d+`) is blocked, on
// purpose. Architecture Decision Records are a real, common convention --
// many repositories cite their own ADRs by number as the source of truth
// for a rule -- so a pattern like that would deny a commit correctly citing
// one. This list matches only what the user actually asked to keep out of a
// commit message: a Claude/chat session, a handoff, a roadmap artifact.
const LEAK_WORDS = [
  { re: ARTIFACT_FILES, label: 'the name of a planning-artifact file' },
  { re: /\btemp\/[^\s"']*\/planning\b/i, label: 'a path into a planning-artifacts directory' },
  // "this/the/our/current session" is not enough on its own -- all four
  // collide directly with ordinary session/cookie/auth work ("expire the
  // session", "get the current session"). Only a qualifier that names the
  // AI context itself is unambiguous enough to match on.
  { re: /\b(?:claude|chat|ai)\s+session\b/i, label: 'a reference to a Claude/chat session' },
  { re: /\bhandoffs?\b/i, label: 'a reference to a handoff' },
  { re: /\broadmap\s+(?:phase|artifact|file|step)\b/i, label: 'a reference to a roadmap artifact' },
  { re: /\bphase\s*\d+\s+of\s+the\s+roadmap\b/i, label: 'a roadmap phase reference' },
];

/** @param {string} text @returns {string | null} */
function messageReason(text) {
  for (const { re, label } of TRAILERS) {
    if (re.test(text)) {
      return `that commit message carries ${label}. No attribution trailer on any commit, in any repository.`;
    }
  }
  for (const { re, label } of LEAK_WORDS) {
    if (re.test(text)) {
      return `that commit message names ${label}. A commit message is read by another developer, who has no access to a session, a handoff file, a roadmap artifact, a phase or a decision id -- write what the change does and why instead.`;
    }
  }
  return null;
}

// The directory a relative -F path resolves against, set from the event in main().
let baseDir = process.cwd();

/**
 * The path a -F value names, resolved against `cwd`, or null when it cannot be
 * read on this platform. On win32 a Git Bash drive path (`/c/x`) is `C:/x`, and
 * any other POSIX-absolute path has no Windows equivalent.
 * @param {string} p @param {string} cwd @param {string} [platform]
 */
export function messageFilePath(p, cwd, platform = process.platform) {
  if (platform !== 'win32') return path.posix.resolve(cwd, p);
  const drive = /^\/([a-z])(?:\/|$)/i.exec(p);
  if (drive) return `${drive[1].toUpperCase()}:/${p.slice(drive[0].length)}`;
  if (p.startsWith('/')) return null;
  return path.win32.resolve(cwd, p);
}

/**
 * A message file's text, or null when this hook does not read it: stdin (`-`),
 * a device or a process substitution, all streams of the Bash call, or a file
 * that cannot be read, which alone counts as `unreadable`.
 * @param {string} p @param {string} cwd
 * @returns {{ text: string|null, unreadable: boolean }}
 */
function readMessageFile(p, cwd) {
  if (isStream(p)) return { text: null, unreadable: false };
  const file = messageFilePath(p, cwd);
  if (file === null) return { text: null, unreadable: true };
  try {
    return { text: readFileSync(file, 'utf8'), unreadable: false };
  } catch {
    return { text: null, unreadable: true };
  }
}

// A -F/--file option and its path, bundled (`-aF`, not after a flag that takes a
// value) and abbreviated (`--fi`) too: a path is never message text.
const FILE_ARGS = new RegExp(String.raw`(^|[\s;&|(])(?:-(?:(?![mFcCtSu])[a-zA-Z0-9])*F\s*|--f(?:i(?:le?)?)?(?:=|\s+))${OPT_VALUE}`, 'g');

/** @param {string} p */
function isStream(p) {
  return p === '-' || /^\/(?:dev|proc)\//.test(p) || /^[<>]\(/.test(p);
}

/**
 * `text` without every whole-word occurrence of a -F path, so a redirect that
 * writes the message file is not read as message text. A stream such as `-` or
 * `<(...)` is no path, and its text stays.
 * @param {string} text @param {string[]} files
 */
function withoutFilePaths(text, files) {
  let out = text.replace(FILE_ARGS, '$1');
  for (const file of files) {
    if (!file || isStream(file)) continue;
    const literal = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(String.raw`(^|[\s"'=<>;&|(])${literal}(?=$|[\s"';&|)])`, 'g'), '$1');
  }
  return out;
}

/**
 * messageReason over a whole command without its -F paths, plus `extra`. A
 * message file that could not be read is named in the reason, or on stderr
 * when the command passes, since its content was never judged.
 * @param {string} text @param {string[]} files @param {string} extra @param {string|null} unreadableFile
 */
function wholeCommandReason(text, files, extra, unreadableFile) {
  const reason = messageReason(`${trailerOptionsText(withoutFilePaths(text, files))}\n${extra}`);
  if (unreadableFile === null) return reason;
  const note = `The message file '${unreadableFile}' could not be read, so its content was not judged.`;
  if (reason) return `${reason} ${note}`;
  process.stderr.write(`devkit commit-hygiene: ${note} The rest of the command passed, allowing through.\n`);
  return null;
}

/** @param {string} text */
function plainTextScan(text) {
  if (GIT_COMMIT_TREE.test(text)) return COMMIT_TREE_REASON;
  const unquote = (/** @type {string} */ w) => w.replace(/^["']+|["']+$/g, '');
  for (const [, name, rest] of text.matchAll(GIT_HAND_BACK)) {
    if (pushesOrMerges(unquote(name), rest.split(/\s+/).filter(Boolean).map(unquote))) return HAND_BACK_REASON;
  }
  if (!GIT_COMMIT.test(text)) return null;
  const m = text.match(/(?:^|[;&|]|\s)-F\s*([^\s;&|]+)|--file[=\s]+([^\s;&|]+)/);
  const file = m?.[1] ?? m?.[2];
  const { text: fileText, unreadable } = file ? readMessageFile(unquote(file), baseDir) : { text: null, unreadable: false };
  return wholeCommandReason(text, file ? [unquote(file)] : [], fileText ?? '', unreadable && file ? unquote(file) : null);
}

// --- judging -----------------------------------------------------------------

const MAX_DEPTH = 2;
// Commands that never execute their arguments, so `echo git commit-tree` is text.
const NON_EXECUTING = new Set([
  'echo', 'printf', 'grep', 'egrep', 'fgrep', 'rg', 'ag', 'cat', 'less', 'man',
  'which', 'type', 'command', 'test', '[', 'true', 'false', ':',
]);

/** @param {string[]} words */
function gitSubcommand(words) {
  let k = 1;
  while (k < words.length) {
    const w = words[k];
    if (GIT_VALUE_OPTIONS.includes(w)) { k += 2; continue; }
    if (w.startsWith('-')) { k++; continue; } // --opt=value, or a flag such as --no-pager or -P
    return { name: w, args: words.slice(k + 1) };
  }
  return null;
}

/**
 * Whether a git subcommand pushes or merges. `git merge --abort` passes only
 * bare, since `--abort` elsewhere may be an option's value (`-m --abort`), and
 * a pull passes only when its last rebase option on the command line is a rebase.
 * An abbreviated `--no-reb` or `--reb=<v>` counts as git 2.43.0 reads it.
 * @param {string} name @param {string[]} args
 */
function pushesOrMerges(name, args) {
  if (/[$`]/.test(name)) return true;
  const end = args.indexOf('--');
  const opts = end < 0 ? args : args.slice(0, end);
  if (PUSH_SUBCOMMANDS.includes(name)) return true;
  const nested = NESTED_HAND_BACK.get(name);
  if (nested) return opts.some((a) => nested.includes(a));
  if (name === 'merge') return !(args.length === 1 && args[0] === '--abort');
  if (name !== 'pull') return false;
  let rebase = false;
  for (const a of opts) {
    if (a === '--rebase' || a === '-r') rebase = true;
    // `--no-re` is ambiguous with --no-recurse-submodules, so `--no-reb` is the shortest.
    else if (a.length >= 8 && '--no-rebase'.startsWith(a)) rebase = false;
    else if (/^--reb(?:a(?:se?)?)?=/.test(a)) rebase = PULL_REBASE_VALUES.includes(a.slice(a.indexOf('=') + 1).toLowerCase());
  }
  return !rebase;
}

// git commit's short options that take a value (the rest of the word, else
// the next word: `-amfix`, `-aF -`), and those whose optional value can only
// be the rest of the word (`-S<keyid>`), as git 2.43.0 parses them.
const COMMIT_VALUE_FLAGS = 'mFcCt';
const COMMIT_STUCK_FLAGS = 'Su';

/**
 * The message sources of a `git commit`: each -m/--message and --trailer
 * value, and each -F/--file path. A long option counts under any prefix: git
 * 2.43.0 accepts an unambiguous one (`--mess`) and rejects the rest.
 * @param {string[]} args
 */
function messageSources(args) {
  /** @type {string[]} */
  const texts = [];
  /** @type {string[]} */
  const files = [];
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (a === '--') break;
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      const name = eq < 0 ? a.slice(2) : a.slice(2, eq);
      const option = name && ['message', 'trailer', 'file'].find((o) => o.startsWith(name));
      if (!option) continue;
      const value = eq < 0 ? args[++k] : a.slice(eq + 1);
      if (value === undefined) continue;
      if (option === 'file') files.push(value);
      else texts.push(option === 'trailer' ? trailerText(value) : value);
      continue;
    }
    if (!a.startsWith('-')) continue;
    for (let j = 1; j < a.length; j++) {
      const flag = a[j];
      if (COMMIT_STUCK_FLAGS.includes(flag)) break;
      if (!COMMIT_VALUE_FLAGS.includes(flag)) continue;
      const value = j + 1 < a.length ? a.slice(j + 1) : args[++k];
      if (value !== undefined && flag === 'm') texts.push(value);
      if (value !== undefined && flag === 'F') files.push(value);
      break;
    }
  }
  return { texts, files };
}

/** @param {string} src @param {number} depth @returns {string | null} */
function analyse(src, depth) {
  let cmds;
  try { cmds = shell.parseShell(src); } catch { return plainTextScan(src); }
  for (const cmd of cmds) {
    const reason = judge(cmd, src, depth);
    if (reason) return reason;
  }
  return null;
}

/** @param {SimpleCommand} cmd @param {string} src @param {number} depth @returns {string | null} */
function judge(cmd, src, depth) {
  if (depth < MAX_DEPTH) {
    for (const sub of cmd.subs) {
      const reason = analyse(sub, depth + 1);
      if (reason) return reason;
    }
  }
  const words = shell.commandWords(cmd.words);
  if (words.length === 0) return null;
  const head = shell.commandName(words[0]);
  if (NON_EXECUTING.has(head)) return null;
  if (shell.SHELLS.has(head) || head === 'git') return invocation(words, cmd, src, depth);
  // Any other head may run its arguments (sudo, xargs, timeout, ...), so a git
  // or shell invocation among them is judged as though it led the command.
  for (let k = 1; k < words.length; k++) {
    const name = shell.commandName(words[k]);
    if (!shell.SHELLS.has(name) && name !== 'git') continue;
    const reason = invocation(words.slice(k), cmd, src, depth);
    if (reason) return reason;
  }
  return null;
}

/** @param {string} file */
function basename(file) {
  return file.slice(file.lastIndexOf('/') + 1);
}

/**
 * Judges `words`, which start with a shell or with git.
 * @param {string[]} words @param {SimpleCommand} cmd @param {string} src @param {number} depth
 * @returns {string | null}
 */
function invocation(words, cmd, src, depth) {
  if (shell.SHELLS.has(shell.commandName(words[0]))) {
    if (depth >= MAX_DEPTH) return null;
    const { script, stdin } = shell.shellInput(words);
    if (script !== null) return analyse(script, depth + 1);
    if (!stdin) return null;
    for (const body of cmd.stdin) {
      const reason = analyse(body, depth + 1);
      if (reason) return reason;
    }
    // A script piped or redirected in can be written anywhere upstream.
    return cmd.piped ? plainTextScan(src) : null;
  }
  const sub = gitSubcommand(words);
  if (!sub) return null;
  if (sub.name === 'commit-tree') return COMMIT_TREE_REASON;
  if (pushesOrMerges(sub.name, sub.args)) return HAND_BACK_REASON;
  if (sub.name !== 'commit') return null;
  const { texts, files } = messageSources(sub.args);
  let message = texts.join('\n');
  const elsewhere = src.slice(0, cmd.start) + src.slice(cmd.end);
  for (const file of files) {
    const { text, unreadable } = readMessageFile(file, baseDir);
    // Text git reads from stdin, or from a file this call may write first, can
    // come from anywhere in the command, so the whole command is scanned.
    if (text === null || elsewhere.includes(basename(file))) {
      return wholeCommandReason(src, files, `${message}\n${text ?? ''}`, unreadable ? file : null);
    }
    message += `\n${text}`;
  }
  return messageReason(message);
}

/** @param {string} input */
function main(input) {
  /** @type {any} */
  let evt = {};
  try { evt = JSON.parse(input); } catch { process.exit(0); }

  const tool = String(evt.tool_name ?? '');
  if (tool !== 'Bash') process.exit(0);

  const command = String(evt.tool_input?.command ?? '');
  if (!command) process.exit(0);

  baseDir = process.env.CLAUDE_PROJECT_DIR || evt.cwd || process.cwd();

  const reason = analyse(command, 0);
  if (reason) deny(reason);
  process.exit(0);
}
