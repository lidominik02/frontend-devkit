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
| Success criteria | One criterion per line, each tagged SAID (a source or the user states it), ASSUMED (inferred, to be confirmed) or EXTRA (beyond what any source asks, accepted by the user — with its DECISIONS entry) |
| User flow | The steps the user takes, in order |
| Business rules | Each rule with its rationale |
| States | Loading, empty, error, permission |
| Design | The design source: its type (screenshots, a design-tool export, frames read through the design tool, or a proposal the user approved), its location or link, and how to reach it. Coverage: complete, partial (naming the screens and states it lacks), or none. "Not applicable" for a change with no UI |
| Global Constraints | Exact values every task honours — limits, sizes, names, copy — copied verbatim into PLAN.md |
| Review Focus | Implied failure modes a reviewer must check |
| Architecture fit | Existing assets to reuse, each with its path |
| Contract | The endpoints, fields and events the feature needs: which exist, which must be added, and how the frontend types them. Each gap also becomes a CONTRACT-GAPS.md entry |
| Out of scope | What this feature does not do |
| Deferred | Each deferred item with the trigger that brings it back |
| Verification seams | The observation that proves each criterion: a gate, the review, the browser, Storybook, or the user |

## List entries

DECISIONS.md, OPEN-QUESTIONS.md, CONTRACT-GAPS.md and the PROGRESS.md ledger hold one
Markdown list entry per record: a first line, then the record's fields as indented
sub-items, so a Markdown preview shows each record apart. A rule that reads these files
matches on an entry — its first line plus its sub-items — never on a single line. An older
feature may hold single-line records, the fields joined by `—`, such as
`D3 — 2026-03-14 — <decision> — <rejected> — <pointer>`; its open questions have no id and
mark an answer in free text, and its PLAN.md's Blocked by quotes a question's wording.
Every rule that reads these files reads both shapes, and every write uses the list shape. A
write that must name an older question with no id, or mark one answered, first gives it the
next free `OQ<n>` in OPEN-QUESTIONS.md.

## DECISIONS.md

An index, one entry per decision:

```
- **D<n>** · <date> · <the decision>
  - Rejected: <the rejected alternative>
  - Source: <where the reasoning lives — a SPEC section, a research note, the user's words quoted>
```

1. Source names where the reasoning lives: a SPEC section, a research note, or the user's
   words quoted.
2. A superseded entry stays as written and gains `superseded by D<m>` after the date on its
   first line, in the same write that adds D<m>, so the old entry never reads as current:
   `- **D3** · 2026-09-28 · superseded by D9 · <the decision>`. The new decision gets its
   own entry.
3. A user override of a default rule names the default it replaced under Rejected (see
   `rules-block.md`). A one-off override for a single turn gets no entry.
4. When sources disagree, the conflict becomes a question for the user. The recommended
   answer follows authority: a rule its owner confirmed, then a written spec, then the
   design, then anything derived from them — a story or notes written from the design never
   outrank the design. The answer gets an entry.

## OPEN-QUESTIONS.md

Each question gets a stable id, `OQ<n>`, so it never reads as a review's `Q<n>` quality
finding:

```
- **OQ<n>** · <the question>
  - Owner: user | product owner | designer | backend | client
  - Blocks: <task name or SPEC section> | nothing
  - Answered: D<n>          (added when a decision settles it)
```

An answered question is marked with an `Answered:` sub-item naming the DECISIONS.md entry
that settled it. PLAN.md's `Blocked by:` names an open question by its id
(`Blocked by: OQ2`), not by its wording.

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
- <date> · execution start · <mode>
  - Baseline: <gate> pass | FAIL | NOT RUN (<reason>) · …
  - Pre-execution tree: <id>
- <date> · pruned · pre-execution tree <id>
  - Answer: review from the merge-base | stopped
- <date> · <task name> · done | open
  - Skipped: <what was skipped>          (an open task only)
  - Gates: <each with its result>
  - Rounds: <n>
  - Review: <verdict line>
- <date> · blocked · <task name>
  - By: OQ<n> | <the blocked task it builds on>
- <date> · backup ref · <task name>
  - Ref: <ref> at <commit>
- <date> · baseline retaken · <task name>
  - Baseline: <gate> pass | FAIL | NOT RUN (<reason>) · …
  - Pre-execution tree: <id>
  - Outside the final review: tasks <each Done task before it> | none · conflict files <each file its conflicts changed> | none
- <date> · deferred · <task name> task review · <id> <severity>
  - Finding: <summary> (<file:line>)
- <date> · ruling · <task name> task review · <id> kept per D<n>
- <date> · ruling · plan defect in <task name>
  - Ruled: <what was ruled>
  - Decision: D<n>
- <date> · recovery tree · <id>
  - Result: every task Done | stopped before <task name>: <why>
- <date> · review held by rule · "<the rule, verbatim>"
  - Base: <tree id> | the merge-base
- <date> · deferred · <id> <severity>
  - Finding: <summary> (<file:line>)
  - Report: <review report path>
- <date> · ruling · <id> kept as designed
  - Report: <review report path>
  - Reason: <the user's reason>
- <date> · plan revised · D<n>, …
  - Changed: <task names> | none
  - Added: <task names> | none
- <date> · review · <overall line>
  - Report: <report path>
- <date> · QA list · awaiting approval
  - List: <list path>
- <date> · testing · started
  - List: <list path>
- <date> · QA report · <n> findings, <n> skipped
  - Report: <report path>
- <date> · <event kind> · <subject>
  - <Field>: <value>
```

A task is Done only when every step ran and every gate in its Done when passed. The ledger
is append-only: one entry per event, in one of the shapes above. They are grouped by the
skill that writes them: executing-plans down to the final review's `ruling`, then
planning-features, reviewing-changes and testing-changes. The last shape is for an event
no other shape covers, such as work the user did outside a session. When an Inline task's
scripted Bash edit left a file with no formatter, the task's entry gains the sub-item
`No format pass: <each such file>`.

The final review diffs from the pre-execution tree in the latest `execution start` or
`baseline retaken` entry, or from the merge-base when a `pruned` entry records that answer
for that tree. A review from the tree is told, and HANDOFF.md's Status names, what each
`baseline retaken` entry leaves out of it.

Task-review ids restart with every task and are not the final review's, so a task review's
entry names the task and carries no `Report:` sub-item. An entry about the final review
names its id and carries its report as the `Report:` sub-item, because `reviewing-changes`
sets a finding aside in `re-review` only when one entry — its first line plus its
sub-items — names both. A task-review entry therefore never sets aside a finding of the
final review.

## HANDOFF.md

The format is in `handoff-format.md`.

## research/

Notes from clarification, one file per question. Each claim names its source: a
`path:line`, a URL, or the person who said it.

## qa/

The QA test list and the QA report, written by testing-changes. Both describe the code as
it stood when they were written. A later execute stage makes them stale: in the
PROGRESS.md ledger, an `execution start` entry or a task's `done | open` entry after their
`QA list` or `QA report` entry. A `qa/` file that no ledger entry names counts as older than
every `execution start` entry. `resume` flags a stale list or report, and whoever next
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

One entry per gap:

```
- **CG<n>** · <endpoint, field, event or behaviour>
  - Needed for: <success criterion or task>
  - Status: missing | differs | unconfirmed
  - Blocks: <task> | nothing
```