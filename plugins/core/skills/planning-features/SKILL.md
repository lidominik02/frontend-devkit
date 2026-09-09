---
name: planning-features
description: >-
  Plan and run a large, multi-session feature build as a high-level phase roadmap with
  durable handoff files, so a later session with no memory of this one can resume
  exactly where it stopped. Modes: `new <feature>` (repo analysis + phase roadmap +
  init the handoff files), `plan <phase>` (detailed plan for ONE phase), `implement
  <phase>` (build an approved phase in the main thread, then checkpoint), `resume`
  (rehydrate status and the single next action), `save` (checkpoint now). Use whenever
  the user says "create a roadmap", "plan this feature", "high-level plan for X",
  "plan phase N", "implement phase N", "resume the roadmap", "checkpoint this", or
  describes a feature too large to finish in one sitting.
argument-hint: "[new|plan|implement|resume|save] [feature-or-phase]"
---

You run large features across many sessions. The deliverable is not just a plan — it
is a set of files that let a session which remembers nothing pick the work up cleanly.

Assume the context window will be lost mid-feature, because eventually it will be. Any
decision that exists only in the conversation is a decision that will be re-litigated
or silently reversed.

## Where the artifacts live

`temp/<feature-slug>/planning/` in the repo that owns most of the feature. Inputs the
user provides (`user-story.md`, `screenshots/`) sit at `temp/<feature-slug>/`.

| File | Holds |
| --- | --- |
| `MASTER-PLAN.md` | Repo analysis + the phase roadmap. Written once, amended rarely |
| `PROGRESS.md` | Phase table: number, name, owning repo, status, plan file, notes |
| `HANDOFF.md` | Current status and **the single next action**. The resume entry point |
| `DECISIONS.md` | Dated decisions **with their rejected alternatives** |
| `ASSUMPTIONS.md` | What was assumed for lack of an answer, so it can be checked |
| `OPEN-QUESTIONS.md` | What is blocked on the user |
| `CONTRACT-GAPS.md` | Only when the feature spans a frontend and a backend |

If `temp/` is not gitignored in that repo, say so once when you create the folder so
untracked files are not a surprise, and never `git add` them yourself.

**Keep these current in the same turn as the work.** The user should never have to say
"save" — `save` mode is an explicit checkpoint, not the only time state is written.

## Mode: `new <feature>`

1. **Gather inputs.** Read everything under `temp/<feature>/`. The user story is the
   primary source; screenshots are secondary. If inputs are missing or contradict each
   other, ask rather than reconcile them silently.
2. **Analyze the repo, read-only.** Document the conventions and the reusable assets
   the feature will build on *before* proposing phases — which store or composable
   owns each data domain, the existing list/detail/form patterns, the error and empty
   states already standardized, and the closest existing feature to copy from. Prefer
   parallel `Explore` subagents. Name real paths.
3. **Write `MASTER-PLAN.md`:**
   - `# Existing Architecture Analysis` — patterns, reusable modules, conventions that
     must be followed, each citing `path:line`.
   - `# Contract Strategy` *(only if the feature spans repos)* — the endpoints, fields,
     and events needed; which exist; which must be added; and how the consumer will
     type them.
   - `# High-Level Implementation Roadmap` — **phases only, no code.** Per phase:
     number, name, owning repo, objective, scope, deliverables, dependencies, risks.
     Flag phases that are foundational for later ones.
   - `# Roadmap Validation` — self-review: full coverage, no low-level detail,
     correct order, each phase independently approvable and implementable, contract
     phases before their consumers.
4. **Initialize the other files**, then **stop.** Do not start planning phase 1.

A phase is right-sized when it can be reviewed and merged on its own. If a phase
cannot be described without listing files, it is too detailed for the roadmap; if it
cannot be merged alone, it is too big.

## Mode: `plan <phase>`

Read every artifact plus the user story. Do a focused analysis for **this phase only**.

Now low-level detail is wanted: files to create or modify with real paths, the existing
utilities to reuse (cite them), step order, edge cases, and a verification section
built from the gates that actually exist — run
`node "${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.mjs" --list --stage full` and never
invent a script. If the repo has no test runner, say what manual verification replaces
it.

Stay inside the phase's scope from the roadmap. Update `PROGRESS.md` (→ Planned),
append to the decision/assumption/question logs, update `CONTRACT-GAPS.md` if this
phase revealed a missing field, and set `HANDOFF.md`'s next action to "review and
approve phase N".

**Then stop and wait for approval.** An unapproved plan is not a mandate to build.

## Mode: `implement <phase>`

Implementation runs **in the main thread**, not in a subagent: it shares the context
that planning just built, and a fresh subagent would start cold and re-derive it.

1. Confirm the phase is approved. If not, stop and ask.
2. Load every framework pack skill listed in this repo's `stack.packs`, in the order
   given, and follow them. A later pack is a delta on an earlier one and wins conflicts.
3. Implement exactly that phase's scope. Reuse before writing new code.
4. Run the gates that exist. Report any that do not.
5. Hand the diff to the `reviewer` agent, fix Critical findings, re-review.
6. Checkpoint: `PROGRESS.md` → Done, `HANDOFF.md` → next action.

## Mode: `resume`

Read `HANDOFF.md`, then `PROGRESS.md`, then the active phase file. Report current
status and **the single next action**, then wait. Do not begin work on a resume.

## Mode: `save`

Checkpoint all artifacts to reflect reality right now. Never record a phase as Done
when steps were skipped — write what actually happened, including the skipped steps.

## What this must NOT do

- **Decompose the whole feature into detailed plans up front.** The roadmap is phases;
  detail is produced one phase at a time, because phase 4's plan is invariably wrong
  before phases 1–3 are built.
- **Implement without an approved plan.**
- **Mark a phase Done with steps skipped or gates unrun.** Record the truth; a false
  Done is what makes a resumed session ship broken work.
- **Write low-level implementation detail into `MASTER-PLAN.md`.**
- **Invent a verification command.** Ask `run-gates.mjs --list` what exists.
- **Wait to be asked before updating the artifacts.**
- **Silently drop a decision made in conversation.** If it shaped the plan, it belongs
  in `DECISIONS.md` with what was rejected.
