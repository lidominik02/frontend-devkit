# The feature lifecycle

How the `core` skills take a piece of work from an idea to a commit, and what they write
along the way. For one line per skill, see the [`core` README](../plugins/core/README.md).

## What the devkit writes into a repository

The devkit requires nothing to be added to a repository, and writes into one only in these
cases:

- `preparing-a-repo` adds the files detection reads (scripts, commit convention, merge
  request templates) when a repository lacks them: it reports the gaps before it writes,
  and writes only the fixes the user approved.
- The lifecycle skills write their artifacts under `temp/` — a feature's in
  `temp/<feature>/`, in the repo that owns it, and a bug fix's or a sync's outside a
  feature in `temp/bugs/<slug>/` or `temp/syncs/<slug>/`. They never `git add` them, and
  say so once when `temp/` is not ignored.
- Code is written only after the user's say-so. `executing-plans` — through
  `core:implementer` workers or inline — and `clarifying-features` on its bounded route
  write it after the user approved a plan or an in-chat design. `fixing-bugs` writes a
  frontend fix and its regression test for a bug the user asked it to fix.
  `syncing-branches` rebases a branch and resolves its conflicts after the user approved
  its operation plan, and marks a file resolved only after the user approved the
  resolution log. `finishing-features` commits only a message the user accepted. Outside
  these, `verifying-ui` fixes what it observed, once the user released the check.

## The chain

```
clarifying-features → planning-features → executing-plans → reviewing-changes
  → testing-changes (on request) → finishing-features
```

`clarifying-features` settles what to build and writes SPEC.md; `planning-features` turns
it into a task-level PLAN.md and takes the user's approval; `executing-plans` builds it;
`reviewing-changes` reviews the result and, when it leaves something open, stops for the
user to read the code. Each of the first three calls the next through the Skill tool,
unless approval hands execution to a new session. `testing-changes` runs only when the user
asks. `finishing-features` owns the `finish` stage: a review or re-review that leaves
nothing open, or a QA run with no findings, calls it once every task is Done or Blocked,
and the user's "close it out" starts it too. `HANDOFF.md` names exactly one stage and its
owner, a skill or the user; the stages are listed in
[`handoff-format.md`](../plugins/core/skills/planning-features/references/handoff-format.md),
which also maps the stages of an older feature folder, so such a feature still resumes.

Why the lifecycle is a chain of separate skills with an automatic review:
[ADR 0009](adr/0009-feature-lifecycle-as-skill-chain.md).

## Artifacts

The artifacts live in `temp/<feature>/`, in the layout
[`artifacts.md`](../plugins/core/skills/planning-features/references/artifacts.md) fixes.
They are files, not the transcript, because a session that remembers nothing of the last
one has to continue the work from them.

## Reading the artifacts

**Reading them costs context, so the main thread reads only what its next step needs.**
`artifacts.md` gives a read rule per file: HANDOFF.md always, and its read-first list is
the entry point; PROGRESS.md's task table and latest ledger entries; DECISIONS.md by id;
OPEN-QUESTIONS.md's open entries; a research note's short answer first; and diffs, raw
review output and worker reports never — workers read those, and a step that needs one line
greps for it. What the live files no longer need moves to `planning/archive/`, in the same
write that retires it: a superseded decision, an answered question, and, once the ledger
passes 60 entries, the entries of tasks marked Done, while open work, rulings and recent
events stay. Nothing is deleted, an id stays unique across a live file and its archive, and
a step that follows an id the live file no longer holds looks it up there. Intermediate
files stay until the feature folder is archived; the close-out recommends waiting until no
work is left, and the user decides. Until then the folder stays under `temp/`, and another
close-out archives it.

## Clarification

**Clarification is front-loaded.** It starts from whatever exists — a written spec, a
ticket, notes in any language, a design, or nothing — and looks facts up in the repository,
the design tool and the API contract rather than asking. The user answers only what no
source can — product decisions, each rule's reason, the gaps — through AskUserQuestion
forms, and each answer becomes a DECISIONS.md entry. Code research runs in a background agent
meanwhile. A small change — one surface, a few files, no new API need, no open product
question — takes the bounded route instead: an in-chat design the user approves, built on
the main thread and reviewed, with no SPEC and no PLAN. Bounded work that grows switches to
the feature route; a feature never drops to bounded.

## Execution modes

There are two execution modes, chosen when the plan is approved:

- **Subagent per task** — a fresh `core:implementer` builds each task from a brief file, its
  diff is checked against the brief, a `core:reviewer` task review with up to three fix
  rounds follows, and the run pauses for the user after every task until the user chooses
  to continue without pausing. It continues in the session that planned it. It buys a
  defect caught before the next task builds on it; it costs a dispatch and a review per task.
- **Inline** — one session builds every task with no per-task review and no pause. It saves
  those dispatches, and one context carries tightly coupled tasks; a defect the gates miss is
  found only by the final review. Approval asks whether to start a new session from the
  handoff's kickoff prompt — recommended, since inline work would otherwise run in the
  context that holds the whole clarification and plan — or to continue in the planning
  session.

## Review

**The review is automatic.** When every task is done, `reviewing-changes` diffs the work
from the pre-execution tree and passes SPEC.md, PLAN.md and DECISIONS.md to the reviewers by
path. A small change gets one reviewer on the spec and quality axes, then a verifier that
tries to refute each candidate without seeing the finder's reasoning; a large one — past 400
changed lines or 15 files, or a thorough review asked for — gets one reviewer per lens in
[`lenses.md`](../plugins/core/skills/reviewing-changes/references/lenses.md), in parallel, then the
verifier. The report lands in `temp/<feature>/review/`, the stage becomes
`user reads code + findings`, and the skill stops. When the rules governing the feature hold
the review until the user asks for it — the user's own rules can, the defaults do not —
`executing-plans` does not call `reviewing-changes`: it writes a `review held by rule`
ledger entry quoting the rule, sets the same stage with "no review ran" in `HANDOFF.md`
Status, names the base the review would diff from in Next action, and stops.
`executing-plans` fixes the findings the user chooses; `reviewing-changes` then re-reviews.
Browser, design-tool and Storybook checks run only on request.

## Bugs

**A bug is diagnosed, ruled on, then fixed.** `investigating-bugs` finds the owning layer,
the root cause at `path:line`, a confidence and a next step, changes nothing, and stops:
whether the bug is the user's to fix is the user's ruling, often made after asking a PM, a
tester or the backend. `fixing-bugs` starts from that diagnosis with a repro test that is
red for the diagnosed reason, then the fix and the revert proof — red with the fix taken
out, green once it is back. An evident one-function cause — a bug the user reports inside a
feature, or a "fix inline" diagnosis — is fixed at once, its one test file red then green;
and `fixing-bugs` takes a list of findings from `fix-findings` before one review. Without a
diagnosis, or when the test contradicts it, it runs the loop: a repro that runs alone,
minimised; three to five ranked hypotheses and its one stop, a form on their order; tagged
instrumentation; the fix and the revert proof; the tags removed; and escalation after
three failed fixes. It runs only its own test file. A cause
outside the frontend stops it with a report for that owner, and a frontend guard needs the
user's approval. With no test runner or no correct seam it fixes without a regression test
and says so. The automatic review follows the fix; inside a feature it runs only once the
feature's final review has, as a re-review in the feature's one review chain, and before
that the final review covers the fix. Inside a feature, a QA run with findings offers a
parallel light investigation — `investigating-bugs`' batch mode, one read-only agent per
independent area and a short report per finding. `executing-plans`' `fix-findings` triages
each bug the user chose to fix in one run: an evident fix within one function at once, an
evident wider one to `fixing-bugs`, and an unclear one or one beyond the frontend through
the same read-only agents, which it dispatches itself, then the user's ruling on remit — a
finding not taken gets a `not ours` ruling, one taken goes to `fixing-bugs`. `fixing-bugs`,
called last, ends with the re-review; without it, `fix-findings` calls the re-review
itself when it fixed something, and `finishing-features` when it fixed nothing and nothing
is left open. A finding stays open until a re-review judges it addressed or a ledger entry
defers it or rules on it, and a new review of the feature restarts the chain.

## Syncing a branch

**A branch is synced by rebasing it.** `syncing-branches` rebases the user's own branch,
never merges it: onto main after main moved, mid-work, or across stacked branches, where it
carries a fix between a child and its unmerged parent and moves the child onto main once
the parent merged. One form approves the operation plan, its commands verbatim, and a
backup ref, `backup/<branch>/<YYYYMMDD-HHMM>`, marks each rewritten branch's tip before
anything moves. Each conflict is classified — regenerated, trivial, semantic with both
sides' intent kept, or a rename — and logged, every question naming the sides "`<target>`
(ours in this rebase)" — main, or the parent — and "your branch (theirs in this rebase)",
and no file is marked resolved
until the user approves the resolution log. After a sync onto main it looks for what main
brought that the branch also built with no conflict to show it, and asks about each:
main's, the branch's, or one definition forged from both. The fast gates and the automatic
review from the pre-sync tree follow, and the user force-pushes. Inside a feature that
review is the feature chain's re-review, once the final review has run; before it, the
final review covers the sync. Its `sync` ledger entry records the commit the rebase went
onto, and the feature's final review diffs from that commit, since the rebase put commits
that are not the feature's under the pre-execution tree. Restoring a backup ref is a
destructive reset and runs only on the user's confirmation; the refs stay until the user
deletes them.

## Finishing a feature

**A feature is finished through one menu.** `finishing-features` first checks what the
artifacts leave open — a task neither Done nor Blocked, an open finding in the review
chain's latest report, a QA report with findings, a blocking open question; contract gaps
are only reminded — and asks "Are we done?", with a second question, run the QA list or
skip it, when there is no current QA report. Done opens the menu; "found something" routes
it to a fix, and "want something more" to a `clarifying-features` gap round, a plan revision
and execution. Each menu item runs only when the user picks it, and each result is
confirmed on its own: full verification, a project-docs update, the commit, the MR
description, a team summary, an open-items reminder that lists the backup refs, and tidying
`temp/`. Verification's whole-branch review and QA run end the finishing run, the QA list
approved on `testing-changes`' own path; a report that leaves nothing open brings the chain
back, and the user picks the remaining items again. `describing-changes` writes the commit
message and the MR text; the commit follows
only a message the user accepted, and a branch behind `origin/<base>` is offered
`syncing-branches` before the MR text. The feature folder then moves to
`temp/archive/<feature>/`, with nothing deleted, when the user archives it now — recommended
once no work is left; otherwise it stays
under `temp/<feature>/` with the work left in its HANDOFF.md, and another close-out
archives it. `resume <feature>` brings an archived feature back to `temp/<feature>/` once
the user confirms, and records the reopening in its ledger. The user pushes, merges and
opens the merge request: `commit-hygiene.mjs` denies Claude a push or a merge.

## Resuming

HANDOFF.md ends in a kickoff prompt for a new session, which runs
`planning-features` in `resume` mode; `/core:planning-features resume` does the same. It
checks HANDOFF.md against the folder, compares the artifacts with `git status` and
`git log`, reports the stage, what is done and how it was verified, the drift and the single
next action, then waits. Work with no plan gets `checkpoint`: a handoff file under
`temp/handoffs/` with its own kickoff prompt.
