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
│   ├── archive/         entries moved out of the live files
│   └── CONTRACT-GAPS.md when the feature needs something from the API
├── tasks/               execution: one brief and one report per task
├── review/              review reports
└── qa/                  the QA test list and report, owned by testing-changes
```

When `temp/` is not gitignored in that repo, say so once, when the folder is created. The
artifacts are never `git add`ed.

## Reading the artifacts

The main thread — the session the user works in — reads only what its next step needs, so a
long feature's history stays on disk instead of in its context. HANDOFF.md's read-first list
is the entry point; no file map is kept.

| Artifact | The main thread reads | Only workers or grep read |
| --- | --- | --- |
| HANDOFF.md | Always | — |
| PROGRESS.md | The task table and the latest ledger entries | The older ledger entries and planning/archive/PROGRESS.md: a step that matches an older entry, such as `re-review`'s set-aside, greps for it |
| DECISIONS.md | By id: the entries a step names | The whole file — whether something is already decided is a grep — and planning/archive/DECISIONS.md |
| OPEN-QUESTIONS.md | The open entries | planning/archive/OPEN-QUESTIONS.md |
| research/ | A note's short answer first, its `Answer:`; a section of its evidence only for a claim the step needs | The whole note |
| Diffs, raw review output and worker reports | Never | Workers read them whole; a step that needs a diff's header or stat lines, or one line of a report, greps for those lines |

An id a step follows — a decision a task cites, a question a task is blocked by, a ledger
entry that set a finding aside — that the live file no longer holds is looked up by that id
in planning/archive/, as "The archive" says. SPEC.md, PLAN.md, CONTRACT-GAPS.md, the review
reports and the `qa/` files are read as each skill's steps say; a review report is the
merged report, not raw review output.

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

## The archive

planning/archive/ holds the entries the live files no longer need, so DECISIONS.md keeps
only the decisions in force, OPEN-QUESTIONS.md only the open questions, and the ledger its
working set. Nothing is deleted: a moved entry keeps its id and its text and is appended, in
its original order, to the file of the same name under archive/, which the first move
creates with a heading such as `# Decisions — <feature> — superseded`. The skill whose write
triggers a move makes it in that same write. A new id is the next one free across the live
file and its archive, so an id never names two entries.

1. **A superseded decision** moves to planning/archive/DECISIONS.md when D<m> supersedes
   it, with `superseded by D<m>` after the date on its first line:
   `- **D3** · 2026-09-28 · superseded by D9 · <the decision>`. The new entry names what it
   supersedes on its own first line:
   `- **D9** · 2026-09-30 · supersedes D3 · <the decision>`.
2. **An answered question** moves to planning/archive/OPEN-QUESTIONS.md when it gains its
   `Answered: D<n>` sub-item.
3. **The ledger past 60 entries.** An append that leaves the PROGRESS.md ledger with more
   than 60 entries moves the entries of closed tasks to planning/archive/PROGRESS.md,
   wherever in the ledger they sit. A closed task is one the task table marks Done; its
   entries are the `done | open`, `blocked`, `backup ref` and task-review `deferred`
   entries that name it. These stay:
   - open work — every entry about a task that is not Done;
   - rulings — every `ruling` entry;
   - recent events — the latest 20 entries;
   - the final review's base — every `execution start`, `baseline retaken`, `sync` and
     `pruned` entry.

   An entry that names no task never moves either. When nothing is left to move the ledger
   stays past 60, and each later append checks again.

A rule that needs history looks it up by id in archive/: `re-review`'s set-aside searches
planning/archive/PROGRESS.md as well as the ledger, and a superseded decision's reason — its
Rejected and Source — is under its id in planning/archive/DECISIONS.md. The `qa/` staleness
check searches planning/archive/PROGRESS.md too, by date, as the `qa/` section says. A
feature written before the archive keeps superseded decisions and answered questions in its
live files, marked in place; they stay there, and every reader reads both places, as it
reads both entry shapes.

## DECISIONS.md

An index, one entry per decision:

```
- **D<n>** · <date> · <the decision>
  - Rejected: <the rejected alternative>
  - Source: <where the reasoning lives — a SPEC section, a research note, the user's words quoted>
```

1. Source names where the reasoning lives: a SPEC section, a research note, or the user's
   words quoted.
2. A decision that supersedes an earlier one gets its own entry naming it, and the same
   write moves the earlier entry to planning/archive/DECISIONS.md with `superseded by D<m>`,
   as "The archive" shows, so the old entry never reads as current.
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
that settled it, and the same write moves it to planning/archive/OPEN-QUESTIONS.md ("The
archive"). PLAN.md's `Blocked by:` names an open question by its id (`Blocked by: OQ2`), not
by its wording, so the reference still resolves after the move.

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
- <date> · ruling · <id> · not ours
  - Report: <review report path>
  - Owner: <owner>
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
- <date> · sync · <slug> · <status>
  - Ref: <backup ref> at <commit>          (one per backup ref)
  - LOG: <LOG.md path>
  - Final review: from <commit>            (when the sync rebased the branch: its onto commit)
- <date> · fix · <slug> · <status>
  - FIX: <FIX.md path>
- <date> · finish · <n> commits
  - Items: <each menu item run>
  - Commits: <hash subject>, …
  - QA: skipped by the user                (when it was)
  - Archived: <the archive path the move used>
- <date> · <event kind> · <subject>
  - <Field>: <value>
```

A task is Done only when every step ran and every gate in its Done when passed. The ledger
is append-only, apart from the move past 60 entries in "The archive": one entry per event,
in one of the shapes above. They are grouped by the skill that writes them: executing-plans
down to `ruling · <id> · not ours`, then planning-features, reviewing-changes,
testing-changes, syncing-branches, fixing-bugs and finishing-features. The last shape is for
an event no other shape covers, such as work the user did outside a session. When an Inline
task's scripted Bash edit left a file with no formatter, the task's entry gains the sub-item
`No format pass: <each such file>`.

**The final review's base.** The final review diffs from the commit named by
`Final review:` in the latest `sync` entry with a `Final review:` sub-item after the latest
`execution start` or `baseline retaken` entry: the sync's rebase put commits that are not
the feature's under the pre-execution tree. Otherwise it diffs from the pre-execution tree
in the latest `execution start` or `baseline retaken` entry, or from the merge-base when a
`pruned` entry records that answer for that tree. A review from the tree is told, and
HANDOFF.md's Status names, what each `baseline retaken` entry leaves out of it.

**The review chain.** A feature holds one review chain, `temp/<feature>/review/`: the final
review, then re-reviews, each diffing from the latest report's snapshot tree. A fix or a
sync inside the feature has no review folder of its own: until the final review has run,
that review covers the change; after it, the change is re-reviewed in this chain. The final
review has run when `temp/<feature>/review/` holds a `<NN>-review.md`; a
`review held by rule` entry with no report does not count. Task reviews are not part of the
chain.

**An open finding.** A finding is a report and an id. It is open from the report that lists
it — a review's CONFIRMED, PLAUSIBLE and "conflicts with D<n>" findings, a re-review's NOT
ADDRESSED and new ones — until a later re-review in the chain judges it ADDRESSED, a
`deferred` or `ruling` entry names it — kept as designed, kept per D<n>, or not ours — or a
new review restarts the chain. Nothing else closes it, and there is no other state: a
finding under investigation or being fixed is open.

A new `<NN>-review.md` restarts the chain, the finishing menu's whole-branch review
included: every reader takes the latest `<NN>-review.md` and the re-reviews numbered after
it. An earlier finding the new review does not list again is closed by it. One it lists
again is the new review's finding, under its id there, and is decided afresh, even when an
earlier entry deferred it or ruled on it. Within that stretch the open findings are the
latest report's, since a re-review carries each earlier finding it did not set aside.

Task-review ids restart with every task and are not the final review's, so a task review's
entry names the task and carries no `Report:` sub-item. An entry about the final review
names its id and carries its report as the `Report:` sub-item, because `reviewing-changes`
sets a finding aside in `re-review` only when one entry — its first line plus its
sub-items — names both. A task-review entry therefore never sets aside a finding of the
final review.

## HANDOFF.md

The format is in `handoff-format.md`.

## research/

Notes from clarification, one file per question, in the note shape of
`../../clarifying-features/references/sources.md`: the short answer, `Answer:`, comes first,
and each claim names its source: a `path:line`, a URL, or the person who said it.

## qa/

The QA test list and the QA report, written by testing-changes. Both describe the code as
it stood when they were written. A later execute stage makes them stale: in the
PROGRESS.md ledger, an `execution start` entry or a task's `done | open` entry after their
`QA list` or `QA report` entry. A `qa/` file that no ledger entry names counts as older than
every `execution start` entry. The `QA list`, `QA report` and `execution start` entries
never move, but a closed task's `done | open` entry can ("The archive"). When the live
ledger holds neither kind of entry after the QA entry, the check also searches
planning/archive/PROGRESS.md for a `done | open` entry. A moved entry keeps only its date to
order it by, so there it counts as after the QA entry when its date is the same or later: a
current file flagged stale costs a rerun, while a stale one read as current hides the
change. `resume` flags a stale list or report, and whoever next rewrites HANDOFF.md's Status
names it as predating that work. Until testing-changes runs again, it is evidence about the
code as it stood, not as it is.

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