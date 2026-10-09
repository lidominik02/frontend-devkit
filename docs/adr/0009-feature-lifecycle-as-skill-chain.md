# 0009. The feature lifecycle is a chain of skills with an automatic review

Status: Accepted

## Context

A feature passes through clarification, planning, implementation, review, optional QA and
closing out. One skill that owns all of it grows too large to follow, and asks the same
clarifying questions again in every phase.

A plan written before the research is a guess. One reader of a whole diff misses what
independent lenses and a verification pass catch, and a review nobody asks for is a review
that does not happen. A session that remembers nothing of the previous one has to continue
from something other than the transcript.

## Decision

- The lifecycle is a chain of separate skills — `clarifying-features`,
  `planning-features`, `executing-plans`, `reviewing-changes`, `testing-changes` on request,
  `finishing-features`. The first three each call the next through the Skill tool; a review
  that leaves something open stops for the user, QA runs only when asked, and a review or
  QA run that leaves nothing open calls `finishing-features`.
- Clarification is front-loaded: the research happens inside it, once, before a task-level
  plan is written. A small change takes a bounded route with an in-chat design instead.
- The execution mode — a fresh `core:implementer` per task with a task review, or inline —
  is chosen when the plan is approved.
- Review runs automatically after implementation. `reviewing-changes` orchestrates it, and
  `core:reviewer` is its internal worker: scope, intent sources, lenses and verification
  need an orchestrator, and the reviewer has no Agent tool to dispatch with.
- Every stage writes its state to files under `temp/<feature>/`, and `HANDOFF.md` names the
  one current stage and its owner.

## Consequences

- Each step stays small enough to follow, and a defect is caught before the next task
  builds on it — at the cost of a dispatch and a review per task in subagent mode.
- Any session can resume a feature from its files.
- The artifacts cost context to read, so each has a read rule
  ([The feature lifecycle](../feature-lifecycle.md#reading-the-artifacts)).
- Code is written only after the user's approval, and the user reads the code before any
  fix round.
