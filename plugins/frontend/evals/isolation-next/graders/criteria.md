---
type: llm
weight: 1
---

Tests that `frontend-engineering` selects its rules from the workspace's `package.json` and
reads only the selected set. Here the manifest names `next` and `react`, for which no set
exists yet, so the run reads no `vue-*` or `nuxt-*` file, and says its selection in one line.
One of three isolation cases, with `isolation-vue-spa` and `isolation-nuxt`; the three are
run together.

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
{"dependencies":{"next":"^16.0.0","react":"^19.0.0"}}
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
transcript order.

Passes if it does ALL of:
- (s) The assistant text holds, before the first read of a set file if it makes one, one
  selection line in the shape the skill gives: the workspace, `→`, `no set`, and in
  parentheses the manifest fact that decided the row — `next` in `package.json`:
  `. → no set (next in package.json)`. A line that names `vue-*` or `nuxt-*`, or hedges
  between sets, fails.
- (i) Reads no `vue-*` or `nuxt-*` file.

Fails if it does ANY of:
- Asks which framework the project uses. → (s)

Recorded, not scored: the selection line verbatim; any file under `references/` read anyway,
and the tool that read it; any `Glob` or name-only `Grep` over `references/`; whether the
answer recommends a Vue or Nuxt API (`ref`, `useState`, a composable) for this code.

## Note for scoring

The case passes when every line passes in every run. (i) is the line under test. With no
set, (s) and the rig check's skill-fired line are what show the router ran, so a run without
the selection line fails, and a run where the skill never fired is void, even when it read
nothing. The answer's review content is not scored.
