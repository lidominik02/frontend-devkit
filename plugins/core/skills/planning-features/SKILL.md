---
name: planning-features
description: >-
  Turns the spec in PLAN.md into tasks and keeps STATUS.md current. Use when
  the user says "write the plan", "break it into tasks", "resume", "resume the roadmap"
  or "checkpoint this". For "plan this feature", "new feature" or "here is the user
  story", use clarifying-features; for "implement the plan" or "execute task X",
  executing-plans.
argument-hint: "[plan|resume|checkpoint] [feature]"
allowed-tools: Bash(git status *) Bash(git log *) Bash(git rev-parse *) Read Grep Glob Skill AskUserQuestion
---

You turn a clarified feature into a plan of small tasks, and you keep the feature's files
true to the repository so that a session which remembers nothing can pick the work up.

The feature lifecycle is a chain of skills, and this one is second:

`clarifying-features` (interview, research, PLAN.md's spec sections) → `planning-features`
(PLAN.md's tasks, STATUS.md, resume) → `executing-plans` (implementation) →
`reviewing-changes` (automatic review) → `testing-changes` (on request) →
`finishing-features` (commit, MR text, open items, archive).

## The files

A feature lives in `temp/<feature>/`: `PLAN.md`, `STATUS.md`, `DECISIONS.md`, and
`CONTRACT-GAPS.md` when the API is involved. `references/artifacts.md` is the shape of each
file and the rule for reading it — read it before writing one. Read
`references/project.md` first: the package manager, the framework packs, the gates and the
base branch come from there.

1. Write a file in the same turn as the work it records: a decision that exists only in the
   conversation is lost with the context window.
2. A decision that shaped the plan gets a `DECISIONS.md` entry with the alternative it
   rejected.
3. The governing rules are the user's own when they have stated them, otherwise the
   defaults in `references/rules-block.md`. `STATUS.md`'s `Rules:` line records which set
   governs; if it has none yet, record it and write the rules out in full, each one, in the
   Kickoff prompt — a name for the set is a pointer, not the rules.

A fact the plan needs that neither the spec nor the files it names give is looked up, never
asked, with clarifying-features' research dispatch in `../clarifying-features/references/sources.md`.
Before an architecture form, read `## The better option` and `## Guards` in
`../designing-architecture/references/codebase-design.md`, and offer only the options the
user can pick; a product question goes back to clarifying-features.

## Mode: `plan <feature>`

The input is PLAN.md's spec sections and the files they point at. The plan decides how to
build what the spec settled.

1. **Read the spec and the open questions.** Read PLAN.md above `## Tasks`, and grep
   DECISIONS.md's `## Open questions` for lines without `answered:`. Open each file the
   Architecture fit names before building on it. When the spec sections are missing, or a
   task needs an answer the spec does not give and no one has been asked — a business rule,
   a state, a contract field — write no tasks: name the gap, call the Skill tool with
   "core:clarifying-features" in `gap` mode, naming it, and stop. An open question with an
   owner does not stop the plan: the task it blocks names its `OQ<n>` in Blocked by.
2. **Write the Tasks section** in the shape of `references/artifacts.md`: named vertical
   slices, each one piece of behaviour the user can observe, built through every layer it
   needs. Files are real paths; Interfaces use the exact names later tasks call; Design
   points at the exact screens and states; acceptance criteria come from the success
   criteria; Done when names the fast gates `references/project.md` finds, or says "no gates
   declared", plus the observation that proves the criteria; Tier is `mechanical` for a
   complete brief touching 1–2 files, `judgment` otherwise. When a Tasks section already
   exists, rewrite only the tasks the new decisions touch, dropping an answered question
   from their Blocked by; a Done task is never rewritten — a change it needs becomes a new
   task after it.
3. **Self-review and fix inline**, with no reviewer subagent:
   1. Coverage — every success criterion is an acceptance criterion of some task.
   2. Interfaces — every name a task consumes is produced by an earlier task or already
      exists, with the same spelling and shape.
   3. Review focus — every entry is assigned to a task.
   4. Proportion — a plan longer than the code it describes has written the code; cut it
      back to decisions. A step like "handle edge cases" is rewritten into the cases.
4. **Status:** STATUS.md's Tasks table gets one row per task (a new task its own row, a Done
   row untouched), the Stage `plan (awaiting approval)`, a Log line, and the Next action.
5. **Approval and the mode.** Recommend one mode with a reason from this plan — how tightly
   its tasks couple, how many there are, what a shipped mistake would cost:
   - **Subagent per task** — a fresh implementer for each task, a task review after each,
     and a pause after each task.
   - **Inline** — this session implements every task, with one review at the end.

   Ask with one AskUserQuestion form: the recommended mode (marked recommended), the other
   mode, "Approve, choose later", "Change". A revised plan whose STATUS.md already records a
   mode asks only Approve the changes (recommended) or Change.
   - **Subagent per task:** record `Mode:` and call the Skill tool with
     "core:executing-plans".
   - **Inline:** record `Mode:`, then one form: "Start a new session from the kickoff
     prompt" (recommended — this context holds the whole clarification and plan) or
     "Continue here", which calls the Skill tool with "core:executing-plans".
   - **A new session:** write STATUS.md's Kickoff prompt, show it, and stop.
   - **Approve, choose later:** `Mode: not chosen`; the next action is the user's choice.
   - **Change:** apply it, run step 3 again, and ask again.

Under Claude Code plan mode, present the tasks for approval and write the files once plan
mode exits; the approval covers the content only, so the mode form still runs.

## Mode: `resume`

Report where the feature stands, then wait — unless the request carries more than resuming.

1. If several features — folders under `temp/` holding a STATUS.md — exist, list them and
   ask which one. A named
   feature with no `temp/<feature>/` may be archived: "`temp/archive/<feature>/` — move it
   back by hand (it is untracked) and resume again."
2. Read STATUS.md and PLAN.md whole. At the `clarify` stage there are no tasks yet: the next
   action is clarifying-features `continue`.
3. Compare the repository with what the files claim: `git status --short --branch` for the
   branch and the changed files, `git log --oneline -20` for the commits. A file that has
   drifted from the repository reads as current, which makes it worse than a stale one. A
   `qa/` file older than a later `Log` line that records a task done is stale; say so.
4. Work the files do not record is normal — the user works outside sessions too. List it
   with a question about what changed, and record the answer as a STATUS.md Log line.
5. Report the Stage and its owner, what is done and how it was verified, the drift, and the
   Next action.
6. **A request beyond resuming** gets the report in a few lines and is then routed: a new or
   changed decision, or new work the spec does not carry, calls the Skill tool with
   "core:clarifying-features" in `gap` mode; a plan request the spec carries runs `plan`
   here; a request to implement calls the Skill tool with "core:executing-plans".

A feature still in the six-file layout (planning/SPEC.md, HANDOFF.md) is carried over by
hand as the end of `references/artifacts.md` says; tell the user so, and stop.

## Mode: `checkpoint`

For work with no plan — a quick fix, an exploration. Write `temp/handoffs/<slug>.md`:

```
# Checkpoint: <slug>
## Done
## Verified        each gate with its result, an unrun gate as NOT RUN, what was observed by hand
## Left
## Pick up         <Safe in a new session | Better finished in this one> — <why, for either>
## Kickoff prompt  Continue <slug>. Read first: temp/handoffs/<slug>.md, then <files>.
                   Next action: <the next action>. Rules: <the rules that govern>.
```

## Modes that moved

- `new` or `research`: reply "Clarification and research are in core:clarifying-features
  now." and stop.
- `implement`: reply "Implementation is in core:executing-plans now." and stop.

## What this must NOT do

- Implement anything.
- Write tasks without the spec sections, or answer a missing product question itself.
- Run a test suite, a build, Storybook or a browser check before the user releases it.
- Commit or `git add` the feature's files.
- Mark a task done with a step skipped or a gate unrun.
- Keep a second Next action in STATUS.md — rewrite the one that is there.
- Carry a fact about an individual repository. A repo's conventions live in that repo's
  own files, read at the moment of use.
