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
// separators, heredoc bodies -- so only a real invocation of one of those git
// subcommands is judged. Unless the command is led by one that
// never runs its arguments (echo, grep, cat, ...), a git or shell invocation
// among its arguments counts too, which covers sudo, xargs, timeout and the
// like, and `env -S` has its string split into words. A shell's script is followed two levels deep, whether it comes from
// `-c`, a heredoc or a here-string, and so are `$(...)`, backtick and `<(...)`
// substitutions. When a shell reads its script from a pipe or a `<` redirect,
// the whole command gets a plain-text scan instead.
//
// A commit is judged on its message alone: each -m/--message and --trailer
// value and each -F/--file text, bundled (-am, -aF) and abbreviated (--mess)
// spellings included, never its options or paths. A message read from stdin
// or a process substitution, or from a file this hook cannot read or that
// the same command also names, may be written anywhere in the command, so
// the whole command is scanned instead, each `--trailer key=value` in it
// (git interpret-trailers' too) read as the `key: value` git 2.43.0 writes.
// A -F path resolves against this hook's own working directory, which need
// not match the Bash tool's.
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
// `--rebase` or `-r` on the command line. A command that does not tokenise
// falls back to a plain-text scan of the whole string.

import { readFileSync, existsSync } from 'node:fs';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', () => {
  try {
    main(raw);
  } catch (err) {
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

/**
 * A message file's text, or null when this hook cannot read it: stdin (`-`),
 * a device, a process substitution, or a path that does not resolve from here.
 * A /dev/ or /proc/ path names a stream of the Bash call, never read here.
 * @param {string} p
 */
function readMessageFile(p) {
  if (p === '-' || /^\/(?:dev|proc)\//.test(p) || /^[<>]\(/.test(p)) return null;
  try {
    return existsSync(p) ? readFileSync(p, 'utf8') : null;
  } catch { return null; }
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
  return messageReason(trailerOptionsText(text) + '\n' + ((file && readMessageFile(file)) ?? ''));
}

// --- shell tokeniser --------------------------------------------------------

/**
 * `subs` holds the text of each substitution in the command, `stdin` each
 * heredoc body and here-string fed to it, and `piped` marks a command whose
 * stdin is a pipe or a `<` redirect.
 * @typedef {{ words: string[], start: number, end: number, subs: string[], stdin: string[], piped: boolean }} SimpleCommand
 */
/** @typedef {{ delim: string, strip: boolean, into: string[] | null }} Heredoc */

const META = new Set([' ', '\t', '\n', ';', '&', '|', '<', '>', '(', ')']);

class Unparsable extends Error {}

/**
 * Splits `src` into simple commands, each word with its quoting removed, and
 * collects the text of every `$(...)`, backtick or `<(...)` substitution met
 * on the way. Throws Unparsable on an unterminated quote or substitution.
 * @param {string} src
 * @returns {SimpleCommand[]}
 */
function parseShell(src) {
  const n = src.length;
  /** @type {SimpleCommand[]} */
  const cmds = [];
  /** @type {Heredoc[]} */
  const heredocs = [];
  // Heredocs in a substitution with no delimiter line past the scan position;
  // the scan only moves forward, so an entry never goes stale.
  /** @type {Set<string>} */
  const absent = new Set();
  /** @returns {SimpleCommand} */
  const blank = () => ({ words: [], start: -1, end: -1, subs: [], stdin: [], piped: false });
  let cur = blank();
  let i = 0;
  let redirectTarget = false;
  let hereString = false;
  let lastWordEnd = -1;

  /** @returns {never} */
  const fail = () => { throw new Unparsable(); };

  const endCommand = () => {
    cur.end = i;
    cmds.push(cur);
    cur = blank();
    redirectTarget = false;
    hereString = false;
  };

  /** @param {number} j */
  const processSubstitutionAt = (j) => (src[j] === '<' || src[j] === '>') && src[j + 1] === '(';

  /**
   * Reads a heredoc operator's delimiter, with `i` just past its `<<`, or
   * returns null when no word follows it.
   * @param {string[] | null} into @returns {Heredoc | null}
   */
  const heredoc = (into) => {
    const strip = src[i] === '-';
    if (strip) i++;
    while (src[i] === ' ' || src[i] === '\t') i++;
    if (i >= n || META.has(src[i])) return null;
    return { delim: word(), strip, into };
  };

  /**
   * Reads the heredoc body that starts at `i`: its text and the offset where
   * shell text resumes, or null when no delimiter line comes. Inside a
   * substitution, a line that starts with the delimiter and a `)` also ends
   * the body, and the `)` stays syntax, as bash 5.2.21 reads it.
   * @param {Heredoc} h @param {boolean} inSub
   * @returns {{ body: string, next: number, paren: boolean } | null}
   */
  const heredocBody = ({ delim, strip }, inSub) => {
    let body = '';
    for (let at = i; at < n;) {
      let eol = src.indexOf('\n', at);
      if (eol < 0) eol = n;
      const line = src.slice(at, eol);
      const text = strip ? line.replace(/^\t+/, '') : line;
      if (text === delim) return { body, next: eol + 1, paren: false };
      if (inSub && text.startsWith(`${delim})`)) return { body, next: eol - text.length + delim.length, paren: true };
      body += `${line}\n`;
      at = eol + 1;
    }
    return null;
  };

  /** Consumes each pending heredoc body; one whose delimiter never comes takes the rest. @param {Heredoc[]} pending */
  const heredocBodies = (pending) => {
    for (const h of pending) {
      const read = heredocBody(h, false);
      h.into?.push(read?.body ?? src.slice(i));
      i = read?.next ?? n;
    }
    pending.length = 0;
  };

  /**
   * Consumes the heredoc bodies pending inside a substitution. One whose
   * delimiter line never comes was a shift (`$((1<<2))`), not an operator, so it
   * takes no body and the word read as its delimiter stands as text. A body
   * that ends at `delim)` leaves the heredocs after it for the next line.
   * @param {Heredoc[]} pending
   */
  const substitutionBodies = (pending) => {
    let k = 0;
    while (k < pending.length) {
      const h = pending[k++];
      const key = `${+h.strip}${h.delim}`;
      const read = absent.has(key) ? null : heredocBody(h, true);
      if (!read) { absent.add(key); continue; }
      i = read.next;
      if (read.paren) break;
    }
    pending.splice(0, k);
  };

  const single = () => {
    const close = src.indexOf("'", i + 1);
    if (close < 0) fail();
    const s = src.slice(i + 1, close);
    i = close + 1;
    return s;
  };

  const ansiC = () => {
    let out = '';
    for (i += 2; i < n; i++) {
      if (src[i] === '\\') { out += src[++i] ?? ''; continue; }
      if (src[i] === "'") { i++; return out; }
      out += src[i];
    }
    return fail();
  };

  const backtick = () => {
    let out = '';
    for (i++; i < n; i++) {
      if (src[i] === '\\') { out += src[++i] ?? ''; continue; }
      if (src[i] === '`') { i++; return out; }
      out += src[i];
    }
    return fail();
  };

  // Returns the text between `$(` (or `<(`, `>(`) and its matching `)`. A
  // heredoc body inside is skipped, since its quotes and parens are not syntax.
  const substitution = () => {
    i += 2;
    const from = i;
    let depth = 1;
    /** @type {Heredoc[]} */
    const pending = [];
    while (i < n) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === "'") { single(); continue; }
      if (c === '"') { double(false); continue; }
      if (c === '`') { backtick(); continue; }
      if (src.startsWith('<<<', i)) { i += 3; continue; }
      if (src.startsWith('<<', i)) {
        i += 2;
        const h = heredoc(null);
        if (h) pending.push(h);
        continue;
      }
      if (c === '\n') { i++; substitutionBodies(pending); continue; }
      if (c === '(') depth++;
      else if (c === ')' && --depth === 0) { i++; return src.slice(from, i - 1); }
      i++;
    }
    return fail();
  };

  /** @param {boolean} collect whether substitutions found here belong to this command */
  const double = (collect) => {
    let out = '';
    i++;
    while (i < n) {
      const c = src[i];
      if (c === '"') { i++; return out; }
      if (c === '\\' && '"\\$`\n'.includes(src[i + 1] ?? 'x')) {
        if (src[i + 1] !== '\n') out += src[i + 1];
        i += 2;
        continue;
      }
      if ((c === '$' && src[i + 1] === '(') || c === '`') {
        const at = i;
        const inner = c === '`' ? backtick() : substitution();
        if (collect) cur.subs.push(inner);
        out += src.slice(at, i);
        continue;
      }
      out += c;
      i++;
    }
    return fail();
  };

  const word = () => {
    let out = '';
    while (i < n && (!META.has(src[i]) || processSubstitutionAt(i))) {
      const c = src[i];
      if (c === "'") out += single();
      else if (c === '"') out += double(true);
      else if (c === '\\') { if (src[i + 1] !== '\n') out += src[i + 1] ?? ''; i += 2; }
      else if (c === '$' && src[i + 1] === "'") out += ansiC();
      else if ((c === '$' && src[i + 1] === '(') || c === '`' || processSubstitutionAt(i)) {
        const at = i;
        cur.subs.push(c === '`' ? backtick() : substitution());
        out += src.slice(at, i);
      } else { out += c; i++; }
    }
    return out;
  };

  const redirection = () => {
    // A descriptor glued to the operator (2>&1) belongs to it, not to the arguments.
    if (lastWordEnd === i && /^\d+$/.test(cur.words[cur.words.length - 1] ?? '')) cur.words.pop();
    if (src.startsWith('<<<', i)) { i += 3; redirectTarget = true; hereString = true; return; }
    if (src.startsWith('<<', i)) { i += 2; heredocs.push(heredoc(cur.stdin) ?? fail()); return; }
    if (src[i] === '&') i++; // &> and &>>
    else if (src[i] === '<') cur.piped = true; // stdin from a file or a process substitution
    i++;
    if (i < n && '>&|'.includes(src[i])) i++;
    redirectTarget = true;
  };

  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === '\\' && src[i + 1] === '\n') { i += 2; continue; }
    if (c === '\n') { endCommand(); i++; heredocBodies(heredocs); continue; }
    if (c === '#') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === ';' || c === '(' || c === ')') { endCommand(); i++; continue; }
    if (c === '|') {
      const or = src[i + 1] === '|';
      endCommand();
      cur.piped = !or;
      i += or || src[i + 1] === '&' ? 2 : 1;
      continue;
    }
    if (c === '&' && src[i + 1] !== '>') { endCommand(); i += src[i + 1] === '&' ? 2 : 1; continue; }
    if ((c === '<' || c === '>' || c === '&') && !processSubstitutionAt(i)) { redirection(); continue; }
    const at = i;
    const w = word();
    if (redirectTarget) {
      if (hereString) cur.stdin.push(w);
      redirectTarget = false;
      hereString = false;
    } else {
      if (cur.start < 0) cur.start = at;
      cur.words.push(w);
    }
    lastWordEnd = i;
  }
  endCommand();
  return cmds;
}

// --- judging -----------------------------------------------------------------

const MAX_DEPTH = 2;
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*\+?=/;
const RESERVED = new Set(['!', '{', 'if', 'then', 'else', 'elif', 'do', 'while', 'until']);
const WRAPPERS = new Set(['command', 'exec', 'nohup', 'time']);
// Commands that never execute their arguments, so `echo git commit-tree` is text.
const NON_EXECUTING = new Set([
  'echo', 'printf', 'grep', 'egrep', 'fgrep', 'rg', 'ag', 'cat', 'less', 'man',
  'which', 'type', 'command', 'test', '[', 'true', 'false', ':',
]);
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh']);

/** The words from the command name on, past assignments and wrappers. @param {string[]} input */
function commandWords(input) {
  let words = input;
  let k = 0;
  while (k < words.length) {
    const w = words[k];
    if (ASSIGNMENT.test(w) || RESERVED.has(w)) { k++; continue; }
    if (w === 'env') {
      k++;
      while (k < words.length && (ASSIGNMENT.test(words[k]) || words[k].startsWith('-'))) {
        const split = envSplitString(words, k);
        if (split) {
          words = [...words.slice(0, k), ...split.words, ...words.slice(k + split.width)];
          continue;
        }
        k += ['-u', '-C', '--unset', '--chdir'].includes(words[k]) ? 2 : 1;
      }
      continue;
    }
    if (WRAPPERS.has(w)) {
      if (w === 'command' && /^-[A-Za-z]*[vV]/.test(words[k + 1] ?? '')) break; // looks up, never runs
      k++;
      while (k < words.length && words[k].startsWith('-')) k += w === 'exec' && words[k] === '-a' ? 2 : 1;
      continue;
    }
    break;
  }
  return words.slice(k);
}

/**
 * The words of an `env -S` / `--split-string` string at `words[k]`, and how
 * many words the option spans, or null when `words[k]` is another option.
 * @param {string[]} words @param {number} k
 * @returns {{ words: string[], width: number } | null}
 */
function envSplitString(words, k) {
  const w = words[k];
  let text;
  let width = 1;
  if (w === '-S' || w === '--split-string') { text = words[k + 1] ?? ''; width = 2; }
  else if (/^-S./.test(w)) text = w.slice(2);
  else if (w.startsWith('--split-string=')) text = w.slice('--split-string='.length);
  else return null;
  try {
    return { words: parseShell(text)[0]?.words ?? [], width };
  } catch {
    return { words: text.split(/\s+/).filter(Boolean), width };
  }
}

/**
 * Where a shell invocation reads its script: the `-c` string, or stdin when
 * there is no `-c` and no script-file operand (or `-s` is given).
 * @param {string[]} words
 */
function shellInput(words) {
  let k = 1;
  let hasC = false;
  let hasS = false;
  while (k < words.length) {
    const w = words[k];
    if (w === '--') { k++; break; }
    if (/^[-+][oO]$/.test(w)) { k += 2; continue; }
    if (/^-[A-Za-z]+$/.test(w)) {
      if (w.includes('c')) hasC = true;
      if (w.includes('s')) hasS = true;
      k++;
      continue;
    }
    if (w.startsWith('-') || w.startsWith('+')) { k++; continue; }
    break;
  }
  return { script: hasC ? words[k] ?? null : null, stdin: !hasC && (hasS || k >= words.length) };
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
  try { cmds = parseShell(src); } catch { return plainTextScan(src); }
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
  const words = commandWords(cmd.words);
  if (words.length === 0) return null;
  const head = basename(words[0]);
  if (NON_EXECUTING.has(head)) return null;
  if (SHELLS.has(head) || head === 'git') return invocation(words, cmd, src, depth);
  // Any other head may run its arguments (sudo, xargs, timeout, ...), so a git
  // or shell invocation among them is judged as though it led the command.
  for (let k = 1; k < words.length; k++) {
    const name = basename(words[k]);
    if (!SHELLS.has(name) && name !== 'git') continue;
    const reason = invocation(words.slice(k), cmd, src, depth);
    if (reason) return reason;
  }
  return null;
}

/** @param {string} word */
function basename(word) {
  return word.slice(word.lastIndexOf('/') + 1);
}

/**
 * Judges `words`, which start with a shell or with git.
 * @param {string[]} words @param {SimpleCommand} cmd @param {string} src @param {number} depth
 * @returns {string | null}
 */
function invocation(words, cmd, src, depth) {
  if (SHELLS.has(basename(words[0]))) {
    if (depth >= MAX_DEPTH) return null;
    const { script, stdin } = shellInput(words);
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
    const text = readMessageFile(file);
    // Text git reads from stdin, or from a file this call may write first, can
    // come from anywhere in the command, so the whole command is scanned.
    if (text === null || elsewhere.includes(basename(file))) {
      return messageReason(`${trailerOptionsText(src)}\n${message}\n${text ?? ''}`);
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

  const reason = analyse(command, 0);
  if (reason) deny(reason);
  process.exit(0);
}
