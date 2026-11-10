---
type: llm
weight: 1
---

Tests whether `frontend-engineering` fires on its description alone: a React question with
no slash invocation and no skill name, in English (`prompt.md`) and in Hungarian
(`prompt.hu.md`). The two prompts carry the same request and the same code; the language is
the only variable. One of the trigger cases, with `trigger-vue`, `trigger-nuxt` and
`trigger-next`.

The prompts are in a deliberately realistic register, and their prose avoids the router
description's own vocabulary — its symptom phrases, the framework's name — wherever a
natural alternative exists. The framework shows only in the code and in its own API and file
names, so a fire is earned on the request, not on echoed wording.

Expected result: the skill fires in every run of both arms. This is a with-plugin-only case
whose result is a rate, a score, not a verdict on keeping or removing the skill.

## Run

Hand-run from the fixture below, with the manual `claude -p` rig of
`plugins/core/evals/README.md` ("Running them"): `core` and `frontend` loaded from the
working tree with `--plugin-dir`, both plugin directories also passed with `--add-dir`, the
installed copies disabled for the run, `--strict-mcp-config` with an empty
`{"mcpServers":{}}`, `--permission-prompts none`, and the prompt's `max_turns` and
`allowed_tools`. Strip the frontmatter and the blank lines behind it. The run's working
directory is the fixture directory, so the workspace is that directory — `.` or its name in
the selection line.

Run the with-plugin arm only, 5 runs per prompt file: without the `frontend` plugin there is
no skill to fire, so a baseline arm measures nothing here. The Hungarian arm is hand-run
only.

## Fixture

A fresh, empty directory per run, never this repository, holding one file.

`package.json`:

```json
{"dependencies":{"react":"^19.0.0","react-dom":"^19.0.0"}}
```

Rig check, before reading anything out of a run; a run that fails one is void, not a fail:

- The directory holds only `package.json`, with the content above.
- No line of the prompt sent starts with a slash invocation — `/` followed by a name, not a
  `//` code comment — and the prompt does not name `frontend-engineering`.
- The init event lists `core@inline` and `frontend@inline`, beside them only `@builtin`
  plugins, and its `mcp_servers` is empty. Another plugin carrying a React skill would
  compete for the same request.
- No transcript line contains `plugins/cache`.
- No `Skill` call was denied, and no Read of a file under the loaded plugin directories was
  denied for lying outside the run's directory.

Recorded with the rig check, not voiding: which user-level instructions applied
(`~/.claude/CLAUDE.md`, `~/.claude/rules/`) and which user-level skills the init event
lists, as `plugins/core/evals/README.md` describes. A language instruction there reaches the
Hungarian arm most.

## Criteria

The **diagnosis** is the first assistant text that states a cause.

Passes if it does ALL of:
- (f) The transcript holds a `Skill` tool call naming `frontend:frontend-engineering` (or
  `frontend-engineering`), with a successful result, before the diagnosis. A call that
  follows another skill's call counts as a fire.
- (s) After it fires, the assistant text holds one selection line in the shape
  `<workspace> → <set> (<manifest fact>)`, in either arm's language: the workspace as `.` or
  the directory's name, `→`, `react-* + react-spa-*`, and in parentheses the manifest fact
  that decided the row — `react` in `package.json`:
  `. → react-* + react-spa-* (react in package.json)`. A translated parenthetical passes only
  if it names the same manifest fact. A line that selects `next-*` or `react-*` alone, or
  hedges between sets, fails.

Fails if it does ANY of:
- Never calls `frontend-engineering`. → (f)
- Asks which framework the project uses after it fired. → (s)

Recorded per run, as one outcome:
- **fired** — (f) holds.
- **late-fire** — `frontend-engineering` is called only after the diagnosis; (f) fails.
- **no-fire-and-answers** — no `Skill` call at all, and the answer gives a diagnosis.
  Reading the skill's `SKILL.md` with `Read` instead of calling `Skill` is a no-fire.
- **no-fire-and-asks** — no `Skill` call at all, and the answer asks a question instead,
  which framework included.
- **wrong-skill-only** — `Skill` calls, none to `frontend-engineering`.
- **stall** — no call, no diagnosis, no question: the run ends or hits `max_turns`.

Recorded, not scored: the arm (`en` or `hu`); every `Skill` call, in order, with its input
verbatim; the selection line verbatim; every file under `references/` read, in order;
whether the answer names the filtered list frozen in `useState` as the cause.

## Note for scoring

Report per arm, `en` and `hu` separately, the (f) fire rate and the (s) rate, each as `n` of
5. (f) is the line under test; (s) shows the router ran to its selection once fired. A rate
below 5/5 is recorded as the result, not a void. The answer's diagnosis is not scored.
