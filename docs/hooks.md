# Hooks

The `core` pack ships four hooks, declared in
[`hooks.json`](../plugins/core/hooks/hooks.json). Each one starts through `run.mjs`, which
checks the Node version first ([Installation](installation.md#node)). All four are Node,
not bash: [ADR 0001](adr/0001-node-hooks-with-version-gate.md).

Each hook acts only on the tool calls its matcher selects; what falls outside every
matcher is listed under [What no hook covers](#what-no-hook-covers).

| Hook | Event | What it does |
| --- | --- | --- |
| `block-secrets.mjs` | PreToolUse | Blocks reading or sending credential material through file tools and `Bash` |
| `commit-hygiene.mjs` | PreToolUse | Blocks a commit message with an attribution trailer or a private reference, and the `git` push and merge forms it can parse |
| `format-on-write.mjs` | PostToolUse | Formats what was just written with the project's own formatter |
| `verify-before-done.mjs` | Stop | Blocks the end of a turn when a `fast` gate fails |

## `block-secrets.mjs`

Exits 2 on credential material, regardless of permission mode.

- Covers **file tools and `Bash`** — a `deny` rule does nothing about reading a dotenv file
  in a shell.
- Blocks exfiltration (upload flags, piping into a network client), interpreter one-liners,
  `source`, environment dumps and a download piped into a shell.
- Refuses hand-edits to lockfiles and `.git/`.
- Exempts `.example` / `.sample` / `.template`.
- A dotenv match requires a path context before it (start, whitespace, a quote, `=`, `/`,
  `~`), so it does not match inside `process.env` or `import.meta.env`.
- A heredoc body is stripped from the scan by locating its real closing line, not by
  truncating everything after the opening marker — truncating there would let anything
  typed after the heredoc closes through unscanned.

## `commit-hygiene.mjs`

Exits 2 on a `git commit` whose message carries an attribution trailer (`Co-Authored-By:`,
`Generated with`) or names something only Claude and the user can see: a Claude/chat
session, a handoff, a planning-artifact filename this pack's own skills write
(`HANDOFF.md`, `PROGRESS.md`, …), or a roadmap phase/artifact. A bare "session",
"roadmap", "phase N" or a decision/ADR id is deliberately not banned — each collides with
ordinary engineering vocabulary (a login session, a product's own roadmap page, a numbered
ADR a repository cites correctly). The file's own comments list exactly which forms are
matched and why.

What counts as the message:

- Every `-m`/`--message` and `--trailer` value (`key=value` read as the `key: value` git
  writes, observed on git 2.43.0) and every `-F`/`--file` text, bundled (`-am`, `-aF`) and
  abbreviated (`--mess`) spellings included.
- The commit's options and paths and the other commands on the line
  (`git add HANDOFF.md && git commit …`) are not its message.
- When the message comes from stdin, a process substitution, a `/dev/` or `/proc/` path, a
  file this hook cannot read, or a file the same command also names, the whole command is
  scanned instead, since the message may be written anywhere in it.

`git commit-tree` is denied outright, since a plumbing commit bypasses both the
repository's own hooks and these checks.

The user pushes and merges, so these are denied too, with a message telling Claude to hand
the step back:

- every `git push`, `send-pack` and `http-push`;
- a `git merge` other than a bare `git merge --abort`;
- a `git pull` without `--rebase` or `-r`, which merges (`pull.rebase` config is not read);
- `git subtree push|pull|merge|add`, `git svn dcommit|set-tree|commit-diff` and
  `git p4 submit`;
- a git subcommand given as an expansion (`git $X push`, `git "$@"`), which may be any of
  them — at the cost of denying a harmless one such as `git $X status`.

`git fetch`, `git rebase`, `git pull --rebase`, `git merge-base` and the other `merge-*`
subcommands pass.

The command is read the way a shell reads it, so quoting, a leading assignment, a wrapper
(`sudo`, `xargs`, `timeout`, …), an `env -S` string, a global option that takes a value
(`-C <path>`, `-c <k=v>`, `--git-dir`, `--config-env`, …), a `bash -c` string, a heredoc,
here-string or pipe into a shell, and a `$(…)`, backtick or `<(…)` substitution, two levels
deep, do not hide the subcommand. A message that merely names one, or a command that never
runs its arguments (`echo`, `grep`, …), is not a call to it.

Some forms stay out of reach, and the file's header lists every one: a git alias, a quoted
`eval` string, deeper nesting, a git command name produced by an expansion (`$g`,
`$(command -v git)`), a command another interpreter or task runner runs (`python3 -c`,
`node -e`, `make`, `npm run`), a git subcommand that runs another command
(`git submodule foreach`, `git rebase --exec`), a host CLI (`gh pr merge`).

## `format-on-write.mjs`

Formats what was just written with the project's own formatter, located by walking up from
the file so workspace installs are found.

- A file whose resolved path lies outside the project directory (`CLAUDE_PROJECT_DIR`, else
  the working directory) is left as written — a file in the user's auto-memory or in an
  `--add-dir` directory elsewhere, or the target of a symlink that points out of the
  project — since the walk would otherwise fall back to the project's formatter.
- Never blocks — the edit has already happened, and PostToolUse cannot block.

## `verify-before-done.mjs`

Runs the `fast` gates through [`run-gates.mjs`](scripts.md#run-gatesmjs) before the turn
can end. When one fails, it blocks with each failing gate's name, command and the end of
its output — the last 60 lines, at most 4000 characters — followed by every gate that
could not run, with its reason.

It is silent:

- when the repo has no gates, or its only gates are refused fixers;
- when nothing has changed;
- when `verifyOnStop: false` ([Per-project override](scripts.md#per-project-override));
- when the directory it checks (`CLAUDE_PROJECT_DIR`, else the event's `cwd`) is not a
  project root — it has no `package.json` or `.claude/project.json` and is not the git top
  level — even if the gates at the top level fail.

It honours `stop_hook_active` so it cannot loop. It skips the gates when the repository's
tracked and untracked non-ignored files are unchanged since the last passing run in the
same session — a change only to ignored files, such as generated types, is not detected,
and a failing run is never remembered, so an unchanged red tree still blocks. It exits
silently while a background subagent is running; a background shell such as a dev server
never skips the gates. Its git calls and the gates share a 190-second budget inside the
hook's 200-second timeout.

## What no hook covers

Three coverage holes no matcher can close:

- An `@file` reference in a prompt inserts file contents with no tool call at all. Close it
  with a `Read(...)` deny rule in project settings.
- A file written by Bash never fires a PostToolUse hook.
- `block-secrets` matches file tools and `Bash`, so **no MCP tool is covered by it**.

The third one matters as soon as a browser MCP is attached. A file input reached through
`upload_file` (`browser_file_upload` on Playwright) sends a local file to a page, and from
there to the network, with no hook firing anywhere on the path. `verifying-ui` therefore
grants the tools that look at a page and deliberately withholds the upload and
`evaluate_script` tools, so both still prompt — the same shape as `describing-changes`
withholding `git commit`.

There is no SessionStart hook: [ADR 0003](adr/0003-facts-read-at-moment-of-use.md).
