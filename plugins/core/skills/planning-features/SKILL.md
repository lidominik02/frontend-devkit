---
name: planning-features
description: >-
  Turns SPEC.md into a task-level PLAN.md and keeps the handoff files current. Use when
  the user says "write the plan", "break it into tasks", "resume", "resume the roadmap"
  or "checkpoint this". For "plan this feature", "new feature" or "here is the user
  story", use clarifying-features; for "implement the plan" or "execute task X",
  executing-plans.
argument-hint: "[plan|resume|save|checkpoint] [feature]"
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.mjs *) Bash(git status *) Bash(git log *) Read Grep Glob Skill AskUserQuestion
---

You turn a clarified feature into a plan of small tasks, and you keep the feature's
artifacts true to the repository so that a session which remembers nothing can pick the
work up.

The feature lifecycle is a chain of skills, and this one is second:

`clarifying-features` (interview, research, SPEC.md) → `planning-features` (PLAN.md, the
shared artifacts, the lifecycle stage, resume) → `executing-plans` (implementation) →
`reviewing-changes` (automatic review) → `testing-changes` (on request) →
`finishing-features` (finish, with `describing-changes` writing the commit message and the
MR text).

## The artifacts

A feature lives in `temp/<feature>/` in the repo that owns most of it; the planning files
sit in `temp/<feature>/planning/`. `references/artifacts.md` is the contract for every
file and its fixed shape — read it before writing an artifact. Its "Reading the artifacts"
section says what to read of each file, and "The archive" which write moves an entry out of a
live file.

1. Update the artifacts in the same turn as the work they record: a decision that exists
   only in the conversation is lost with the context window. `save` is an explicit
   checkpoint, not the only moment state is written.
2. A decision that shaped the plan gets a `DECISIONS.md` entry with the alternative it
   rejected.
3. When you create `temp/<feature>/` in a repo whose `temp/` is not gitignored, say so
   once. The artifacts stay untracked; what enters git is the user's call.

## The rules and the stage

The governing rules are the user's own when they have stated them, otherwise the defaults
in `references/rules-block.md`. `HANDOFF.md` records which set governs and names exactly
one lifecycle stage with its owner. `references/handoff-format.md` lists the stages, their
owners and the file's shape. If `HANDOFF.md` has no rules line yet, state the governing
rules once and record them there.

## Research and decision forms

A fact the plan needs that neither the SPEC nor the files it names give — how a module is
wired, which files a change reaches — is looked up, never asked. A lookup wider than a few
reads uses clarifying-features' research dispatch in
`../clarifying-features/references/sources.md`: its agent type, `model: sonnet` and its
prompt, with the plan's own questions alone as the numbered list, as for
`research <question>`. Each finding is written as a note under `planning/research/` in that
file's note shape. A plan cites notes on disk, never a report that exists only in the
conversation.

Before a form that decides an architecture or a product question, read
`../clarifying-features/references/question-rounds.md` and hold the form to it. An
architecture choice the SPEC leaves to the plan is asked here, and its answer gets a
`DECISIONS.md` entry; a product question goes back to clarifying-features, as `plan` step 2
says.

## Mode: `plan <feature>`

The input is `SPEC.md` and the files it points at. The plan decides how to build what the
SPEC settled; what to build is already settled there.

1. **Read** `SPEC.md` and the open entries of `OPEN-QUESTIONS.md`. Open each file the
   SPEC's Architecture fit names before building on it.
2. **Check that the SPEC can carry a plan.** When `SPEC.md` is missing, or a task needs an
   answer the SPEC does not give and no one has been asked — a business rule, a state, a
   contract field — write no plan. Tell the user which gap stops it, hand back — call the
   Skill tool with "core:clarifying-features", naming the gap — and stop. An open question
   in `OPEN-QUESTIONS.md` with an owner does not stop the plan: every task is planned, and
   a task the question blocks names its id in Blocked by.
3. **List the fast gates:** `node "${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.mjs" --list
   --stage fast`. Every task's Done when names these gates, or says the repo has none and
   names the observation that stands in for them.
4. **Write `PLAN.md`** in the format of `references/plan-format.md`: the header, then the
   tasks as named vertical slices. When `PLAN.md` already exists, revise it as "A plan
   that already exists" describes, in place of steps 4–7.
5. **Self-review and fix inline**, with no reviewer subagent:
   1. SPEC coverage — every success criterion is an acceptance criterion of some task.
   2. Step scan — every step decides or produces something concrete; a step like "handle
      edge cases" is rewritten into the cases.
   3. Interfaces — every name a task consumes is produced by an earlier task or already
      exists, with the same spelling and shape.
   4. Review Focus — every entry is assigned to a task.
   5. Proportion — a plan longer than the code it describes has written the code; cut it
      back to decisions.
6. **Checkpoint:** `PROGRESS.md` gets the task table; `HANDOFF.md` gets the stage
   `plan (awaiting approval)`.
7. **Ask for approval and the execution mode**, as below, and act on the answer.

Under Claude Code plan mode, present the plan's content for approval and write the files,
research notes included, once plan mode exits. The user's approval in plan mode covers the
plan's content only: steps 6 and 7 still run before anything is implemented, so the form
below still asks the mode and, for Inline, the session. A revised plan runs its own step 4
instead, as "A plan that already exists" describes.

### Approval and the execution mode

Recommend one mode, with a reason taken from this plan: how tightly its tasks couple, how
many there are, and what a shipped mistake would cost. A recorded rule about the mode or
the session sets the recommendation; it never replaces the question.

- **Subagent per task** — a fresh implementer for each task, a task review after each,
  and a pause after each task.
- **Inline** — this session implements every task, with one review at the end.

Ask with one AskUserQuestion form. The options, in order: the recommended mode (marked as
recommended), the other mode, "Approve plan, choose later", "Change the plan".

- **Subagent per task:** record it in `HANDOFF.md` and continue in this session — call the
  Skill tool with "core:executing-plans".
- **Inline:** record it in `HANDOFF.md`, then ask with one AskUserQuestion form: "Start a
  new session from the kickoff prompt" (recommended — inline work would otherwise run in
  the context that holds the whole clarification and plan), then "Continue here", which
  calls the Skill tool with "core:executing-plans".
- **A new session**, recommended for Inline or asked for in either mode: finish
  `HANDOFF.md` with its kickoff prompt, show the prompt, and stop.
- **Approve plan, choose later:** record the approval in `HANDOFF.md` with the mode not
  chosen; the next action is the user's choice of mode.
- **Change the plan:** apply the change, run the self-review again, and ask again.

### A plan that already exists

When `PLAN.md` exists — clarifying-features calls `plan` after a `gap`, an arriving answer
to an open question included — revise the plan rather than rewrite it:

1. Read the new `DECISIONS.md` entries and rewrite only the tasks they touch, dropping an
   answered question from their Blocked by. A Done task is never rewritten: a change it
   needs becomes a new task after it.
2. Keep every Done task and its `PROGRESS.md` row, the ledger and the recorded execution
   mode. A new task gets its own row. Append a `plan revised` ledger entry.
3. Run the self-review on the changed tasks, and tell the user which tasks changed and how.
4. Set the stage `plan (awaiting approval)` and ask with one form: Approve the changes
   (recommended), or Change the plan. On approval, continue in the recorded mode as
   Approval describes, Inline's session form included. That mode is the user's answer to
   this plan's mode question, which step 2 keeps, not a recorded rule, so it is not asked
   again. With no mode recorded, ask the full approval form.

## Mode: `resume`

Report where the feature stands, then wait for the user — unless the request carries more
than resuming, which step 8 routes.

1. If several features have artifacts under `temp/`, list them and ask which one.
2. Read `HANDOFF.md` and check its first line: the feature slug matches the folder, and the
   PLAN.md path resolves, unless the stage is `clarify`, when no plan exists yet. When
   either does not, say so and treat the file as unverified.
3. Read what "Reading the artifacts" in `references/artifacts.md` gives the main thread:
   `PROGRESS.md`'s task table and latest ledger entries, then the active task in `PLAN.md`
   and its brief under `tasks/`, if there is one — its report is a worker report, left to
   grep. At the `clarify` stage read the `SPEC.md` draft, the `DECISIONS.md` entries it
   cites and the open entries of `OPEN-QUESTIONS.md` instead; the next action is
   clarifying-features `continue`.
4. Compare the repository with what the artifacts claim: `git status --short --branch` for
   the branch and the changed files, `git log --oneline -20` for the commits. An artifact
   that has drifted from the repository reads as current, which makes it worse than a
   stale one. A QA list or report that a later execute stage made stale, as the `qa/`
   section of `references/artifacts.md` defines it, is flagged as stale.
5. Work the artifacts do not record is normal — the user works outside sessions too. List
   it in the report with a question about what changed, and record the user's answer in
   the `PROGRESS.md` ledger — at the `clarify` stage, in `HANDOFF.md`'s Status. An entry
   that takes the ledger past 60 entries moves closed tasks' entries in the same write, by
   "The archive" in `references/artifacts.md`.
6. An old-format feature — `MASTER-PLAN.md` with a phase roadmap, `phase-N-*.md` files,
   `research.md`, `ASSUMPTIONS.md`, or an old stage name — resumes too: read its files
   where they are, map its stage with the table in `references/handoff-format.md`, and say
   which mapping you applied. That file's old-format section also says how its rules are
   recorded and asked about, and that new work moves to the current layout.
7. Report the stage and its owner, what is done and how it was verified, the drift found,
   and the single next action.
8. **A request beyond resuming** — a change, new work, a plan — gets the report in a few
   lines and is then routed, not waited on. A new or changed decision, and new work with no
   `SPEC.md` to carry it, goes to clarifying-features: call the Skill tool with
   "core:clarifying-features" in `gap` mode, naming what the request changes and, for an
   old-format feature, the files SPEC.md is written from; it records the decisions, then
   calls `plan`. A plan request the SPEC already carries runs `plan` in this session. A
   request to implement an approved plan calls the Skill tool with "core:executing-plans".

## Mode: `save`

Bring every artifact in line with the repository now: the `PROGRESS.md` table and ledger,
new `DECISIONS.md` entries, and a rewritten `HANDOFF.md` status, next action and kickoff
prompt. A task is Done when every step ran and every gate in its Done when passed; a task
with a skipped step or an unrun gate stays open, and the ledger names what was skipped. Each
write makes the move "The archive" in `references/artifacts.md` requires: a superseded
decision, an answered question, a ledger past 60 entries.

## Mode: `checkpoint`

For work with no plan — a quick fix, an exploration. Write `temp/handoffs/<slug>.md` in the
checkpoint shape of `references/handoff-format.md`: what was done, what was verified (each
gate with its result, an unrun one as NOT RUN), what is left, whether the work is safe to
pick up in a new session or better finished in this one and why, and the kickoff prompt.

## Modes that moved

- `new` or `research`: reply "Clarification and research are in core:clarifying-features
  now." and stop.
- `implement`: reply "Implementation is in core:executing-plans now." and stop.

## What this must NOT do

- Implement anything.
- Write a plan without `SPEC.md`, or answer a missing product question itself.
- Run a test suite, a build, Storybook or a browser check before the user releases it.
- Commit or `git add` the artifacts.
- Mark a task Done with a step skipped or a gate unrun.
- Append a second "Next action" to `HANDOFF.md` — rewrite the one that is there.
- Carry a fact about an individual repository. A repo's conventions live in that repo's
  own files, read at the moment of use.
