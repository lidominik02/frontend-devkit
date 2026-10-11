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
// is denied too, at the cost of denying a harmless one such as `git $X status`;
// so is a `Start-Process git` argument list held in a variable or a group
// (`-ArgumentList $a`, `Start-Process git $a`, `-ArgumentList @('status')`).
//
// Node rather than bash, for the reason block-secrets.mjs states: bash exits
// 2 on a syntax error and 2 is also the hook protocol's block signal, so a
// broken shell hook blocks every tool call including the edit that would fix
// it. Node exits 1 on a SyntaxError, non-blocking, so a broken hook here
// fails open. Fail closed on a policy decision; fail open on a broken
// interpreter -- the same split every hook in this plugin makes.
//
// This checks Bash and PowerShell commands: there is no `allowed-tools` grant
// for `git commit` anywhere in this plugin, so the only way a commit happens is
// through a shell call the model composes itself, and that is exactly what this
// inspects. A PowerShell command is read with the same POSIX tokeniser, its
// backslashes literal as PowerShell reads them, its backtick escapes rewritten
// into the tokeniser's own (`` `n `` a newline inside double quotes, any other
// escaped character itself) and a `<#...#>` comment dropped, so `&`,
// PowerShell's call operator, separates like a POSIX `&` and the word after it
// is the command name: `& git push`, `& 'C:\Program Files\Git\cmd\git.exe'
// push` and `git pu`sh` are `git push`. An assignment or a script block glued
// to the command does not hide it: `$r=git push`, `& {git push}` and `if
// ($true) {git push}` are `git push`. A `Start-Process` (`saps`) is judged
// as the command its `-FilePath` and `-ArgumentList` (or its two positional
// words) name, the list split at commas and blanks.
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
// pwsh or powershell `-Command` (`-c`, the script glued on with `:` or not),
// `-EncodedCommand` (`-e`, `-ec`, decoded) or first word that is not an option,
// a cmd `/c` or `/k` (with the command glued on or not, other switches run
// together before it: `/d/c`), a heredoc or a
// here-string, and so are `$(...)`, backtick and `<(...)` substitutions. A
// script is read in the language of the shell that runs it, whichever tool
// started that shell: a pwsh or powershell script rewritten as a PowerShell
// command is (so `pwsh -c '& {git push}'` is `git push`), a cmd script with its
// `^` escapes resolved and its `'`, `$` and backtick literal. When a
// shell reads its script from a pipe, what the commands before it in the
// pipeline print and the heredocs fed to them are read as its script, in its
// language (`echo "& {git push}" | pwsh -`); from a pipe or a `<` redirect,
// the whole command also gets a plain-text scan.
//
// A commit is judged on its message alone: each -m/--message and --trailer
// value and each -F/--file text, bundled (-am, -aF) and abbreviated (--mess)
// spellings included, never its options or paths. A message read from stdin
// or a process substitution, or from a file this hook cannot read or that
// the same command also names, may be written anywhere in the command, so
// the whole command is scanned instead, each `--trailer key=value` in it
// (git interpret-trailers' too) read as the `key: value` git 2.43.0 writes,
// and every shell word that names a -F/--file path left out of it, cut at the
// tokeniser's offsets: the -F value, a `>`/`>>` target that writes the file,
// any other word naming the same file, however spelled (`./m.txt` is `m.txt`,
// in any case on Windows). The path's text inside another word, a heredoc body
// or a -m value stays in. Text that does not tokenise is read roughly: each
// `git commit` in it has every -F path read, and only those -F values and the
// `>`/`>>` targets naming the same files are left out. A relative
// -F path resolves against the event's cwd, else CLAUDE_PROJECT_DIR, else this
// hook's own, moved by each `cd`, `chdir`, `pushd`, `Set-Location` (`sl`) or
// `Push-Location` before it, except one inside `( )` or before a `|`, and
// then by git's own `-C` options, each relative to the one before (git
// 2.47.0.windows.1). A `cd` that runs only on a condition (after `&&`, `||`,
// `then`, `else`, `elif`, `do`) may not move it, so the commands after it are
// judged both ways, up to MAX_FORKS such `cd`s. A target
// that cannot be known without running the command (no operand, `-`, `~`, a
// variable, a glob, `popd`) leaves a relative path naming an unknown file:
// unreadable, and kept in the whole-command scan; so does any such command in
// text that does not tokenise. On Windows a Git Bash drive path (`/c/...`) reads as `C:/...` and
// any other POSIX-absolute path is unreadable. A file that cannot be read is
// named in the reason when the command is denied, and on stderr when it passes.
//
// Out of reach, and let through: git aliases, a quoted `eval` or PowerShell
// `Invoke-Expression` (`iex`) string, deeper nesting, a git command name produced by an expansion (`$g`, `$(command -v
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
// git push` is denied; that scan reads `git` and `git.exe` in any case, a path
// ending in either included.

import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @typedef {import('./lib/shell-parse.mjs').SimpleCommand} SimpleCommand */

/** @type {typeof import('./lib/shell-parse.mjs')} */
let shell;

/**
 * Whether this file is the process's entry point, directly or through run.mjs,
 * which puts the hook's path in argv[1]. A module importing messageFilePath
 * must not get a stdin reader that keeps it alive. When the comparison itself
 * fails, the hook runs.
 */
function isEntryPoint() {
  if (!process.argv[1]) return false;
  try {
    const self = realpathSync.native(fileURLToPath(import.meta.url));
    const entry = realpathSync.native(process.argv[1]);
    return process.platform === 'win32' ? self.toLowerCase() === entry.toLowerCase() : self === entry;
  } catch {
    return true;
  }
}

if (isEntryPoint()) {
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
}

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
// `git` or `git.exe` in any case, closing quote included (`& 'C:\...\git.exe' push`).
const GIT_WORD = String.raw`\b[Gg][Ii][Tt](?:\.[Ee][Xx][Ee])?["']?\s+`;
const GIT_COMMIT = new RegExp(String.raw`${GIT_WORD}${GLOBAL_OPTS}commit(?:\s|$)`);
const GIT_COMMIT_TREE = new RegExp(String.raw`${GIT_WORD}${GLOBAL_OPTS}commit-tree(?:\s|$)`);
// The subcommand and the rest of its simple command, split into words below.
const GIT_HAND_BACK = new RegExp(String.raw`${GIT_WORD}${GLOBAL_OPTS}([^\s;&|)]+)([^;&|\n)]*)`, 'g');

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
 * Whether `p` names the same file from any directory.
 * @param {string} p @param {string} [platform]
 */
function isAbsolutePath(p, platform = process.platform) {
  return platform === 'win32' ? /^(?:[/\\]|[A-Za-z]:[/\\])/.test(p) : p.startsWith('/');
}

// Commands that change the shell's directory: POSIX cd, chdir, pushd and popd,
// and PowerShell's Set-Location (sl), Push-Location and Pop-Location.
const DIR_COMMANDS = new Set(['cd', 'chdir', 'pushd', 'popd', 'set-location', 'sl', 'push-location', 'pop-location']);
const DIR_WORD = /(?:^|[\s;&|(){}])(?:cd|chdir|pushd|popd|set-location|sl|push-location|pop-location)(?=$|[\s;&|)])/i;

/**
 * The directory a `cd`-like command leaves the shell in, from `dir`, or null
 * when it cannot be known without running it: no operand (home), `-`, a stack
 * entry (`+1`), `~`, an expansion, a glob, popd, or an unknown `dir`. PowerShell's
 * -Path and -LiteralPath name the operand; -PassThru and -StackName are skipped.
 * @param {string[]} words @param {string | null} dir
 * @returns {string | null}
 */
function changedDir(words, dir) {
  const head = shell.commandName(words[0]);
  if (dir === null || head === 'popd' || head === 'pop-location') return null;
  /** @type {string[]} */
  const operands = [];
  for (let k = 1; k < words.length; k++) {
    const w = words[k];
    if (w === '--' || /^-[LPe@]+$/.test(w)) continue;
    if (!/^-[A-Za-z]/.test(w)) { operands.push(w); continue; }
    const colon = w.indexOf(':');
    const name = (colon < 0 ? w.slice(1) : w.slice(1, colon)).toLowerCase();
    const glued = colon < 0 ? null : w.slice(colon + 1);
    if ('passthru'.startsWith(name) && name.length >= 2) continue;
    if (name.length >= 2 && ('path'.startsWith(name) || 'literalpath'.startsWith(name))) {
      operands.push(glued ?? words[++k] ?? '');
      continue;
    }
    if (name.length >= 2 && 'stackname'.startsWith(name)) { if (glued === null) k++; continue; }
    return null;
  }
  if (operands.length !== 1) return null;
  const target = operands[0];
  if (!target || /^[-+~]|[$`*?[]/.test(target)) return null;
  return messageFilePath(target, dir);
}

/**
 * The directory git runs in after its global `-C` options, `words[0]` being
 * git and `dir` the shell's: each `-C <path>` resolves against the one before,
 * as git chains them, and an empty one changes nothing (git 2.47.0.windows.1).
 * Null when a value cannot be known without running the command (`~`, an
 * expansion, a glob) or is relative to an unknown `dir`.
 * @param {string[]} words @param {string | null} dir
 * @returns {string | null}
 */
function gitDir(words, dir) {
  for (let k = 1; k < words.length; k++) {
    const w = words[k];
    if (w === '-C') {
      const target = words[++k] ?? '';
      if (!target) continue;
      if (/^~|[$`*?[]/.test(target)) dir = null;
      else if (isAbsolutePath(target)) dir = messageFilePath(target, '/');
      else if (dir !== null) dir = messageFilePath(target, dir);
      continue;
    }
    if (GIT_VALUE_OPTIONS.includes(w)) { k++; continue; }
    if (!w.startsWith('-')) break;
  }
  return dir;
}

/**
 * A message file's text, or null when this hook does not read it: stdin (`-`),
 * a device or a process substitution, all streams of the Bash call, or a file
 * that cannot be read, which alone counts as `unreadable`. A null `cwd` is a
 * directory a `cd` moved to that the hook cannot know, so only an absolute path
 * is read.
 * @param {string} p @param {string | null} cwd
 * @returns {{ text: string|null, unreadable: boolean }}
 */
function readMessageFile(p, cwd) {
  if (isStream(p)) return { text: null, unreadable: false };
  const file = cwd === null ? (isAbsolutePath(p) ? messageFilePath(p, '/') : null) : messageFilePath(p, cwd);
  if (file === null) return { text: null, unreadable: true };
  try {
    return { text: readFileSync(file, 'utf8'), unreadable: false };
  } catch {
    return { text: null, unreadable: true };
  }
}

/** @param {string} p */
function isStream(p) {
  return p === '-' || /^\/(?:dev|proc)\//.test(p) || /^[<>]\(/.test(p);
}

// The option text a -F path is glued to: `-F`, `-aF`, `--file=`, `--fi=`.
const GLUED_FILE_OPTION = /^(?:-[A-Za-z0-9]*F|--f(?:i(?:le?)?)?=)/;

/**
 * The file `p` names from `dir`, as it is compared with another spelling of it:
 * resolved (`./m.txt` is `m.txt`), and on Windows with `/` separators in lower
 * case, its filesystem ignoring case. `p` itself when it cannot be resolved.
 * @param {string} p @param {string | null} dir
 */
function pathKey(p, dir) {
  const file = isAbsolutePath(p) ? messageFilePath(p, '/') : dir === null ? null : messageFilePath(p, dir);
  if (file === null) return p;
  return process.platform === 'win32' ? file.replaceAll('\\', '/').toLowerCase() : file;
}

/**
 * `src`, which tokenises, without each shell word that names a -F path, cut
 * at the tokeniser's offsets: the -F/--file value, glued to its option or not,
 * a `>` or `>>` target, or any other whole word naming the same file (the file
 * a `Set-Content` writes), however it is spelled. A word of the commit `cmd`
 * resolves against `fileDir`, where git reads its -F paths, any other against
 * `dir`. The same text inside another word or a heredoc body stays, since it
 * is message text the file may receive. A stream such as `-` or `<(...)` is no
 * path.
 * @param {string} src @param {string[]} files @param {SimpleCommand} cmd
 * @param {string | null} fileDir @param {string | null} dir
 */
function withoutPathWords(src, files, cmd, fileDir, dir) {
  const keys = files.filter((f) => f && !isStream(f)).map((f) => pathKey(f, fileDir));
  if (keys.length === 0) return src;
  const names = (/** @type {import('./lib/shell-parse.mjs').Span} */ s) => {
    const base = s.start >= cmd.start && s.end <= cmd.end ? fileDir : dir;
    const glued = GLUED_FILE_OPTION.exec(s.value);
    return [s.value, glued ? s.value.slice(glued[0].length) : '']
      .some((v) => v && keys.includes(pathKey(v, base)));
  };
  const spans = shell.parseShell(src).flatMap((c) => c.spans).filter(names);
  let out = src;
  for (const { start, end } of spans.sort((a, b) => b.start - a.start)) out = `${out.slice(0, start)} ${out.slice(end)}`;
  return out;
}

/** @typedef {{ value: string, start: number, end: number, target: boolean }} RoughWord */

/**
 * The commands of text that does not tokenise, each a list of its words, read
 * roughly: a blank ends a word, a quote runs to its match or to the end of the
 * text, a backslash keeps the character after it in the word, and `;`, `&`,
 * `|`, `(`, `)` and a line end end a command. `target` marks a word after
 * `>` or `>>`, a file the command writes.
 * @param {string} text
 * @returns {RoughWord[][]}
 */
function roughCommands(text) {
  /** @type {RoughWord[][]} */
  const cmds = [[]];
  let target = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (' \t\r'.includes(c)) { i++; continue; }
    if (';&|()\n'.includes(c)) {
      if (cmds[cmds.length - 1].length) cmds.push([]);
      target = false;
      i++;
      continue;
    }
    if (c === '>' || c === '<') {
      target = c === '>';
      for (i++; i < text.length && '>&|'.includes(text[i]); i++);
      continue;
    }
    const start = i;
    let value = '';
    while (i < text.length && !' \t\r;&|()\n<>'.includes(text[i])) {
      const q = text[i];
      if (q === "'" || q === '"') {
        const close = text.indexOf(q, i + 1);
        const stop = close < 0 ? text.length : close;
        value += text.slice(i + 1, stop);
        i = stop + 1;
      } else if (q === '\\' && i + 1 < text.length) {
        value += text.slice(i, i + 2);
        i += 2;
      } else {
        value += q;
        i++;
      }
    }
    i = Math.min(i, text.length);
    cmds[cmds.length - 1].push({ value, start, end: i, target });
    target = false;
  }
  return cmds;
}

/**
 * messageReason over a whole command, its -F paths already left out, plus
 * `extra`. A message file that could not be read is named in the reason, or on
 * stderr when the command passes, since its content was never judged. A path
 * whose directory a `cd` made unknown is not left out: that file may be
 * anywhere, the path included.
 * @param {string} text @param {string} extra @param {string|null} unreadableFile
 */
function wholeCommandReason(text, extra, unreadableFile) {
  const reason = messageReason(`${trailerOptionsText(text)}\n${extra}`);
  if (unreadableFile === null) return reason;
  const note = `The message file '${unreadableFile}' could not be read, so its content was not judged.`;
  if (reason) return `${reason} ${note}`;
  process.stderr.write(`devkit commit-hygiene: ${note} The rest of the command passed, allowing through.\n`);
  return null;
}

/**
 * The scan of a command that does not tokenise. Each `git commit` in it, its
 * words read by roughCommands, has every -F path read, from the directory its
 * `-C` options lead to; the whole text is scanned without the words that name
 * those paths: each -F value and each `>`/`>>` target naming the same file.
 * A `cd` anywhere in it makes the base of a relative -F path unknown, so then
 * no path is left out.
 * @param {string} text @param {string | null} dir
 */
function plainTextScan(text, dir) {
  if (GIT_COMMIT_TREE.test(text)) return COMMIT_TREE_REASON;
  const unquote = (/** @type {string} */ w) => w.replace(/^["']+|["']+$/g, '');
  for (const [, name, rest] of text.matchAll(GIT_HAND_BACK)) {
    if (pushesOrMerges(unquote(name), rest.split(/\s+/).filter(Boolean).map(unquote))) return HAND_BACK_REASON;
  }
  if (!GIT_COMMIT.test(text)) return null;
  const base = DIR_WORD.test(text) ? null : dir;
  const cmds = roughCommands(text);
  /** @type {string[]} */
  const keys = [];
  /** @type {RoughWord[]} */
  const cut = [];
  let message = '';
  /** @type {string | null} */
  let unreadableFile = null;
  let located = true;
  for (const words of cmds) {
    const values = words.map((w) => w.value);
    const g = values.findIndex((v) => shell.commandName(v) === 'git');
    const sub = g < 0 ? null : gitSubcommand(values.slice(g));
    if (!sub || sub.name !== 'commit') continue;
    const fileDir = gitDir(values.slice(g), base);
    const { files, fileAt } = messageSources(sub.args);
    const first = values.length - sub.args.length;
    files.forEach((file, n) => {
      if (isStream(file)) return;
      cut.push(words[first + fileAt[n]]);
      keys.push(pathKey(file, fileDir));
      if (fileDir === null && !isAbsolutePath(file)) located = false;
      const { text: fileText, unreadable } = readMessageFile(file, fileDir);
      message += `\n${fileText ?? ''}`;
      if (unreadable && unreadableFile === null) unreadableFile = file;
    });
  }
  cut.push(...cmds.flat().filter((w) => w.target && keys.includes(pathKey(w.value, base))));
  let scanned = text;
  if (located) {
    for (const { start, end } of [...new Set(cut)].sort((a, b) => b.start - a.start)) scanned = `${scanned.slice(0, start)} ${scanned.slice(end)}`;
  }
  return wholeCommandReason(scanned, message, unreadableFile);
}

// --- judging -----------------------------------------------------------------

const MAX_DEPTH = 2;
// How many conditional `cd`s a command is judged both ways for, and the
// reserved words after which a command runs only on a condition.
const MAX_FORKS = 3;
const CONDITIONAL_WORDS = new Set(['then', 'else', 'elif', 'do']);
// Commands that never execute their arguments, so `echo git commit-tree` is
// text, and `... | tee cmd` writes a file named `cmd` rather than feeding it a script.
const NON_EXECUTING = new Set([
  'echo', 'printf', 'grep', 'egrep', 'fgrep', 'rg', 'ag', 'cat', 'less', 'man',
  'which', 'type', 'command', 'test', '[', 'true', 'false', ':', 'tee',
]);
// Start-Process's parameters by full name, those that take a value first.
const START_PROCESS_VALUES = [
  'filepath', 'argumentlist', 'credential', 'workingdirectory', 'redirectstandarderror',
  'redirectstandardinput', 'redirectstandardoutput', 'windowstyle', 'verb', 'environment',
];
const START_PROCESS_SWITCHES = ['loaduserprofile', 'nonewwindow', 'passthru', 'wait', 'usenewenvironment'];

/**
 * The command a PowerShell `Start-Process` runs, as words, `words[0]` being
 * Start-Process: its `-FilePath` (`-Path`), else its first positional word,
 * then its `-ArgumentList` (`-Args`) and later positional words, each split at
 * commas and blanks as PowerShell passes a list or a string. A parameter name
 * counts under any prefix, in any case. Null when it names no file.
 * @param {string[]} words
 * @returns {string[] | null}
 */
function startProcessWords(words) {
  /** @type {string | null} */
  let file = null;
  /** @type {string[]} */
  const args = [];
  for (let k = 1; k < words.length; k++) {
    const w = words[k];
    if (!/^-[A-Za-z]/.test(w)) {
      if (file === null) file = w;
      else args.push(w);
      continue;
    }
    const colon = w.indexOf(':');
    const name = (colon < 0 ? w.slice(1) : w.slice(1, colon)).toLowerCase();
    const full = name === 'args' ? 'argumentlist'
      : name === 'path' || name === 'pspath' ? 'filepath'
        : [...START_PROCESS_VALUES, ...START_PROCESS_SWITCHES].find((p) => p.startsWith(name));
    if (!full || START_PROCESS_SWITCHES.includes(full)) continue;
    const value = colon < 0 ? words[++k] ?? '' : w.slice(colon + 1);
    if (full === 'filepath') file = value;
    else if (full === 'argumentlist') args.push(value);
  }
  return file === null ? null : [file, ...args.flatMap((a) => a.split(/[\s,]+/).filter(Boolean))];
}

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
  /** @type {number[]} */
  const fileAt = [];
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
      if (option === 'file') { files.push(value); fileAt.push(k); }
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
      if (value !== undefined && flag === 'F') { files.push(value); fileAt.push(k); }
      break;
    }
  }
  return { texts, files, fileAt };
}

/**
 * Judges each command of `src`, which runs in `dir` (null: unknown). Text that
 * does not tokenise gets the plain-text scan of `fallback`, the text as written
 * when `src` was rewritten for the tokeniser. A `cd`-like command moves `dir`
 * for the commands after it; one inside `( )` or before a `|` runs in a
 * subshell, so its move ends at the `)` or with that command. A `)` with no
 * `(` before it, which a heredoc body's text can supply, makes `dir` unknown.
 * A `cd` that runs only on a condition -- after `&&`, `||`, `then`, `else`,
 * `elif` or `do` -- may leave `dir` as it was, so `src` is judged once with it
 * taken and once without, `taken` holding that choice for each such `cd` so
 * far; when one after `&&` is not taken, the commands chained to it by `&&` do
 * not run either. Past MAX_FORKS of them, `dir` becomes unknown.
 * @param {string} src @param {number} depth @param {string} [fallback] @param {string | null} [dir]
 * @param {boolean[]} [taken]
 * @returns {string | null}
 */
function analyse(src, depth, fallback = src, dir = baseDir, taken = []) {
  let cmds;
  try { cmds = shell.parseShell(src); } catch { return plainTextScan(fallback, dir); }
  const start = dir;
  /** @type {(string | null)[]} */
  const outer = [];
  let prevEnd = 0;
  let before = dir;
  let forks = 0;
  let skipping = false;
  for (const cmd of cmds) {
    if (cmd.start < 0) continue;
    const between = src.slice(prevEnd, cmd.start);
    if (skipping && /^\s*&&\s*$/.test(between)) { prevEnd = cmd.end; continue; }
    skipping = false;
    if (/(?<!\|)\|(?!\|)/.test(between)) dir = before;
    for (const c of between) {
      if (c === '(') outer.push(dir);
      else if (c === ')') dir = outer.length ? /** @type {string | null} */ (outer.pop()) : null;
    }
    prevEnd = cmd.end;
    const reason = judge(cmd, src, depth, dir);
    if (reason) return reason;
    before = dir;
    const words = shell.commandWords(cmd.words);
    if (!words.length || !DIR_COMMANDS.has(shell.commandName(words[0]))) continue;
    const lead = cmd.words.slice(0, cmd.words.length - words.length);
    if (/&&|\|\|/.test(between) || lead.some((w) => CONDITIONAL_WORDS.has(w))) {
      const k = forks++;
      if (k >= MAX_FORKS) { dir = null; continue; }
      if (k === taken.length) {
        return analyse(src, depth, fallback, start, [...taken, true]) ?? analyse(src, depth, fallback, start, [...taken, false]);
      }
      if (!taken[k]) { skipping = /&&\s*$/.test(between); continue; }
    }
    dir = changedDir(words, dir);
  }
  return null;
}

/** @param {SimpleCommand} cmd @param {string} src @param {number} depth @param {string | null} dir @returns {string | null} */
function judge(cmd, src, depth, dir) {
  if (depth < MAX_DEPTH) {
    for (const sub of cmd.subs) {
      const reason = analyse(sub, depth + 1, sub, dir);
      if (reason) return reason;
    }
  }
  const words = shell.commandWords(cmd.words);
  if (words.length === 0) return null;
  const head = shell.commandName(words[0]);
  if (NON_EXECUTING.has(head)) return null;
  if (shell.SHELLS.has(head) || head === 'git') return invocation(words, cmd, src, depth, dir);
  if (head === 'start-process' || head === 'saps') {
    const started = startProcessWords(words);
    const name = started ? shell.commandName(started[0]) : '';
    if (started && (shell.SHELLS.has(name) || name === 'git')) return invocation(started, cmd, src, depth, dir);
  }
  // Any other head may run its arguments (sudo, xargs, timeout, ...), so a git
  // or shell invocation among them is judged as though it led the command.
  for (let k = 1; k < words.length; k++) {
    const name = shell.commandName(words[k]);
    if (!shell.SHELLS.has(name) && name !== 'git') continue;
    const reason = invocation(words.slice(k), cmd, src, depth, dir);
    if (reason) return reason;
  }
  return null;
}

/**
 * The candidate scripts of a shell `cmd` of `src` reads from a pipe: for each
 * command before it in the pipeline, its arguments as one line (a `\n` in them
 * a line end, as printf and `echo -e` print it) and each heredoc or
 * here-string fed to it: `echo "& {git push}" | pwsh -`.
 * @param {SimpleCommand} cmd @param {string} src
 * @returns {string[]}
 */
function pipedScripts(cmd, src) {
  const cmds = shell.parseShell(src).filter((c) => c.start >= 0);
  /** @type {string[]} */
  const scripts = [];
  for (let j = cmds.findIndex((c) => c.start === cmd.start); j > 0; j--) {
    if (!/(?<!\|)\|(?!\|)/.test(src.slice(cmds[j - 1].end, cmds[j].start))) break;
    const words = shell.commandWords(cmds[j - 1].words);
    if (words.length > 1) scripts.push(words.slice(1).join(' ').replace(/\\n/g, '\n'));
    scripts.push(...cmds[j - 1].stdin);
  }
  return scripts;
}

/** @param {string} file */
function basename(file) {
  return file.slice(Math.max(file.lastIndexOf('/'), file.lastIndexOf('\\')) + 1);
}

/**
 * Judges `words`, which start with a shell or with git.
 * @param {string[]} words @param {SimpleCommand} cmd @param {string} src @param {number} depth
 * @param {string | null} dir
 * @returns {string | null}
 */
function invocation(words, cmd, src, depth, dir) {
  const name = shell.commandName(words[0]);
  if (shell.SHELLS.has(name)) {
    if (depth >= MAX_DEPTH) return null;
    const { scripts, piped } = shell.shellScripts(words, cmd);
    // Each script is read in the language of the shell that runs it, a piped one
    // as what the commands before it in the pipeline print or are fed.
    for (const script of piped ? [...scripts, ...pipedScripts(cmd, src)] : scripts) {
      const reason = name === 'pwsh' || name === 'powershell' ? analyse(shell.psForPosix(script), depth + 1, shell.psUnescape(script), dir)
        : name === 'cmd' ? analyse(shell.cmdForPosix(script), depth + 1, script, dir)
          : analyse(script, depth + 1, script, dir);
      if (reason) return reason;
    }
    // A script piped or redirected in can be written anywhere upstream.
    return piped ? plainTextScan(src, dir) : null;
  }
  const sub = gitSubcommand(words);
  if (!sub) return null;
  if (sub.name === 'commit-tree') return COMMIT_TREE_REASON;
  if (pushesOrMerges(sub.name, sub.args)) return HAND_BACK_REASON;
  if (sub.name !== 'commit') return null;
  const { texts, files } = messageSources(sub.args);
  let message = texts.join('\n');
  const elsewhere = src.slice(0, cmd.start) + src.slice(cmd.end);
  // git reads a relative path from the directory its -C options lead to.
  const fileDir = gitDir(words, dir);
  // A relative path after a `cd` or `-C` the hook cannot follow names an unknown file.
  const located = fileDir !== null || files.every((f) => isStream(f) || isAbsolutePath(f));
  for (const file of files) {
    const { text, unreadable } = readMessageFile(file, fileDir);
    // Text git reads from stdin, or from a file this call may write first, can
    // come from anywhere in the command, so the whole command is scanned.
    if (text === null || elsewhere.includes(basename(file))) {
      return wholeCommandReason(located ? withoutPathWords(src, files, cmd, fileDir, dir) : src, `${message}\n${text ?? ''}`, unreadable ? file : null);
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
  if (tool !== 'Bash' && tool !== 'PowerShell') process.exit(0);

  const command = String(evt.tool_input?.command ?? '');
  if (!command) process.exit(0);

  // The event's cwd is where a relative -F path was written: a commit run from a
  // subdirectory names its file relative to that directory.
  baseDir = evt.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();

  const reason = tool === 'Bash'
    ? analyse(command, 0)
    : analyse(shell.psForPosix(command), 0, shell.psUnescape(command));
  if (reason) deny(reason);
  process.exit(0);
}
