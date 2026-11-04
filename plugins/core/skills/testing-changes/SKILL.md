---
name: testing-changes
description: >-
  Checks a feature against its acceptance criteria, from PLAN.md or any requirement
  source, through a QA list the user approves. Use when the user says "make a test list
  for this", "what should QA check", "run the QA list", "test this against the story",
  or asks if a feature is ready to ship against its acceptance criteria. For "here is the
  user story" of a new feature, use clarifying-features.
argument-hint: "[plan|run] [feature]"
allowed-tools: Bash(git rev-parse *) Read Write Grep Glob Skill AskUserQuestion
---

**The hold comes first, same as `verifying-ui`.** `run` does not start until the turn
carries an explicit release. If it does not, say what you would check and how long it
would likely take, then wait. `plan` mode itself is not held — deriving a list from the
requirements is not verification — but nothing in `run` executes without release.

You produce two things, in order: a test list the user approves, then a report against
that approved list. Neither step invents what it cannot find — a requirement source that
does not exist, a design nobody gave you, a check this session cannot run — every one of
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
   it fits, else under its own heading. Only a runtime-behaviour item becomes a
   `web: browser` case; a design-fidelity item becomes a `web: design intent` case.
4. **Name the checks that verify each case**, by the labels in `references/qa-test-list.md`,
   or "user only" for what nothing here can verify (does the copy read naturally, does the
   feature actually solve the stated problem). A case gets one or more checks, and
   states `pre`, `data` and `retest` (`none` when there is nothing to state).
5. **If sources disagree**: a task disagreeing with the spec sections — or, without them,
   with the written requirement source — is a plan defect: that source wins, and the
   conflict is named at the top of the list. Two requirement sources disagreeing is not
   settled here: the list names the conflict with the recommendation the authority order in
   `../clarifying-features/references/question-rounds.md` gives, and the user decides.
6. Write `TEST-LIST.md`, **then stop for approval.** An unapproved list is not a mandate
   to run anything.

## Mode: `run <feature>`

1. **Confirm the list is approved.** If not, stop and ask.
2. **Establish the prerequisite**, once, before running anything: the `web:` cases need
   `frontend:verifying-ui` among this session's skills. When it is not listed, say once
   "frontend plugin not enabled in this session", and skip every `web:` case by name with
   that reason.
3. **Run what has a prerequisite; skip what does not, by name, with the reason.** A skip is
   not silence: name it in the report, in `Skipped`, with the same weight `Observed` gets.
4. **`web:` cases**: call the Skill tool with "frontend:verifying-ui" and the arguments
   `report`, for each case, naming its label and the state the case names. It checks each mode's
   prerequisite and reports a skip with its reason; that skip goes to `Skipped`. Do not
   re-implement its checks here.
5. **`command` cases** run by the gate rule in `../planning-features/references/project.md`
   (`## Gates` steps 2–4, `## Held checks`): a command or a file or git read that only reads
   runs; a test or a build runs only when this run's release names it, else it is skipped
   as held; a command that writes, or one in doubt, never runs and is skipped with the
   command named. The evidence is the command and an extract of its output.
6. **Write `REPORT.md`**, one section per case category. A case with more than one check
   gets one line per check, `TC<n> · <check>: …`, in the section that check's result
   belongs to; it is Clean only when every check of it was observed with no finding.

```
## QA report: <feature>

### Observed
- TC<n>: <what was actually seen, with the evidence — a snapshot detail, a story path, a command and its output>

### Not observed
- TC<n>: <why it could not be reached — needs data, needs auth>

### Skipped
- <check>: <the one-line reason, as `verifying-ui` gave it, or "frontend plugin not enabled in this session"> — TC<n>, …

### Findings
- TC<n> / SC<n> — <one-line title>
  - Steps: <the steps that reproduce it>
  - Expected: <what the case or criterion requires>
  - Actual: <what was seen>
  - Evidence: <snapshot detail, story path, or command and its output>
  - Environment: <URL or command, build or branch, browser, data, user role>

### Clean
<TC<n> of the cases with no findings>
```

7. **Stop.** Findings are the user's to rule on. After the report, when there are findings,
   ask one multi-select form listing each finding, nothing pre-checked. Each finding checked
   goes, as its bug report, to the Skill tool with "core:investigating-bugs", which only
   diagnoses. Fix nothing until the user approves the findings: a component that fixes what
   it finds stops checking and starts implementing. A feature's run with no findings, where
   every task in STATUS.md's Tasks table is done or blocked, calls the Skill tool with
   "core:finishing-features" instead, naming the feature, once the STATUS.md write is done.

## STATUS.md

When the feature has a STATUS.md, one write at each of three points — the Stage, a Log line,
and the Next action:

- After `plan` writes the list: Stage `QA list (awaiting approval) — owner: the user`; Log
  `<date> · QA list · <list path>`.
- When `run` starts: Stage `testing — owner: testing-changes`; Log `<date> · testing started`.
- After the report: Stage `user's check — owner: the user`; Log
  `<date> · QA report · <hash> · <n> findings, <n> skipped · <report path>`, the hash from
  `git rev-parse --short HEAD`; and in `## Evidence`
  one line per case whose heading names an `SC<n>`, appended beside the lines already
  there, never over them:
  `SC<n> · <gate line | QA: TC<n> <result> | task: <name>> | none (<why>)`, here
  `SC<n> · QA: TC<n> observed | not observed | skipped | finding`.

Without a STATUS.md, nothing is written beyond the list and the report.

## What this must NOT do

- **Start `run` without an explicit release.** See the hold, above.
- **Invent a requirement, a design, or a result for a check that could not run.** A
  missing prerequisite is a skip, never a fabrication.
- **Fix a finding before the user approves it.**
- **Run a `command` case that writes**, or a test or a build the release does not name.
- **Silently omit a case from the report** — Observed, Not observed, Skipped and Findings
  together must account for every case on the approved list.
- **Contain a fact about any individual repository.** Where its requirements live, whether
  it has a design source — read at the moment of use from the project's own files.
- **Re-implement a `web:` check.** `frontend:verifying-ui` owns them.
