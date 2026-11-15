---
type: llm
weight: 1
---

Tests that `frontend-engineering` selects its rules from the workspace's `package.json` and
reads only the selected set. Here the manifest names `react` and no `next`, so the run reads
from the `react-*` set, `react-spa-*` included, and the shared `web-review.md` only, never a
`vue-*`, `nuxt-*` or `next-*` file, and says its selection in one line. The prompt names no
framework, so only the manifest decides the selection. One of the isolation cases, with
`isolation-vue-spa`, `isolation-nuxt` and `isolation-next`.

Expected result: pass in every run. The isolation cases are with-plugin-only regression
guards on the router's selection, so a run gives a score, not a verdict on keeping or
removing a set.

## Run

Hand-run from the fixture below, with the manual `claude -p` rig of
`plugins/core/evals/README.md` ("Running them"): `core` and `frontend` loaded
with `--plugin-dir`, both plugin directories also passed with `--add-dir`, the
installed copies disabled for the run, `--strict-mcp-config` with an empty
`{"mcpServers":{}}`, `--permission-prompts none`, and the prompt's `max_turns` and
`allowed_tools`. Strip the frontmatter and the blank lines behind it, so
`/frontend:frontend-engineering` is line 1.
Load `core` and `frontend` from a copy of the working tree's `plugins/` directory, kept as
`plugins/` under a path that names none of the case, the framework or the devkit, such as
`/tmp/tree/plugins/`, and point `--plugin-dir` and `--add-dir` at that copy. Copy the fixture
into a fresh directory per run whose path names none of the case, the framework, the devkit
or the word "frontend", such as `/tmp/runs/w01`: the model sees these paths, and a name in
them is a cue the case means to leave to the prompt and the manifest. That directory is the
run's working directory, so the workspace is that directory — `.`, its name or its full path
in the selection line.

Run the with-plugin arm only, at least twice: without the `frontend` plugin there is no set
to read, so a baseline arm measures nothing here.

## Fixture

A fresh, empty directory per run, never this repository, holding one file.

`package.json`:

```json
{"dependencies":{"react":"^19.0.0","react-dom":"^19.0.0"}}
```

Rig check, before reading anything out of a run; a run that fails one is void, not a fail:

- The directory holds only `package.json`, with the content above.
- The init event lists `core@inline` and `frontend@inline`, and its `mcp_servers` is empty.
- No transcript line contains `plugins/cache`.
- The run's working directory names none of the case, the framework, the devkit or the word
  "frontend", and no `--plugin-dir` or `--add-dir` path names the case, the framework or the
  devkit above its `plugins/` directory.
- The skill fired: the run's session JSONL holds a user message that begins
  `Base directory for this skill: ` followed by a path equal to the `frontend` `--plugin-dir`
  path plus `/skills/frontend-engineering`, then the skill body; or the transcript holds a
  successful `Skill` tool result for `frontend:frontend-engineering`. A slash invocation
  under `claude -p` may make no `Skill` tool call and leave the body only in the session
  JSONL under `~/.claude/projects/`, so the run keeps session persistence (no
  `--no-session-persistence`), and the runner copies that session JSONL next to the run's
  output.
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
- (s) The assistant text holds, before the first read of a set file, at least one selection
  line, and every selection line in it is the "Say the selection" template line of
  `frontend-engineering/SKILL.md` for this row:
  `<workspace> → react-* + react-spa-* (react in package.json)`, with `<workspace>` as `.`,
  the directory's name or its full path, with or without a trailing slash. A selection line
  is a line in which `→` or `->` stands before a set name or `no set`; prose that names a set
  without that arrow is not one. Not scored: formatting around the line or its parts
  (backticks, a fenced block, bold, a list bullet), a label before the line (`Selection:`,
  `Workspace` and the like), inflection or translation of the words in
  the parentheses (`(react a package.json-ban)`), words added in them beside the package and
  `package.json` (a version range, `dependencies`, that another framework is absent), `->` in
  place of `→`, and text after the closing parenthesis. Any other difference fails: another
  set or a superset, any other workspace, a parenthetical without the package or
  `package.json`, or one saying the package is absent. A hedge, a statement that another set
  may apply to this workspace, anywhere in that assistant text fails; a remark that a set does
  not apply is not a hedge. Only the assistant text before the first read of a set file is
  scored; a selection line repeated later in the run is not.
- (r) Reads `references/react-rules.md` and `references/react-spa-rules.md`, with the first
  read of `react-rules.md` before the first read of `react-spa-rules.md`.
- (i) Reads no set file other than a `react-*` file and `references/web-review.md`: no
  `vue-*`, `nuxt-*` or `next-*` file.

Fails if it does ANY of:
- Asks which framework the project uses. → (s)

Recorded, not scored: the selection line verbatim; every set file read, in order, and the
tool that read it; any `Glob` or name-only `Grep` over `references/`; whether the answer calls
the module-scope `basket` a cross-request leak.

## Note for scoring

The case passes when every line passes in every run. (i) is the line under test; (s) and (r)
show the router ran and selected, so (i) is not met by a run that read nothing. The answer's
review content is not scored.
