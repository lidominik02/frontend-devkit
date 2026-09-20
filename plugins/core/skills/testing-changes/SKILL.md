---
name: testing-changes
description: >-
  Lifecycle steps 6 and 7: a QA test list derived from the user story and approved by the
  user, then three checks against that approved list — a browser check, a design-intent
  comparison against the design tool, and a Storybook check — each skipping itself out
  loud when its prerequisite is absent. Two modes: `plan <feature>` derives acceptance
  criteria and positive/negative/edge cases and stops for approval; `run <feature>` runs
  the approved checks and reports Observed, Not observed, Skipped and Findings. Use when
  the user says "make a test list for this", "what should QA check", "run the QA list",
  "test this against the story", or asks whether a feature is ready to ship against its
  acceptance criteria. Verification does not start until the user releases it — see the
  hold below — so being asked something adjacent is not enough to begin `run`.
argument-hint: "[plan|run] [feature]"
disallowed-tools: mcp__figma__use_figma, mcp__figma__create_new_file, mcp__figma__generate_figma_design, mcp__figma__generate_diagram, mcp__figma__generate_deck, mcp__figma__upload_assets, mcp__figma__add_code_connect_map, mcp__figma__send_code_connect_mappings, mcp__figma__create_shader, mcp__figma__update_shader, mcp__figma__create_generative_plugin, mcp__figma__update_generative_plugin
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/project-facts.mjs) Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.mjs *) Read Write Grep Glob Skill
---

**The hold comes first, same as `verifying-ui`.** `run` does not start until the turn
carries an explicit release. If it does not, say what you would check and how long it
would likely take, then wait. `plan` mode itself is not held — deriving a list from a
story is not verification — but nothing in `run` executes without release.

You produce two things, in order: a test list the user approves, then a report against
that approved list. Neither step invents what it cannot find — a story that does not
exist, a design frame nobody gave you, a Storybook that is not installed — every one of
those is a named skip, never a silent pass.

## Where the artifacts live

`temp/<feature-slug>/qa/TEST-LIST.md` (from `plan`) and `temp/<feature-slug>/qa/REPORT.md`
(from `run`), in the repo that owns the feature — the same convention
`core:planning-features` uses for its own artifacts.

## Mode: `plan <feature>`

1. **Find the story.** `.claude/project.json`'s `userStoryPath` override, else
   `temp/<feature>/user-story.md`. Quote non-English text verbatim, then translate — never
   paraphrase over the original. **No story found is not an error**: derive the list from
   the phase plan and the diff instead, and say so at the top of the list, because a QA
   list that does not admit its own weaker source reads as more authoritative than it is.
2. **Extract acceptance criteria and map cases.** One row per criterion: the positive case,
   the negative case, and the edge cases that actually matter for it — not a fixed count
   per criterion. `references/qa-test-list.md` has the format and what makes an edge case
   worth listing rather than padding.
3. **Name the check that verifies each case**: browser, design intent, Storybook, or
   "user only" for what nothing here can verify (does the copy read naturally, does the
   feature actually solve the stated problem). Every case gets exactly one.
4. **If the story and the phase plan disagree**, the story wins — it is closer to what the
   feature is actually for — and record the conflict rather than silently picking one.
5. Write `TEST-LIST.md`, **then stop for approval.** An unapproved list is not a mandate
   to run anything.

## Mode: `run <feature>`

1. **Confirm the list is approved.** If not, stop and ask.
2. **Establish prerequisites**, once, before running anything:
   - Browser: your own tool list carries `mcp__*__take_snapshot` or
     `mcp__*__browser_snapshot` — same authority rule as `verifying-ui`.
   - Design intent: a frame reachable through the design tool's MCP tools in your own
     tool list, or a frame id the plan named. Never require a project-local design skill;
     use one only if it exists — see `references/design-intent.md`.
   - Storybook: `project-facts`'s `storybook.declared`.
3. **Run what has a prerequisite; skip what does not, by name, with the reason** — "no
   browser tool configured", "no Storybook script in package.json", "no design reference
   reachable and none named in the plan". A skip is not silence: name it in the report,
   in `Skipped`, with the same weight `Observed` gets.
4. **Browser cases**: invoke `core:verifying-ui` for each one, driving to the state the
   case names. Do not re-implement the browser loop here — it already exists and already
   holds its own honesty rules.
5. **Design-intent cases**: `references/design-intent.md`. Compare presence, hierarchy,
   states, token and naming alignment, and copy. **Never pixel parity** — the active
   repo's own decisions record that a screenshot diff reports a deliberate divergence as
   a defect. A divergence is a finding only when nothing in the repo's decisions, ADRs or
   docs explains it.
6. **Storybook cases**: `references/storybook-check.md`. A touched shared component has a
   story, it renders in both themes, and its `argTypes` match its props.
7. **Write `REPORT.md`**, one section per case category:

```
## QA report: <feature>

### Observed
- <case>: <what was actually seen, with the evidence — a snapshot detail, a story path>

### Not observed
- <case>: <why it could not be reached — needs data, needs auth>

### Skipped
- <check>: <the one-line reason — no browser tool, no Storybook script, no reachable frame>

### Findings
- <case> — what is wrong, why, and the evidence

### Clean
<cases with no findings — never omit a case silently>
```

8. **Stop.** Fix nothing until the user approves the findings — this mirrors
   `core:reviewer`'s report-then-wait shape exactly, for the same reason: a component
   that fixes what it finds stops checking and starts implementing.

## What this must NOT do

- **Start `run` without an explicit release.** See the hold, above.
- **Invent a story, a design frame, or a Storybook the repository does not have.** A
  missing prerequisite is a skip, never a fabrication.
- **Score pixels.** Presence, hierarchy, states, tokens, naming, copy — never a rendered
  diff. See `references/design-intent.md` for why.
- **Fix a finding before the user approves it.** Report and wait, the same discipline
  `core:reviewer` holds.
- **Silently omit a case from the report** — Observed, Not observed, Skipped and Findings
  together must account for every case on the approved list.
- **Contain a fact about any individual repository.** What a project's design tool is
  keyed as, where its story lives, whether it has Storybook — all read at the moment of
  use from `project-facts` and the project's own files, never assumed here.
- **Re-implement the browser loop.** `core:verifying-ui` owns it; invoke it.
