# The artifact contract

A feature keeps its state in files, so a session that remembers nothing can continue it,
in the repo that owns most of the feature.

```
temp/<feature>/
├── PLAN.md            always
├── STATUS.md          always
├── DECISIONS.md       always; open questions at the top, decisions below
├── CONTRACT-GAPS.md   only when the feature involves the API
├── research/          one cited note per question (shape below)
├── review/            NN-review.md, NN-re-review.md (reviewing-changes writes them)
├── qa/                TEST-LIST.md, REPORT.md (testing-changes writes them)
└── tasks/             task briefs and task diffs (executing-plans writes them)
```
A `requirements/` or `design/` folder the user puts there is input. When `temp/` is not
gitignored, say so once, when the folder is created; the artifacts are never `git add`ed.

**Reading.** STATUS.md and PLAN.md whole; DECISIONS.md and CONTRACT-GAPS.md by id, with
grep — the `D<n>`, `OQ<n>` or `CG<n>` entry a step names, never the whole file; a research
note by its `Answer:` line first.

## PLAN.md

Every section is present, in this order, "none" where empty:

```
# Plan: <feature-slug>

## Outcome · ## Sources · ## Constraints
## Success criteria        one per line: SC<n> · <criterion> — SAID | ASSUMED | EXTRA
## User flow · ## Business rules (each with its rationale) · ## States (transitions, errors, permissions; loading and empty only for UI work)
## Design                  type, location, coverage | not applicable
## Global constraints      exact values, copied into every task that uses them
## Review focus            failure modes no acceptance criterion covers, each → task name
## Architecture fit        existing assets to reuse, each with its path
## Out of scope · ## Deferred (each with its trigger)
## Tasks
### Task: <name>
Files: create <path> · modify <path>
Interfaces: consumes <exact names> · produces <exact names>
Design: <screens and states, or none>
Acceptance criteria: - SC<n>: <observable, from that success criterion>
Steps: 1. <what to decide or produce, and where>
Done when: <each fast gate's command, with its workspace when there are several, or "no gates declared"> pass, and <the observation that proves the criteria>
Blocked by: <task names | OQ<n> | none>
Tier: mechanical | judgment
```

Above `## Tasks` is the spec (clarifying-features writes it); Tasks is the plan
(planning-features). A step decides or produces something, and where; a code block only for
an algorithm the interfaces do not fix, or copy the spec fixes verbatim. No commit step.

## DECISIONS.md

Append-only; nothing moves, nothing is deleted. A user override of a default rule names the
default under Rejected (`rules-block.md`).
```
# Decisions: <feature-slug>

## Open questions
- OQ<n> · <question> · owner: <who> · blocks: <task> | nothing
  (answered: D<n> is appended to the line when a decision settles it; the line stays)

## Decisions
- D<n> · <date> · <decision>
  - Rejected: <the alternative>
  - Source: <a PLAN section, a research note, the user's words quoted>
  (a later decision that replaces this one appends `· superseded by D<m>` to this first line
  and names `supersedes D<n>` on its own; both stay where they are)
```

## CONTRACT-GAPS.md

Only when the feature involves an external contract — anything this repository cannot
deliver alone;
append-only. A report for the user, who decides who receives it and in what form.
```
# Contract gaps: <feature-slug>
- CG<n> · <endpoint, field, event or behaviour> · missing | differs | unconfirmed
  - Needed for: <success criterion, task, or the fix of <slug>>
  - Blocks: <task> | nothing
```

## STATUS.md

```
# Status: <feature-slug>

Stage: clarify | plan (awaiting approval) | execute (task N/M, <mode>) | review | user reads code + findings | fix findings | QA list (awaiting approval) | testing | user's check | finish — owner: <skill or the user>
Rules: the default rules block | the user's own: <verbatim>
Mode: subagent per task | inline | not chosen
Delivery: <verified | accepted with known gaps | blocked> · confidence <high | partial | low> — <the SCs without run evidence>   (finishing-features writes it)

## Tasks
| Task | Status | Gates | Review |
| --- | --- | --- | --- |
| <name> | not started · in progress · done · blocked (OQ<n>) | <gate line>; <gate line> | <verdict line> |

## Verified
baseline: <gate line>; <gate line>
latest: <gate line>; <gate line>
pre-execution tree: <id> · end-of-run tree: <id>
by hand: <what>

## Evidence
- SC<n> · <gate line | QA: TC<n> <result> | task: <name>> | none (<why>)

## Closed findings
- <report path> <id> — deferred | kept as designed (<reason>) | not ours (<owner>)

## Log
- <date> · <one free line per event: execution start, task done, review written, sync, fix, finish>

## Next action
<one action, and who takes it>

## Kickoff prompt
Resume the feature <slug> with the planning-features skill, in resume mode. Read first:
temp/<slug>/STATUS.md, then temp/<slug>/PLAN.md, the task "<name>", then <any file the next
action needs>. Next action: <the action>. Rules: <each governing rule, written out>.
```

## The rules of these files

A gate line is `<workspace> · <command> · <source> · <result>`, as `## Gates` in
`project.md` reports it; the Tasks table's Gates cell and `Verified`'s `baseline:` and
`latest:` join several with `; `. The Log is append-only, one free line per event, with no
fixed shape. The Tasks table is the
only place a task is Done. An Evidence line is
`SC<n> · <gate line | QA: TC<n> <result> | task: <name>> | none (<why>)`, one piece of
evidence for one success criterion; a criterion may carry several. Two skills write it:
`executing-plans` when a task closes, for each `SC<n>` its acceptance criteria name — the
task's gate lines and `task: <name>`; `testing-changes` after its report, for the `SC<n>`
each `TC<n>` names — `QA: TC<n> observed | not observed | skipped | finding`. A later line
adds, never replaces: no writer edits or deletes a line another wrote. `finishing-features`
only reads it. An open finding is a CONFIRMED or PLAUSIBLE one of the latest
review, or a NOT ADDRESSED or new one of a re-review after it, that no Closed findings line
closes. DECISIONS.md and
CONTRACT-GAPS.md never move or delete an entry, and a new id follows the highest one. A
research note keeps its shape: `Date`, `Answer:` in at most five lines, `Evidence`,
`Unsettled`.

A feature written under the six-file layout is carried over by hand once: paste SPEC.md into
PLAN.md's spec sections and PLAN.md's tasks after them, OPEN-QUESTIONS.md above
DECISIONS.md's entries, HANDOFF.md and PROGRESS.md's task table into STATUS.md, and move
the old `archive/` folder's entries back into their files; the old files stay as the user's archive.
