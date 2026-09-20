#!/usr/bin/env node
// PreToolUse hook -- denies a `git commit` whose message carries an
// attribution trailer, or names something that exists only between the
// user and Claude (a session, a handoff file, a roadmap artifact, a phase
// or a decision id). Both are the specific failures the user reported: a
// commit message is read by another developer, who has no access to either.
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
// Limitation, stated rather than hidden: a message given via `-F <file>` or
// `--file <file>` is read from disk relative to this hook's own working
// directory, which is not guaranteed to match the Bash tool's -- a message
// file in a path that does not resolve from here is not inspected. The
// observed failure mode (six commits over one month, three after the first
// objection) was always inline `-m` text, often a multi-line string built
// with a heredoc substitution, which this scans directly.

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

// Requires whitespace or end-of-string right after "commit" so `git
// commit-graph` and `git commit-tree` -- real subcommands, not `git commit`
// with a suffix -- are never matched.
const GIT_COMMIT = /\bgit\s+(?:-[^\s]+\s+)*commit(?:\s|$)/;

// A generic-word denylist, deliberately: naming a private project would make
// this list itself a disclosure of it, which is the rule every check in this
// repository that would otherwise need repo-specific names already follows.
const TRAILERS = [
  { re: /co-?authored-?by\s*:/i, label: 'a Co-Authored-By trailer' },
  { re: /generated\s+with\b/i, label: 'a "Generated with" line' },
];
// Literal artifact filenames the planning skill writes into every consuming
// repository -- this is the workflow's own naming convention, not a
// project's content, so matching them carries none of the disclosure risk a
// denylist of real names would.
const ARTIFACT_FILES = /\b(?:HANDOFF|PROGRESS|DECISIONS|MASTER-PLAN|OPEN-QUESTIONS|ASSUMPTIONS|IMPLEMENTATION-PLAN)\.md\b/;

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

/** @param {string} command */
function fileMessageText(command) {
  const m = command.match(/(?:^|[;&|]|\s)-F\s*([^\s;&|]+)|--file[=\s]+([^\s;&|]+)/);
  if (!m) return '';
  const p = m[1] ?? m[2];
  if (!p || p === '-') return ''; // "-F -" reads stdin, which this cannot see
  try {
    if (!existsSync(p)) return '';
    return readFileSync(p, 'utf8');
  } catch { return ''; }
}

/** @param {string} input */
function main(input) {
  /** @type {any} */
  let evt = {};
  try { evt = JSON.parse(input); } catch { process.exit(0); }

  const tool = String(evt.tool_name ?? '');
  if (tool !== 'Bash') process.exit(0);

  const command = String(evt.tool_input?.command ?? '');
  if (!command || !GIT_COMMIT.test(command)) process.exit(0);

  // Everything after "git commit" is candidate message text -- including
  // inside a heredoc, which is where a multi-line -m argument commonly
  // lives. Unlike block-secrets.mjs, nothing here should be exempted from
  // scanning: a heredoc body is exactly where the text this hook cares about
  // usually is.
  const fileText = fileMessageText(command);
  const scanned = command + '\n' + fileText;

  for (const { re, label } of TRAILERS) {
    if (re.test(scanned)) {
      deny(`that commit message carries ${label}. No attribution trailer on any commit, in any repository.`);
    }
  }
  for (const { re, label } of LEAK_WORDS) {
    if (re.test(scanned)) {
      deny(`that commit message names ${label}. A commit message is read by another developer, who has no access to a session, a handoff file, a roadmap artifact, a phase or a decision id -- write what the change does and why instead.`);
    }
  }

  process.exit(0);
}
