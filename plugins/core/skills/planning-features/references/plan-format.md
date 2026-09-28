# PLAN.md format

PLAN.md turns SPEC.md into small tasks. It records decisions — what each task produces,
where, and against which interfaces — and leaves the code to execution.

## Header

```
# Plan: <feature-slug>

Goal: <one sentence>
Architecture: <2–3 sentences: where the feature sits and what it builds on>
Spec: temp/<feature-slug>/planning/SPEC.md

## Global Constraints
<the SPEC section of the same name, copied with every exact value verbatim>

## Review Focus
- <a failure mode the SPEC lists that no task's acceptance covers> → <task name>
```

Review Focus holds only the failure modes that no acceptance criterion already covers, and
each one names the task that must handle it, so the task's implementer and its reviewer
both see it.

## Tasks

```
## Task: <name>

Files: create <path> · modify <path>
Interfaces:
- consumes: <exact names — props, emits, store shape, function signatures>
- produces: <the same, for what later tasks build on>
Design: <the screens and states this task builds, located in the SPEC's Design source, or none>
Acceptance criteria:
- <an observable criterion, taken from the SPEC>
Steps:
1. <what to decide or produce, and where>
Done when: <the fast gates, by name> pass, and <the observation that proves the criteria>
Blocked by: <task names, an open question by its OPEN-QUESTIONS.md id (OQ2), or none>
Tier: mechanical | judgment
Pause point: yes
```

1. **Each task is a vertical slice**: one piece of behaviour the user can observe, built
   through every layer it needs — not one layer across the whole feature. Each has a name,
   and the plan, the ledger and every handoff refer to it by that name.
2. **Files** are real paths, marked create or modify.
3. **Interfaces** use the exact names later tasks will call. A name one task produces is
   spelled and shaped the same wherever another task consumes it.
4. **Design** points at the exact screens and states — a frame link, a file under
   `design/`, or the approved proposal — so the implementer and the reviewer judge against
   the same source. `none` for a task with no UI.
5. **Acceptance criteria** come from the SPEC's success criteria, each one observable.
6. **Done when** names the gates from `run-gates.mjs --list --stage fast`, or says the repo
   has none, plus the observation the SPEC's Verification seams name for these criteria.
7. **Tier**: `mechanical` when the task has a complete brief and touches 1–2 files — a
   sonnet implementer can do it; `judgment` for everything else — the session model does
   it.
8. **Pause point** is always `yes`: in subagent-per-task mode, execution pauses after every
   task for the user, and only the user skips the pauses that remain, with "Continue without
   pausing" on the pause form. Inline mode runs through every task without pausing.

## Decisions, not code

A step says what to decide or produce and where it goes:

```
2. Empty state in OrderList: no rows after filtering shows the SPEC's "No matching
   orders" copy with a reset-filters action; no rows before any filter shows the
   onboarding hint.
```

A code block belongs in a step only for an algorithm the interfaces do not determine, or
for copy the SPEC fixes word for word. A task has no commit step: the user commits after
accepting a drafted message.
