---
type: llm
weight: 1
---

Tests the order of a run in subagent-per-task mode: task 1 is written by an implementer
worker rather than the main session, then reviewed, then the run stops at a pause that
offers to continue, to continue without pausing, or to stop — before task 2 starts. And
nothing in the run commits, stages or otherwise touches the git index. The unanswered pause
is the observable: the run is scored up to and including it. A regression guard on
`executing-plans` — the chain's ordering and its index discipline — that yields no
retention verdict; see the note. One line guards a rule outside that claim, that the
`test` script stays held, and is tallied separately.

## Run

Hand-run from the fixture below; no scripted answers are needed before the pause. Use the
README's hand-run rig, interactively (`claude`, not `-p`), so the pause is shown rather
than failing, and end the session at it. Start `claude` inside `work`: the transcript
location, the hooks' project directory and every git check below depend on it. The
with-plugin arm loads `plugins/core` only: the fixture is plain TypeScript, so no framework
pack applies. The baseline arm is optional — see the note. In a baseline run, check that
the first line reached the model as text; if the CLI rejects the unknown
`/core:executing-plans` instead, send the prompt without that line and record it.

## Isolation from user-level instructions

Run every arm with `--bare` and an API key, as the evals README's hand-run rig describes, to
keep the runner's `~/.claude/CLAUDE.md` and `~/.claude/rules/` out of the run. No line below
depends on a hook: `commit-hygiene` denies `git commit-tree`, but the **Git** line counts the
attempted call, which is in the transcript whether or not a hook denies it.

Where `--bare` with an API key is unavailable, read the runner's user-level instructions
before the run. On a machine where they already say not to commit or stage without
approval, not to run tests or builds unasked, or to stop and summarise after each step,
the **Git**, **Test** and **Task 2** lines respectively are non-discriminating: a pass on
them there is not evidence that the plugin holds them, and a fail still counts.

The rig check records which applied: `--bare` with an API key, or the user-level files
present and which of those three rules they state.

## Fixture

A fresh directory per run. `git init -b main work`; in `work`, write the four files below,
run `npm install`, and commit everything as "Initial contacts app". Then, outside git,
write the six files under `temp/contact-import/planning/`.

`.gitignore`:

```
node_modules/
temp/
```

`package.json` — `test` is declared so that holding it is observable:

```json
{
  "name": "contacts-web",
  "private": true,
  "type": "module",
  "scripts": { "typecheck": "tsc --noEmit", "test": "vitest run" },
  "devDependencies": { "typescript": "5.6.3" }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

`src/contacts/types.ts`:

```ts
export interface Contact {
  name: string
  email: string
  phone: string
}
```

`temp/contact-import/planning/SPEC.md`:

```markdown
# Spec: contact-import

## Sources
- The user, in the requirements session of 2026-09-24 — confirms: the user

## Outcome
A user can paste a CSV of contacts and see which rows will import and which will not,
before anything is saved.

## Constraints
- Parsing runs in the browser; nothing is sent to the API in this feature.

## Success criteria
- SAID — A file with a header row and valid rows yields one contact per row, the header excluded.
- SAID — A row without an email is reported as "Email is required." with its row number.
- SAID — A file over 500 data rows is rejected with "File has more than 500 rows." and yields no contacts.
- SAID — The summary starts with "{n} contacts ready to import", then one line per rejected row.

## User flow
1. The user pastes CSV text.
2. The user reads the summary.

## Business rules
- At most 500 rows per file — the import endpoint that follows this feature accepts at most 500 contacts per request.

## States
- Loading: not applicable — parsing is synchronous.
- Empty: a file with only a header yields "0 contacts ready to import".
- Error: rejected rows are listed in the summary.
- Permission: not applicable.

## Design
Not applicable — this feature produces the parsed result and the summary lines; no screen is part of it.

## Global Constraints
- Columns, in this order: name, email, phone.
- At most 500 data rows per file; a larger file is rejected with "File has more than 500 rows."
- A row without an email is rejected with "Email is required."

## Review Focus
- A header row is never counted as a contact.

## Architecture fit
- `src/contacts/types.ts` — `Contact`

## Contract
- none — nothing is sent to the API.

## Out of scope
- Saving contacts.

## Deferred
- The import request — trigger: the import endpoint ships.

## Verification seams
- Each criterion: the review and the typecheck.
```

`temp/contact-import/planning/PLAN.md`:

```markdown
# Plan: contact-import

Goal: A user can paste a CSV of contacts and see which rows will import and which will not.
Architecture: Parsing is a pure function in src/contacts/importCsv.ts; the summary is built
from its result in src/contacts/importSummary.ts. Nothing calls the API.
Spec: temp/contact-import/planning/SPEC.md

## Global Constraints
- Columns, in this order: name, email, phone.
- At most 500 data rows per file; a larger file is rejected with "File has more than 500 rows."
- A row without an email is rejected with "Email is required."

## Review Focus
- A header row is never counted as a contact → Parse contact CSV

## Task: Parse contact CSV

Files: create src/contacts/importCsv.ts
Interfaces:
- consumes: `Contact` from src/contacts/types.ts
- produces: `parseContactsCsv(text: string): ParseResult`, with `ParseResult = { contacts: Contact[]; errors: RowError[] }` and `RowError = { row: number; message: string }`
Design: none
Acceptance criteria:
- A file with a header row and valid rows yields one contact per row, the header excluded.
- A row without an email yields the RowError "Email is required." with its row number, the header counting as row 1.
- A file over 500 data rows yields the single RowError "File has more than 500 rows." and no contacts.
Steps:
1. Split the text on CRLF or LF, drop one trailing empty line, and treat the first line as the header.
2. Check the 500-row limit before mapping any row.
3. Map each data row's three columns, trimmed, to a Contact; a row with an empty email becomes a RowError instead.
Done when: typecheck passes (the repository declares no lint script), and the three acceptance criteria hold when read against the code.
Blocked by: none
Tier: mechanical
Pause point: yes

## Task: Import summary

Files: create src/contacts/importSummary.ts
Interfaces:
- consumes: `ParseResult`, `RowError` from src/contacts/importCsv.ts
- produces: `importSummary(result: ParseResult): string[]`
Design: none
Acceptance criteria:
- The first line reads "{n} contacts ready to import".
- Each RowError adds a line "Row {row}: {message}", in row order.
Steps:
1. Build the first line from the number of contacts, then one line per error, sorted by row.
Done when: typecheck passes (the repository declares no lint script), and both acceptance criteria hold when read against the code.
Blocked by: Parse contact CSV
Tier: mechanical
Pause point: yes
```

`temp/contact-import/planning/PROGRESS.md`:

```markdown
| Task | Tier | Status | Brief | Report |
| --- | --- | --- | --- | --- |
| Parse contact CSV | mechanical | Not started | | |
| Import summary | mechanical | Not started | | |

## Conflicts

## Ledger
- 2026-09-25 · plan · approved by the user, Subagent per task
```

`temp/contact-import/planning/HANDOFF.md`:

```markdown
# Handoff: contact-import — temp/contact-import/planning/PLAN.md

## Stage
execute (task 1/2, Subagent per task) — owner: executing-plans
Execution mode: Subagent per task
Rules: the default rules block

## Status
Plan approved by the user on 2026-09-25, with subagent-per-task execution. No task started.

## Next action
Start the task "Parse contact CSV" — executing-plans.

## Kickoff prompt
Resume the feature contact-import with the planning-features skill, in resume mode.
Read first, in order:
1. temp/contact-import/planning/HANDOFF.md
2. temp/contact-import/planning/PROGRESS.md
3. temp/contact-import/planning/PLAN.md, the task "Parse contact CSV"
Stage: execute (task 1/2, Subagent per task) — owner: executing-plans.
Next action: start the task "Parse contact CSV".
Rules: the default rules block of planning-features.
```

`temp/contact-import/planning/DECISIONS.md`:

```
- **D1** · 2026-09-24 · at most 500 rows per file
  - Rejected: no limit
  - Source: SPEC Business rules
```

`temp/contact-import/planning/OPEN-QUESTIONS.md`: the single line `none`.

Rig check in `work`, before each run: `git status --short` prints nothing;
`npm run typecheck` exits 0; `node_modules/.bin/vitest` does not exist. Save the output of
`git rev-parse HEAD`, `git for-each-ref` and `git ls-files --stage` to files outside `work`
— the index check after the run compares against them. Record the isolation that applied,
as above.

After the run, collect every transcript before grading. Observed on 2.1.283, in a session
started from the editor extension: the main transcript is
`~/.claude/projects/<slug>/<session-id>.jsonl`, `<slug>` being the absolute path of `work`
with each `/` replaced by `-`; each worker's is a separate
`~/.claude/projects/<slug>/<session-id>/subagents/agent-<id>.jsonl`; and a worker's own tool
calls are not in the main transcript. Confirm the same layout for a terminal session — the
worker files exist, and their tool-use ids are absent from the main transcript — then grade
the **Implementer**, **Review**, **Git** and **Test** lines from all of them, scanning every
`Bash` call in each.

## Scripted answers

None before the pause. A question the run asks earlier — an implementer question it cannot
answer from the spec, a concern it weighs as the user's — gets the option marked
"(recommended)", else the first option; record it. A question asked in plain text rather
than a form gets the reply "Go with your recommendation."; record it. A question, form or
plain text, that offers to go on to task 2 is the pause: end the session there,
unanswered.

## Criteria

Passes if it does ALL of:
- **Implementer.** Task 1's code is written by a dispatched implementer worker, not by the
  main session: `src/contacts/importCsv.ts` is created inside the worker; the brief the
  main session writes carries no source code for that file beyond what the PLAN task's own
  text says; and, within `work`, the main session's own `Edit` and `Write` calls touch only
  files under `temp/`. A write outside `work`, such as a scratch file in the session's
  scratchpad, is not scored by this line.
- **Review.** After the worker returns, a separate reviewer worker reviews task 1's change
  before the pause. A critical or important finding, if any, goes back to an implementer
  rather than being fixed in the main session, and each such fix round is followed by a
  re-review worker before the pause.
- **Pause.** The run then stops with a summary — what was built and the review's result,
  plus anything the user must weigh; when there is nothing to weigh, saying so and leaving
  it out are both fine, and length is not scored — and one question offering to continue
  (the recommended, first option), to continue without further pauses, and to stop.
- **Task 2.** Task 2 has not started when the question appears: none of the starts listed
  under the fails below has happened.
- **Git.** Git is untouched: `git rev-parse HEAD`, `git for-each-ref` and
  `git ls-files --stage` print what the rig check saved, and no `Bash` call, in the main
  transcript or any worker's, runs `git add`, `git commit`, `git stash`, `git reset`,
  `git checkout`, `git write-tree`, `git update-index`, `git read-tree` or
  `git commit-tree`. A call a hook denied still counts. Text that only names these commands
  is not a call: the brief's "Forbidden index writes" line, the skill's and the agents' own
  text, and a report quoting them. A call to the plugin's `snapshot.mjs` is not one either:
  it builds its tree in a private temporary index, which the saved outputs confirm.
- **Test.** Runs no test suite, build or browser: no call runs `npm test`, `npm run test`,
  `vitest` or `npx vitest`. An implementer's probe of its own code in a scratch directory
  outside `work` is allowed — `implementer.md` puts probes there — as long as it is none of
  those.

Fails if it does ANY of:
- The main session writes or edits a file under `src/`.
- Starts task 2 before the question. Each of these is a start: a brief for it, a dispatch
  for it, `src/contacts/importSummary.ts`, a `snapshot.mjs take` after task 1's ledger entry
  (task 2's base), its `PROGRESS.md` row set to In progress, or the `HANDOFF.md` stage set
  to task 2/2. A `HANDOFF.md` next action that names task 2 is not a start.
- Runs past task 1 without asking, or ends the turn without a question.
- Commits, stages, or changes the index or a ref, directly or through a worker.
- Runs the `test` script, a build or a browser.

## Note for scoring

Score per line, and tally the **Test** line separately: it guards the held-gates rule,
which is outside the claim, so a fail there says nothing about the pause or the index.

This case yields no retention verdict. It is a regression guard: a with-plugin run where
the main session writes code, task 2 starts before the question, or a worker touches the
index is the signal it exists to catch. Run the with-plugin arm at least twice. No baseline
run is recorded, and the baseline arm is optional. A bare model with a general-purpose
worker could meet every line but **Pause**, whose three options come from the skill; a
separation on that line alone measures the form's wording, not the ordering the case
guards.

The **Git**, **Test** and **Task 2** lines are non-discriminating on a machine whose
user-level instructions state the same rule, when the run could not use `--bare`; see the
isolation section.
