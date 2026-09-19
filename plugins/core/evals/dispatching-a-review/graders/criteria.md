---
type: llm
weight: 1
---

Tests whether the read-only `reviewer` agent actually gets dispatched from the words a
user would really use, or whether the main thread reviews the diff itself.

This case exists to settle a design question, not just to score an answer: if the agent's
own description dispatches it reliably, then a dispatcher skill is a component that buys
nothing and must not be added.

Passes if it does ALL of:
- Dispatches the `reviewer` agent — a subagent launch, or `core:reviewer` named
  explicitly. Reviewing the diff in the main thread is the failure, not a shortcut.
- Establishes the base branch from this repository rather than assuming `main`, so the
  diff under review is the right one.
- Runs the gates that exist and reports any it could not run as NOT RUN, rather than
  describing them as passing or omitting them.

Fails if it does ANY of:
- Reads and critiques the diff inline without dispatching the agent. Two guarantees are
  lost that way: the review no longer happens in a fresh context, so it inherits the
  assumptions of whoever wrote the change; and the reviewing turn still holds edit tools,
  so "review this" can quietly become "fix this" and then nothing is reviewed.
- Diffs against `main` without checking what the base branch is.
- Edits any file.
- Reports a gate as passing that was never run.

Note for scoring — this grader decides a component, so record the mechanism, not just the
verdict:

- **Fails baseline, passes with a dispatcher** → add the dispatcher skill.
- **Passes baseline** → add nothing. The agent's description is already doing the work,
  and a dispatcher would be a second trigger surface competing with it.
- Record *how* it dispatched when it passed: the agent's description matching on its own
  is the result that makes a dispatcher unnecessary. Needing an explicit `@`-mention or
  the fully-qualified `core:reviewer` is a weaker pass, because a user typing the
  sentence above would not have supplied either.

Plugin agents rank lowest in subagent discovery precedence, so run this in a repository
with no `reviewer` of its own in `.claude/agents/` — otherwise the case measures that
repo's agent instead of this one.
