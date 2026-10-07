# open-task-continue

An approved two-task plan runs in subagent-per-task mode. The first task must create a file
the lint gate rejects, and the gate and its script are outside every task's scope, so the
task stays open with a gate failure; the run then continues. The baseline files are rewritten
before the second task, and the second task's ledger entry records it.

The ceiling covers implementer and reviewer subagents and up to three fix rounds.

The prompt names the skill in words, so `skill-called` sees its Skill tool call, and carries a
standing instruction to go on: the stop after the open task may be a form, answered Continue
below, or a question in the chat, which ends the session's turn and so the run.

## Fixture

### .gitignore
```
temp/
```

### package.json
```json
{
  "name": "greet-fixture",
  "private": true,
  "type": "module",
  "scripts": {
    "lint": "node scripts/lint.mjs"
  }
}
```

### scripts/lint.mjs
```js
import fs from 'node:fs';

if (fs.existsSync('src/greeting.js')) {
  console.log('src/greeting.js 1:1 error greeting modules are not allowed (no-greeting)');
  process.exit(1);
}
console.log('lint: ok');
```

### src/index.js
```js
export const name = 'greet-fixture';
```

### temp/greet/planning/SPEC.md
```md
# Spec: greet

## Sources
- The user's notes in the conversation, confirmed by the user.

## Outcome
The package offers a greeting function and states its version.

## Constraints
- package.json and scripts/lint.mjs are not changed.

## Success criteria
- greet('Ada') returns "Hello, Ada!" from src/greeting.js. (SAID)
- src/index.js exports version "1.0.0". (SAID)

## User flow
None: a library change.

## Business rules
None.

## States
Not applicable.

## Design
Not applicable.

## Global Constraints
- package.json and scripts/lint.mjs are not changed by any task.

## Review Focus
None.

## Architecture fit
- src/index.js holds the package's exports.

## Contract
None.

## Out of scope
- Changing the lint gate.

## Deferred
None.

## Verification seams
- Both criteria: the review.
```

### temp/greet/planning/DECISIONS.md
```md
# Decisions — greet

- **D1** · 2026-10-07 · The plan (2 tasks) is approved; execution mode: Subagent per task
  - Rejected: Inline
  - Source: the user, approval form
```

### temp/greet/planning/OPEN-QUESTIONS.md
```md
# Open questions — greet
```

### temp/greet/planning/PLAN.md
```md
# Plan: greet

Goal: A greeting function in src/greeting.js and a version export in src/index.js.
Architecture: Two independent ES modules under src/; nothing else changes.
Spec: temp/greet/planning/SPEC.md

## Global Constraints

- package.json and scripts/lint.mjs are not changed by any task.

## Review Focus

None.

## Task: Add the greeting module

Files: create src/greeting.js
Interfaces:
- consumes: none
- produces: `greet(name: string) → string`
Design: none
Acceptance criteria:
- greet('Ada') returns "Hello, Ada!".
Steps:
1. src/greeting.js exports greet, which returns "Hello, <name>!".
Done when: lint passes, and the review confirms the criterion
Blocked by: none
Tier: mechanical
Pause point: yes

## Task: Add the version export

Files: modify src/index.js
Interfaces:
- consumes: none
- produces: `version: string`
Design: none
Acceptance criteria:
- src/index.js exports version "1.0.0".
Steps:
1. src/index.js exports `version = '1.0.0'` beside its existing export.
Done when: lint passes, and the review confirms the criterion
Blocked by: none
Tier: mechanical
Pause point: yes
```

### temp/greet/planning/PROGRESS.md
```md
# Progress — greet

| Task | Tier | Status | Brief | Report |
| --- | --- | --- | --- | --- |
| Add the greeting module | mechanical | Not started | | |
| Add the version export | mechanical | Not started | | |

## Conflicts

## Ledger
- 2026-10-07 · plan · 2 tasks written from SPEC.md
- 2026-10-07 · plan approved · Subagent per task (D1)
```

### temp/greet/planning/HANDOFF.md
```md
# Handoff: greet — temp/greet/planning/PLAN.md

## Stage
execute (task 1/2, Subagent per task) — owner: executing-plans
Execution mode: Subagent per task
Rules: the default rules block

## Status
The plan is approved; no task has started.

## Next action
executing-plans runs the task "Add the greeting module".

## Kickoff prompt
Run the approved plan of the feature greet with the executing-plans skill.
Read first, in order:
1. temp/greet/planning/HANDOFF.md
2. temp/greet/planning/PROGRESS.md, the task table and the latest ledger entries
3. temp/greet/planning/PLAN.md
Stage: execute (task 1/2, Subagent per task) — owner: executing-plans.
Next action: run the task "Add the greeting module".
Rules: the default rules block of planning-features.
```

## Prompt
Use the core:executing-plans skill to run the approved plan of the feature greet, from its first task. If the run stops for me after a task, continue with the next task.

## Answers
- continue → Continue
- pause → Continue

## Expect
- skill-called executing-plans
- tool-called Agent
- file-exists src/greeting.js
- file-matches src/index.js /version/
- file-matches temp/greet/baseline-fast.json /greeting modules are not allowed/
- file-matches temp/greet/planning/PROGRESS.md /Baseline files rewritten: after Add the greeting module/

## Options
- budget: 6
