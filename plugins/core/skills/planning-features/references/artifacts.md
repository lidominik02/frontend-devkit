# The artifact contract

A feature keeps its state in files, so a session with no memory of an earlier one can
continue it. Every skill in the feature lifecycle reads and writes this one layout, in the
repo that owns most of the feature.

```
temp/<feature>/
├── requirements/        optional input from the user: any written requirement material
├── design/              optional input from the user: any design material
├── planning/
│   ├── SPEC.md
│   ├── DECISIONS.md
│   ├── OPEN-QUESTIONS.md
│   ├── PLAN.md
│   ├── PROGRESS.md
│   ├── HANDOFF.md
│   ├── research/        cited notes
│   └── CONTRACT-GAPS.md when the feature needs something from the API
├── tasks/               execution: one brief and one report per task
├── review/              review reports
└── qa/                  the QA test list and report, owned by testing-changes
```

When `temp/` is not gitignored in that repo, say so once, when the folder is created. The
artifacts are never `git add`ed.

## SPEC.md

Written by clarifying-features; PLAN.md is built from it alone. The section names are
fixed, in this order:

| Section | Holds |
| --- | --- |
| Sources | Each requirement source the feature was clarified from — a written spec, a ticket, the user's notes, the conversation — with its location and who can confirm it; "none" when only the design and the repo were available. The design source is in Design |
| Outcome | What the user can do once the feature ships, and why it matters |
| Constraints | The limits the feature works within: platform, compatibility, dependencies, dates |
| Success criteria | One criterion per line, each tagged SAID (a source or the user states it), ASSUMED (inferred, to be confirmed) or EXTRA (beyond what any source asks, accepted by the user — with its DECISIONS line) |
| User flow | The steps the user takes, in order |
| Business rules | Each rule with its rationale |
| States | Loading, empty, error, permission |
| Design | The design source: its type (screenshots, a design-tool export, frames read through the design tool, or a proposal the user approved), its location or link, and how to reach it. Coverage: complete, partial (naming the screens and states it lacks), or none. "Not applicable" for a change with no UI |
| Global Constraints | Exact values every task honours — limits, sizes, names, copy — copied verbatim into PLAN.md |
| Review Focus | Implied failure modes a reviewer must check |
| Architecture fit | Existing assets to reuse, each with its path |
| Contract | The endpoints, fields and events the feature needs: which exist, which must be added, and how the frontend types them. Each gap also becomes a CONTRACT-GAPS.md line |
| Out of scope | What this feature does not do |
| Deferred | Each deferred item with the trigger that brings it back |
| Verification seams | The observation that proves each criterion: a gate, the review, the browser, Storybook, or the user |

## DECISIONS.md

An index, one line per decision:

```
D<n> — <date> — <decision> — <rejected alternative> — <pointer to the reasoning>
```

1. The pointer names where the reasoning lives: a SPEC section, a research note, or the
   user's words quoted.
2. A superseded line stays as written and gains "superseded by D<m>" in the same write that
   adds D<m>, so the old line never reads as current; the new decision gets its own line.
3. A user override of a default rule names the default it replaced as the rejected
   alternative (see `rules-block.md`). A one-off override for a single turn gets no line.
4. When sources disagree, the conflict becomes a question for the user. The recommended
   answer follows authority: a rule its owner confirmed, then a written spec, then the
   design, then anything derived from them — a story or notes written from the design never
   outrank the design. The answer gets a line.

## OPEN-QUESTIONS.md

```
- <question> — owner: user | product owner | designer | backend | client — blocks: <task or SPEC section>
```

An answered question is marked with the DECISIONS.md line that settled it.

## PLAN.md

The format is in `plan-format.md`.

## PROGRESS.md

A task table, then a conflicts section, then a ledger. Conflicts, written by executing-plans
at pre-flight, lists each file more than one task modifies with those tasks, and each
interface a task consumes with the task that produces it.

```
| Task | Tier | Status | Brief | Report |
| --- | --- | --- | --- | --- |
| <name> | mechanical | Not started · In progress · Done · Blocked | tasks/… | tasks/… |

## Conflicts

## Ledger
- <date> — execution start — <mode> — baseline: <gate> pass | FAIL | NOT RUN (<reason>) · … — pre-execution tree <id>
- <date> — pre-execution tree <id> pruned — review from the merge-base | stopped
- <date> — <task name> — done | open: <what was skipped> — gates: <each with its result> — rounds <n> — review: <verdict line>
- <date> — blocked — <task name> — by: <the open question> | <the blocked task it builds on>
- <date> — backup ref — <task name> — <ref> at <commit>
- <date> — baseline retaken — <task name> — baseline: <gate> pass | FAIL | NOT RUN (<reason>) · … — pre-execution tree <id> — outside the final review: tasks <each Done task before it> | none · conflict files <each file its conflicts changed> | none
- <date> — deferred — <task name> task review <id> <severity>: <summary> (<file:line>)
- <date> — ruling — <task name> task review <id> kept per D<n>
- <date> — ruling — plan defect in <task name>: <what was ruled> — D<n>
- <date> — recovery tree <id> — every task Done | stopped before <task name>: <why>
- <date> — review held by rule — "<the rule, verbatim>" — base: <tree id> | the merge-base
- <date> — deferred — <id> <severity>: <summary> — <review report path>
- <date> — ruling — <id> kept as designed — <review report path> — <the user's reason>
- <date> — plan revised — D<n> · … — changed: <task names> | none — added: <task names> | none
- <date> — review — <overall line> — <report path>
- <date> — QA list — awaiting approval — <list path>
- <date> — testing — started — <list path>
- <date> — QA report — <n> findings, <n> skipped — <report path>
- <date> — <event> — <what happened>
```

A task is Done only when every step ran and every gate in its Done when passed. The ledger
is append-only: one line per event, in one of the shapes above. They are grouped by the
skill that writes them: executing-plans down to the final review's `ruling`, then
planning-features, reviewing-changes and testing-changes. The last shape is for an event
no other shape covers, such as work the user did outside a session. An Inline task whose
scripted Bash edit left a file with no formatter ends its line with
`— no format pass: <each such file>`.

The final review diffs from the pre-execution tree in the latest `execution start` or
`baseline retaken` line, or from the merge-base when a `pruned` line records that answer
for that tree. A review from the tree is told, and HANDOFF.md's Status names, what each
`baseline retaken` line leaves out of it.

Task-review ids restart with every task and are not the final review's, so a task review's
line names the task and no report path. A line about the final review names its id and its
report, because `reviewing-changes` sets a finding aside in `re-review` only when one line
names both.

## HANDOFF.md

The format is in `handoff-format.md`.

## research/

Notes from clarification, one file per question. Each claim names its source: a
`path:line`, a URL, or the person who said it.

## qa/

The QA test list and the QA report, written by testing-changes. Both describe the code as
it stood when they were written. A later execute stage makes them stale: in the
PROGRESS.md ledger, an `execution start` line or a task's `done | open` line after their
`QA list` or `QA report` line. A `qa/` file that no ledger line names counts as older than
every `execution start` line. `resume` flags a stale list or report, and whoever next
rewrites HANDOFF.md's Status names it as predating that work. Until testing-changes runs
again, it is evidence about the code as it stood, not as it is.

## CONTRACT-GAPS.md

Written whenever the feature involves the API — anything the frontend cannot deliver on its
own: the design or the story asks for something the API does not provide, the API's
behaviour has to change, or a defect is not only the frontend's. A task confined to the
frontend — a design defect, frontend logic, a correct API response the frontend mishandles —
needs none.

It is a report for the user: it tells them the frontend work needs an API change, whoever
owns the API. What happens to it next — who receives it, in what form — is the user's
decision; nothing here sends it, reformats it or copies it anywhere else.

One line per gap:

```
- <endpoint, field, event or behaviour> — needed for: <success criterion or task> — status: missing | differs | unconfirmed — blocks: <task or none>
```