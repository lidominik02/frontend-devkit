---
type: llm
weight: 1
---

Tests that `frontend-engineering` selects its rules from the workspace's `package.json` and
reads only the selected set. Here the manifest names `vue` and no `nuxt`, so the run reads
from the `vue-*` and `vue-spa-*` sets and the shared `web-review.md` only, never a `nuxt-*`
file, and says its selection in one line. The prompt is identical to `isolation-nuxt`'s and names no
framework, so only the manifest can tell the two cases apart. One of three isolation cases,
with `isolation-nuxt` and `isolation-next`; the three are run together.

Expected result: pass in every run. The three isolation cases are with-plugin-only
regression guards on the router's selection, so a run gives a score, not a verdict on
keeping or removing a set.

## Run

Hand-run from the fixture below, with the manual `claude -p` rig of
`plugins/core/evals/README.md` ("Running them"): `core` and `frontend` loaded from the
working tree with `--plugin-dir`, both plugin directories also passed with `--add-dir`, the
installed copies disabled for the run, `--strict-mcp-config` with an empty
`{"mcpServers":{}}`, `--permission-prompts none`, and the prompt's `max_turns` and
`allowed_tools`. Strip the frontmatter and the blank lines behind it, so
`/frontend:frontend-engineering` is line 1. The run's working directory is the fixture
directory, so the workspace is that directory — `.` or its name in the selection line.

Run the with-plugin arm only, at least twice: without the `frontend` plugin there is no set
to read, so a baseline arm measures nothing here. The automated harness does not fit: on CLI
2.1.310, `claude plugin eval` loaded `frontend` but ran the case in a directory with no
`package.json`, and the router answered `no set (no package.json)`.

## Fixture

A fresh, empty directory per run, never this repository, holding one file.

`package.json`:

```json
{"dependencies":{"vue":"^3.5.0"}}
```

Rig check, before reading anything out of a run; a run that fails one is void, not a fail:

- The directory holds only `package.json`, with the content above.
- The init event lists `core@inline` and `frontend@inline`, and its `mcp_servers` is empty.
- No transcript line contains `plugins/cache`.
- The skill fired: the run's session JSONL holds a user message that begins
  `Base directory for this skill: ` followed by a path equal to the `frontend` `--plugin-dir`
  path plus `/skills/frontend-engineering`, then the skill body; or the transcript holds a
  successful `Skill` tool result for `frontend:frontend-engineering`. On CLI 2.1.310 a slash
  invocation under `claude -p` makes no `Skill` tool call, and the body appears only in the
  session JSONL under `~/.claude/projects/`, not in the `stream-json` output. So the run
  keeps session persistence (no `--no-session-persistence`), and the runner copies that
  session JSONL next to the run's output.
- No `Skill` call was denied, and no Read of a file under the loaded plugin directories was
  denied for lying outside the run's directory.

## Criteria

A **read** of a set file is a tool call that targets a file under
`plugins/frontend/skills/frontend-engineering/references/` or returns its content: a `Read`,
a `Grep` that returns lines of it, a `Bash` `cat`, `head`, `sed` or the like. An attempt
counts whether or not it was allowed. A `Glob` or a `Grep` that returns only file names is
not a read; record it. The skill body the slash invocation loads is not a read. Order is
transcript order. A read of `references/web-review.md`, the review findings every set
shares, is accepted and is not required.

Passes if it does ALL of:
- (s) The assistant text holds, before the first read of a set file, one selection line in
  the shape the skill gives: the workspace, `→`, `vue-*` + `vue-spa-*`, and in parentheses the
  manifest fact that decided the row — `vue` in `package.json`, with or without saying `nuxt`
  is absent: `. → vue-* + vue-spa-* (vue in package.json)`. A line that names `vue-*` alone,
  selects `nuxt-*`, or hedges between sets, fails.
- (r) Reads `references/vue-rules.md` and `references/vue-spa-rules.md`, with the first read
  of `vue-rules.md` before the first read of `vue-spa-rules.md`.
- (i) Reads no `nuxt-*` file.

Fails if it does ANY of:
- Asks which framework the project uses. → (s)

Recorded, not scored: the selection line verbatim; every set file read, in order, and the
tool that read it; any `Glob` or name-only `Grep` over `references/`; whether the answer calls
the module-scope `shortlist` a cross-request leak.

## Note for scoring

The case passes when every line passes in every run. (i) is the line under test; (s) and (r)
show the router ran and selected, so (i) is not met by a run that read nothing. The answer's
review content is not scored: a verdict on the module-scope ref is `module-scope-state`'s
question.
