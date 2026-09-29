# HANDOFF.md format

HANDOFF.md is the resume entry point: which feature this is, where it stands, what happens
next, and how a new session starts.

```
# Handoff: <feature-slug> — temp/<feature-slug>/planning/PLAN.md

## Stage
<one stage from the table below> — owner: <the skill, or the user>
Execution mode: Subagent per task | Inline | not chosen
Rules: the default rules block | the user's own: <each rule, verbatim>

## Status
<what is done and how it was verified — each gate with its result, an unrun gate as
NOT RUN; what is in progress; what is blocked, and on what>

## Next action
<one action, and who takes it>

## Kickoff prompt
<the paste-ready prompt, below>
```

1. The first line is the identity. `resume` checks the slug against the folder and the
   PLAN.md path against the disk before trusting the rest of the file.
2. Stage names exactly one stage.
3. Next action is rewritten on every update, so the file always holds exactly one.
4. The file describes the present; the history is in the PROGRESS.md ledger.

## Stages

| Stage | Owner |
| --- | --- |
| `clarify` | clarifying-features |
| `plan (awaiting approval)` | the user approves the plan planning-features wrote |
| `execute (task N/M, mode)` | executing-plans |
| `review (automatic)` | reviewing-changes |
| `user reads code + findings` | the user |
| `fix findings` | executing-plans |
| `QA list (awaiting approval)` | the user approves the list testing-changes drafted |
| `testing` | testing-changes |
| `user's check` | the user |
| `finish` | finishing-features, which calls describing-changes for the commit message and the MR text; a commit follows the user's acceptance |
| `pushed` | the user |

In `execute (task N/M, mode)`, N counts tasks and mode is the chosen execution mode, for
example `execute (task 2/5, Inline)`; Status and Next action name the task.

## Old-format features

A feature planned before this layout has MASTER-PLAN.md with a phase roadmap and the rules
that govern the feature, phase-N-*.md plan files, research.md, DECISIONS.md,
ASSUMPTIONS.md and old stage names. It has no SPEC.md.

**Reading.** `resume` reads those files where they are: a phase stands where a task
stands, MASTER-PLAN.md where PLAN.md stands, and research.md with DECISIONS.md and
MASTER-PLAN.md's feature understanding where SPEC.md stands. Map the stage with the table
below.

**New work** — a new phase, a changed decision, a new plan — moves to the current layout
and never opens a new phase file. clarifying-features `gap` writes the first SPEC.md, from
the sources its `gap` entry names, then `plan` writes PLAN.md in `plan-format.md`, and each
of its tasks, not the phase, gets a PROGRESS.md row. MASTER-PLAN.md, the phase files, research.md and
ASSUMPTIONS.md stay where they are, unedited, as the archive. DECISIONS.md takes new entries
as usual, and the old phase table stays in PROGRESS.md above the new task table.

**Rules.** The rules MASTER-PLAN.md records are the user's own rules for this feature, even
where they copy an earlier default. Record them in HANDOFF.md verbatim, as
`Rules: the user's own: …`,
never as "the default rules block", which names today's defaults in `rules-block.md`. Ask
once, with one AskUserQuestion form, whether they still govern — keep them, or switch to
the default rules block — and record the answer as a DECISIONS.md entry; a later session
reads that entry and does not ask again. Until the user answers, the old rules govern: a
rule that holds review until the user asks still holds it.

**History.** When an old HANDOFF.md is rewritten into this shape, its history sections — a
log of what was done, an earlier account of where things stood — move into the PROGRESS.md
ledger, one entry per event, so HANDOFF.md describes only the present (rule 4 above).

| Old stage | New stage |
| --- | --- |
| `research` | `clarify` |
| `plan (awaiting approval)` | `plan (awaiting approval)` |
| `implement` | `execute` — the old flow implemented in the main thread, which is Inline |
| `user reads the code` | `user reads code + findings` — no automatic review ran, so there are no findings yet |
| `review (on request)` | `review (automatic)` — the owner is reviewing-changes; whether a review runs unasked follows the rules above |
| `fix findings` | `fix findings` |
| `QA list (awaiting approval)` | `QA list (awaiting approval)` |
| `testing` | `testing` |
| `user's check` | `user's check` |
| `commit (drafted, awaiting acceptance)` | `finish` |
| `pushed` | `pushed` |

## Kickoff prompt

```
Resume the feature <feature-slug> with the planning-features skill, in resume mode.
Read first, in order:
1. temp/<feature-slug>/planning/HANDOFF.md
2. temp/<feature-slug>/planning/PROGRESS.md, the task table and the latest ledger entries
3. temp/<feature-slug>/planning/PLAN.md, the task "<task name>"
4. <any file the next action needs: a task brief, a review report>
Stage: <stage> — owner: <owner>.
Next action: <the next action>.
Rules: <the default rules block of planning-features | the user's own rules, verbatim>.
```

At the `clarify` stage no plan exists yet: the read-first list is HANDOFF.md, the SPEC.md
draft, the DECISIONS.md entries it cites and the open entries of OPEN-QUESTIONS.md, with no
PLAN.md task. Both lists name only the part of PROGRESS.md, DECISIONS.md and
OPEN-QUESTIONS.md that "Reading the artifacts" in `artifacts.md` gives the main thread, so a
new session never reads a whole ledger or decision index.

## Checkpoint shape

`checkpoint` writes `temp/handoffs/<slug>.md` for work with no plan:

```
# Checkpoint: <slug>

## Done
## Verified
<each gate with its result, an unrun gate as NOT RUN, and what was observed by hand>
## Left
## Pick up
Safe in a new session | Better finished in this one — <why>
## Kickoff prompt
Continue <slug>. Read first: temp/handoffs/<slug>.md, then <files>.
Next action: <the next action>. Rules: <the rules that govern>.
```
