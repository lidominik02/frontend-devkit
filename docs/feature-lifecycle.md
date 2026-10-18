# The feature lifecycle

How the `core` skills take a piece of work from an idea to a commit, and what they write
along the way. For one line per skill, see the [`core` README](../plugins/core/README.md).

## What the devkit writes into a repository

- **Files under `temp/`.** A feature's files go to `temp/<feature>/` in the repo that owns
  it; a bug fix or a sync outside a feature goes to `temp/bugs/<slug>/` or
  `temp/syncs/<slug>/`. Nothing is `git add`ed, and the user is told once when `temp/` is not
  ignored.
- **Code, only after the user's say-so**: `executing-plans` and the bounded route of
  `clarifying-features` after an approved plan or in-chat design, `fixing-bugs` for a bug the
  user asked to fix, `syncing-branches` after its operation plan and resolution log are
  approved, `verifying-ui` once the user released the check.
- **A commit**, only with a message the user accepted (`finishing-features`).
- **Configuration**, only through `preparing-a-repo`, and only the fixes the user approved.

## The chain

`clarifying-features` → `planning-features` → `executing-plans` → `reviewing-changes` →
`testing-changes` (on request) → `finishing-features`. Each skill ends by calling the next,
or by stopping for the user where the user decides. **`designing-architecture`** is the
entry for a hard decision — an architectural question, a library or approach, or the user's
own design to evaluate: evidence, two or three options with their cost, a recommendation,
the user's decision, a record, and a handoff to `clarifying-features` to build it.

## The four files

```
temp/<feature>/
├── PLAN.md            the spec sections (what and why), then the tasks
├── STATUS.md          where it stands: stage, rules, mode, tasks, verified gates, log, next action
├── DECISIONS.md       open questions at the top, decisions below; append-only
└── CONTRACT-GAPS.md   only when the feature needs something from the API
```

**Reading rule:** STATUS.md and PLAN.md whole; DECISIONS.md and CONTRACT-GAPS.md by id,
with grep; a research note's `Answer:` first. The shapes are in
[`artifacts.md`](../plugins/core/skills/planning-features/references/artifacts.md). The
project's facts — package manager, framework packs, gates, base branch — are read from its
own files at the moment of use, by the four rules in
[`project.md`](../plugins/core/skills/planning-features/references/project.md). A gate is
reported as pass, FAIL or NOT RUN; NOT RUN is never a pass.

## Clarification and planning

`clarifying-features` classifies the work — bounded or feature, UI or not, API or not —
inventories the sources, researches the code in the background, and asks only what no
source can answer, in forms with the recommended option first. A bounded change gets an
in-chat design and is built at once. A feature gets PLAN.md's spec sections, every answer a
DECISIONS.md entry, and hands over to `planning-features`, which writes the tasks as
vertical slices and asks for approval and the execution mode.

## Execution modes

- **Subagent per task** — a fresh `core:implementer` per task from a brief, the fast gates
  judged against the baseline, a `two-axis` task review, at most three fix rounds, and a
  pause after each task.
- **Inline** — this session implements every task, with one review at the end.

## Review

`reviewing-changes` diffs the branch's committed, uncommitted and untracked work from its
base with `snapshot.mjs`, runs the fast gates once, and dispatches one `core:reviewer` in
the `two-axis` role (spec and quality) and one in the `verify` role, which tries to refute
each finding. The report counts findings; it approves nothing. The user reads the code and
the report; `executing-plans fix-findings` fixes what the user picks, and a `re-review`
judges the fix diff. A finding is closed by a re-review or by a line in STATUS.md's
`Closed findings`.

## Bugs

A bug is diagnosed, ruled on, then fixed. `investigating-bugs` finds the owning layer and
the root cause at `path:line`, changes nothing, and stops: whether it is the user's to fix
is the user's ruling. `fixing-bugs` starts from that diagnosis — without one it asks
`investigating-bugs` for it — with a repro test red for the diagnosed reason, then the fix
and the revert proof: red with the fix taken out, green once it is back, one test file run.
Own code, in any layer, is fixed once the user confirms it; a cause in code the repository
only consumes stops it with a report for that owner.

## Syncing a branch

`syncing-branches` rebases the user's branch — onto main, mid-work, or across stacked
branches — never merges it. Uncommitted work is committed by the user first. A backup ref,
`backup/<branch>/<YYYYMMDD-HHMM>`, marks each tip before anything moves; every conflict is
classified and logged, and no file is marked resolved until the user approves the log.
Restoring a backup is a destructive reset, run only on the user's confirmation.

## Finishing and resuming

`finishing-features` checks the tasks, the open findings, QA and the open questions, asks
"Are we done?", then runs the commit, the MR text and the open items, each confirmed, and
offers to archive the folder with `mv temp/<feature> temp/archive/<feature>`. The user pushes,
merges and opens the merge request. `planning-features resume` reads STATUS.md and PLAN.md,
compares them with the repository, and names the next action; an archived feature is moved
back by hand.
