---
name: testing-changes
description: >-
  Checks a feature against its acceptance criteria, from PLAN.md or any requirement
  source, through a QA list the user approves. Use when the user says "make a test list
  for this", "what should QA check", "run the QA list", "test this against the story",
  or asks if a feature is ready to ship against its acceptance criteria. For "does it
  look right in the browser" use verifying-ui; for "here is the user story" of a new
  feature, clarifying-features.
argument-hint: "[plan|run] [feature]"
disallowed-tools: mcp__*__use_figma, mcp__*__create_new_file, mcp__*__generate_figma_design, mcp__*__generate_diagram, mcp__*__generate_deck, mcp__*__upload_assets, mcp__*__add_code_connect_map, mcp__*__send_code_connect_mappings, mcp__*__create_shader, mcp__*__update_shader, mcp__*__create_generative_plugin, mcp__*__update_generative_plugin
allowed-tools: Read Write Grep Glob Skill AskUserQuestion
---

**The hold comes first, same as `verifying-ui`.** `run` does not start until the turn
carries an explicit release. If it does not, say what you would check and how long it
would likely take, then wait. `plan` mode itself is not held — deriving a list from the
requirements is not verification — but nothing in `run` executes without release.

You produce two things, in order: a test list the user approves, then a report against
that approved list. Neither step invents what it cannot find — a requirement source that
does not exist, a design nobody gave you, a Storybook that is not installed — every one of
those is a named skip, never a silent pass.

## Where the files live

`temp/<feature-slug>/qa/TEST-LIST.md` (from `plan`) and `temp/<feature-slug>/qa/REPORT.md`
(from `run`), in the repo that owns the feature. The rest of `temp/<feature>/` is laid out
in `../planning-features/references/artifacts.md`.

## Mode: `plan <feature>`

1. **Find the criteria**, from the first source that exists:
   1. `temp/<feature>/PLAN.md`'s Success criteria, each keeping its tag. SAID and EXTRA are
      criteria alike — the user accepted an EXTRA. An ASSUMED criterion is tested too, and
      the list marks it "ASSUMED — not confirmed" so the user sees it.
   2. Without them, the written requirement material: the files under `requirements/`, or
      a story the user names.
   3. With no written source, the acceptance criteria of PLAN.md's Tasks and the diff.
      **No written source is not an error**, but it is the weaker source: say so at the
      top of the list, because a QA list that does not admit its own weaker source reads
      as more authoritative than it is.

   Quote non-English text verbatim, then translate — never paraphrase over the original.
2. **Extract acceptance criteria and map cases.** One row per criterion: the positive case,
   the negative case, and the edge cases that actually matter for it — not a fixed count
   per criterion. `references/qa-test-list.md` has the format and what makes an edge case
   worth listing rather than padding.
3. **Seed cases beyond the criteria**: each Review focus entry, and each item under
   Runtime-only in `temp/<feature>/review/` — in the highest-numbered `<NN>-review.md` and
   in every `<NN>-re-review.md` numbered after it. Each becomes a case, under the criterion
   it fits, else under its own heading. Only a runtime-behaviour item becomes a browser
   case; a design-fidelity item becomes a design-intent case.
4. **Name the check that verifies each case**: browser, design intent, Storybook, or
   "user only" for what nothing here can verify (does the copy read naturally, does the
   feature actually solve the stated problem). Every case gets exactly one.
5. **If sources disagree**: a task disagreeing with the spec sections — or, without them,
   with the written requirement source — is a plan defect: that source wins, and the
   conflict is named at the top of the list. Two requirement sources disagreeing is not
   settled here: the list names the conflict with the recommendation the authority order in
   `../clarifying-features/references/question-rounds.md` gives, and the user decides.
6. Write `TEST-LIST.md`, **then stop for approval.** An unapproved list is not a mandate
   to run anything.

## Mode: `run <feature>`

1. **Confirm the list is approved.** If not, stop and ask.
2. **Establish prerequisites**, once, before running anything:
   - Browser: your own tool list carries `mcp__*__take_snapshot` or
     `mcp__*__browser_snapshot` — same authority rule as `verifying-ui`.
   - Design intent: the design source PLAN.md's Design names, and the task's Design field
     for the exact screens and states; else one the approved list names. A frame is
     reachable only through the design tool's MCP read tools in your own tool list. Design
     "not applicable" or coverage "none" makes every design-intent case a named skip with
     that reason — see `references/design-intent.md`.
   - Storybook: `package.json` has a `storybook` script (Read it).
3. **Run what has a prerequisite; skip what does not, by name, with the reason** — "no
   browser tool configured", "no Storybook script in package.json", "no design source
   reachable and none named in the plan or the list". A skip is not silence: name it in the
   report, in `Skipped`, with the same weight `Observed` gets.
4. **Browser cases**: call the Skill tool with "core:verifying-ui" for each one, driving to
   the state the case names. Do not re-implement the browser loop here.
5. **Design-intent cases**: `references/design-intent.md`, which also says what each type
   of design source can be compared on. Compare presence, hierarchy, states, token and
   naming alignment, and copy. **Never pixel parity**: a screenshot diff reports a
   deliberate divergence as a defect. A divergence is a finding only when nothing in the
   repo's decisions, ADRs or docs explains it.
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

8. **Stop.** Findings are the user's to rule on; `investigating-bugs` diagnoses one when
   asked. Fix nothing until the user approves the findings: a component that fixes what it
   finds stops checking and starts implementing. A feature's run with no findings, where
   every task in STATUS.md's Tasks table is done or blocked, calls the Skill tool with
   "core:finishing-features" instead, naming the feature, once the STATUS.md write is done.

## STATUS.md

When the feature has a STATUS.md, one write at each of three points — the Stage, a Log line,
and the Next action:

- After `plan` writes the list: Stage `QA list (awaiting approval) — owner: the user`; Log
  `<date> · QA list · <list path>`.
- When `run` starts: Stage `testing — owner: testing-changes`; Log `<date> · testing started`.
- After the report: Stage `user's check — owner: the user`; Log
  `<date> · QA report · <n> findings, <n> skipped · <report path>`.

Without a STATUS.md, nothing is written beyond the list and the report.

## What this must NOT do

- **Start `run` without an explicit release.** See the hold, above.
- **Invent a requirement, a design, or a Storybook the repository does not have.** A
  missing prerequisite is a skip, never a fabrication.
- **Score pixels.** Presence, hierarchy, states, tokens, naming, copy — never a rendered
  diff. See `references/design-intent.md` for why.
- **Fix a finding before the user approves it.**
- **Silently omit a case from the report** — Observed, Not observed, Skipped and Findings
  together must account for every case on the approved list.
- **Contain a fact about any individual repository.** Where its requirements live, whether
  it has Storybook — read at the moment of use from the project's own files.
- **Re-implement the browser loop.** `core:verifying-ui` owns it.
