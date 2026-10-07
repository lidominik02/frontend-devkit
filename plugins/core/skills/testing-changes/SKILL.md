---
name: testing-changes
description: >-
  Checks a feature against its acceptance criteria, from SPEC.md or any requirement
  source, through a QA list the user approves. Use when the user says "make a test list
  for this", "what should QA check", "run the QA list", "test this against the story",
  or asks if a feature is ready to ship against its acceptance criteria. For "does it
  look right in the browser" use verifying-ui; for "here is the user story" of a new
  feature, clarifying-features.
argument-hint: "[plan|run] [feature]"
disallowed-tools: mcp__*__use_figma, mcp__*__create_new_file, mcp__*__generate_figma_design, mcp__*__generate_diagram, mcp__*__generate_deck, mcp__*__upload_assets, mcp__*__add_code_connect_map, mcp__*__send_code_connect_mappings, mcp__*__create_shader, mcp__*__update_shader, mcp__*__create_generative_plugin, mcp__*__update_generative_plugin
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/project-facts.mjs) Read Write Grep Glob Skill AskUserQuestion
---

**The hold comes first, same as `verifying-ui`.** `run` does not start until the turn
carries an explicit release. If it does not, say what you would check and how long it
would likely take, then wait. `plan` mode itself is not held — deriving a list from the
requirements is not verification — but nothing in `run` executes without release.

You produce two things, in order: a test list the user approves, then a report against
that approved list. Neither step invents what it cannot find — a requirement source that
does not exist, a design nobody gave you, a Storybook that is not installed — every one of
those is a named skip, never a silent pass.

## Where the artifacts live

`temp/<feature-slug>/qa/TEST-LIST.md` (from `plan`) and `temp/<feature-slug>/qa/REPORT.md`
(from `run`), in the repo that owns the feature. The rest of `temp/<feature>/` — SPEC.md
and PLAN.md under `planning/`, `requirements/`, `design/`, `review/` — is laid out in
`../planning-features/references/artifacts.md`.

## Mode: `plan <feature>`

1. **Find the criteria**, from the first source that exists:
   1. `temp/<feature>/planning/SPEC.md`: its Success criteria, each keeping its tag. SAID
      and EXTRA are criteria alike — the user accepted an EXTRA. An ASSUMED criterion is
      tested too, and the list marks it "ASSUMED — not confirmed" so the user sees it.
   2. Without a SPEC, the written requirement material: the files under
      `temp/<feature>/requirements/`, or the path `project-facts`'s `userStoryPath`
      reports; an old-format feature's `temp/<feature>/user-story.md` still counts.
   3. With no written source, the acceptance criteria of PLAN.md's tasks — an old-format
      feature's phase files, as `handoff-format.md` maps them — and the diff.
      **No written source is not an error**, but it is the weaker source: say so at the
      top of the list, because a QA list that does not admit its own weaker source reads
      as more authoritative than it is.

   Quote non-English text verbatim, then translate — never paraphrase over the original.
2. **Extract acceptance criteria and map cases.** One row per criterion: the positive case,
   the negative case, and the edge cases that actually matter for it — not a fixed count
   per criterion. `references/qa-test-list.md` has the format and what makes an edge case
   worth listing rather than padding.
3. **Seed cases beyond the criteria**: each SPEC Review Focus entry, and each item under
   Runtime-only in `temp/<feature>/review/` — in the highest-numbered `<NN>-review.md` and
   in every `<NN>-re-review.md` numbered after it, since a re-review covers only its fix
   diff — which names what the static review could not check. Each becomes a case, under
   the criterion it fits, else under its own heading in the list.
   Only a runtime-behaviour item becomes a browser case; a design-fidelity item becomes a
   design-intent case.
4. **Name the check that verifies each case**: browser, design intent, Storybook, or
   "user only" for what nothing here can verify (does the copy read naturally, does the
   feature actually solve the stated problem). Every case gets exactly one.
5. **If sources disagree**: PLAN.md disagreeing with SPEC.md — or, without a SPEC, with the
   written requirement source — is a plan defect: that source wins, and the conflict is
   named at the top of the list. Two requirement sources disagreeing is not settled here:
   the list names the conflict with the recommendation the artifact contract's authority
   order gives, and the user decides at approval.
6. Write `TEST-LIST.md`, **then stop for approval.** An unapproved list is not a mandate
   to run anything.

## Mode: `run <feature>`

1. **Confirm the list is approved.** If not, stop and ask.
2. **Establish prerequisites**, once, before running anything:
   - Browser: your own tool list carries `mcp__*__take_snapshot` or
     `mcp__*__browser_snapshot` — same authority rule as `verifying-ui`.
   - Design intent: the design source SPEC Design names, and the PLAN.md task's Design
     field for the exact screens and states; else one the approved list names. A frame is
     reachable only through the design tool's MCP read tools in your own tool list. SPEC
     Design "not applicable" or coverage "none" makes every design-intent case a named
     skip with that reason. Never require a project-local design skill; use one only if
     it exists — see `references/design-intent.md`.
   - Storybook: `project-facts`'s `storybook.declared`.
3. **Run what has a prerequisite; skip what does not, by name, with the reason** — "no
   browser tool configured", "no Storybook script in package.json", "no design source
   reachable and none named in SPEC.md, the plan or the list". A skip is not silence: name
   it in the report, in `Skipped`, with the same weight `Observed` gets.
4. **Browser cases**: call the Skill tool with "core:verifying-ui" for each one, driving to
   the state the case names. Do not re-implement the browser loop here — it already exists
   and already holds its own honesty rules.
5. **Design-intent cases**: `references/design-intent.md`, which also says what each type
   of design source can be compared on. Compare presence, hierarchy, states, token and
   naming alignment, and copy. **Never pixel parity** — the active repo's own decisions
   record that a screenshot diff reports a deliberate divergence as a defect. A divergence
   is a finding only when nothing in the repo's decisions, ADRs or docs explains it.
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
- <check>: <the one-line reason — no browser tool, no Storybook script, no reachable design>

### Findings
- <case> — what is wrong, why, and the evidence

### Clean
<cases with no findings>
```

8. **Offer the investigation** when Findings holds at least one entry, once `REPORT.md`
   and the Lifecycle writes below are done: one AskUserQuestion form, "Investigate their
   causes in parallel (recommended)" or "Not now". The first calls the Skill tool with
   "core:investigating-bugs" in its batch mode, naming the feature and `REPORT.md`'s path.
   It comes after every write because that skill blocks the file tools. It reports a
   cause and a next step per finding, and stops. With no findings there is no form.
9. **Stop.** Fix nothing until the user approves the findings; whether and how to fix
   them is the user's decision, made after the investigation when one ran.
   `reviewing-changes` reports and stops for the same reason: a component that fixes what
   it finds stops checking and starts implementing. A feature's run with no findings,
   where PROGRESS.md's task table shows every task Done or Blocked, calls the Skill tool
   with "core:finishing-features" instead, naming the feature, once the Lifecycle writes
   are done.

## Lifecycle

When the feature has `temp/<feature>/planning/HANDOFF.md`, update its stage at three
points, rewrite its next action and kickoff prompt to match
(`../planning-features/references/handoff-format.md`), and add one PROGRESS.md ledger entry
for each:

- After `plan` writes the list: `QA list (awaiting approval) — owner: the user`; ledger
  `- <date> · QA list · awaiting approval` with the sub-item `- List: <list path>`.
- When `run` starts: `testing — owner: testing-changes`; ledger
  `- <date> · testing · started` with the sub-item `- List: <list path>`.
- After the report: `user's check — owner: the user`; ledger
  `- <date> · QA report · <n> findings, <n> skipped` with the sub-item
  `- Report: <report path>`.

An entry that takes the ledger past 60 entries moves closed tasks' entries to
planning/archive/PROGRESS.md in the same write, by "The archive" in
`../planning-features/references/artifacts.md`.

Without a HANDOFF.md, nothing is written beyond the list and the report.

## What this must NOT do

- **Start `run` without an explicit release.** See the hold, above.
- **Invent a requirement, a design, or a Storybook the repository does not have.** A
  missing prerequisite is a skip, never a fabrication.
- **Score pixels.** Presence, hierarchy, states, tokens, naming, copy — never a rendered
  diff. See `references/design-intent.md` for why.
- **Fix a finding before the user approves it.** Report and wait, the same discipline
  `reviewing-changes` holds.
- **Silently omit a case from the report** — Observed, Not observed, Skipped and Findings
  together must account for every case on the approved list.
- **Contain a fact about any individual repository.** What a project's design tool is
  keyed as, where its requirements live, whether it has Storybook — all read at the moment
  of use from `project-facts` and the project's own files, never assumed here.
- **Re-implement the browser loop.** `core:verifying-ui` owns it: call the Skill tool with
  "core:verifying-ui".
