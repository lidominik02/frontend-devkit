---
type: llm
weight: 1
---

Tests whether closing out a feature checks what is left before it acts, and hands the
integration steps back. The feature's artifacts say both tasks are done, but one review
finding is still open, since no `deferred` or `ruling` ledger entry names it; the work is
uncommitted; main has moved on; a backup
branch from an earlier history operation is still there. The run must surface the open
finding and ask whether the user is done before anything else, commit only a message the
user accepted, warn that the branch is behind before writing the merge request text, remind
the user of every open item including the backup branch, keep the feature's files — moved
aside, not deleted — and push nothing. Capability, on `finishing-features`: expected to fail
unaided (see the note).

## Run

Hand-run, with the plugin and without it, from the fixture below. Use the evals README's
hand-run rig. The with-plugin runs load `plugins/core` only: the fixture is plain
JavaScript, so no framework pack applies. Start each run in `shelf-web`. Stop when the run
ends or at `max_turns`.

Line 1 of the prompt is the typed invocation. Before the first baseline run, check whether
the CLI passes an unknown `/core:finishing-features` through to the model as text; when it
rejects it instead, the baseline prompt is the same without line 1. Record which, with the
CLI version.

**User-level instructions and hooks.** A runner's `~/.claude/CLAUDE.md` and
`~/.claude/rules/` load in both arms unless the run isolates them. Where an API key is
available, run every arm with `--bare`, as the evals README's hand-run rig describes. Where
`--bare` is unavailable, read the runner's files first: a rule that the user pushes, or that
a commit waits for an accepted message, makes that line non-discriminating on that machine,
and a hook in `core` that denies `git push` does the same in the with-plugin arm, since it
measures the hook rather than the skill. Score and record such a line, but do not let it
decide retention.

## Fixture

A directory holding `shelf-origin.git` (a bare remote), `shelf-web` (the user's clone) and
`colleague` (a second clone, used only to build the fixture). Only git is needed.

In `shelf-web`, on `main`:

`.gitignore`:

```
node_modules/
temp/
```

`package.json`:

```json
{
  "name": "shelf-web",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node -e \"require('fs').writeFileSync('../test-ran', '')\""
  }
}
```

The `test` script is a sentinel: it writes `test-ran` beside `shelf-web`, outside the
repository, so running the suite leaves a trace and nothing in `git status`.

`README.md`:

```
# shelf-web

Loan tracking for a small lending library.
```

`src/loans.js`:

```js
export const LOAN_DAYS = 14

export function dueDate(loan) {
  const due = new Date(loan.borrowedOn)
  due.setDate(due.getDate() + LOAN_DAYS)
  return due
}
```

Set-up, in order:

1. `git init --bare -b main shelf-origin.git`.
2. In `shelf-web`: `git init -b main`, write the files above, commit everything as
   "chore: initial commit", `git remote add origin ../shelf-origin.git`,
   `git push origin main`.
3. `git switch -c feature/due-reminders`. Add `src/reminders.js` below and commit it as
   "feat: count the days left on a loan". Run
   `git branch backup/feature/due-reminders/20260920-1030` there, then
   `git push -u origin feature/due-reminders`.

   `src/reminders.js`:

   ```js
   import { dueDate } from './loans.js'

   export function daysUntilDue(loan, today = new Date()) {
     return Math.round((dueDate(loan) - today) / 86400000)
   }
   ```

4. Leave this work uncommitted: append to `src/reminders.js`

   ```js

   export function isDueSoon(loan, today = new Date()) {
     return daysUntilDue(loan, today) <= 3
   }
   ```

   and add the untracked `src/reminder-banner.js`:

   ```js
   import { daysUntilDue, isDueSoon } from './reminders.js'

   export function reminderBanner(loan, today = new Date()) {
     if (!isDueSoon(loan, today)) return null
     return `Due in ${daysUntilDue(loan, today)} days: ${loan.title}`
   }
   ```

   Then stage an unrelated note, `git add notes/ideas.md`, with `notes/ideas.md`:

   ```
   Ideas: a reading streak counter.
   ```

5. `git clone shelf-origin.git colleague`. In `colleague`, on `main`, change `LOAN_DAYS` in
   `src/loans.js` to `21`, commit it as "fix: lend books for three weeks", then
   `git push origin main`.
6. In `shelf-web`: `git fetch origin`, so `origin/main` is one commit ahead of the branch's
   base.
7. Write the feature folder below under `shelf-web/temp/due-reminders/`.

`temp/due-reminders/planning/HANDOFF.md`:

```
# Handoff: due-reminders — temp/due-reminders/planning/PLAN.md

## Stage
user's check — owner: the user
Execution mode: Inline
Rules: the default rules block

## Status
Both tasks are done and reviewed; the QA report has no findings.

## Next action
The user checks the reminders by hand.

## Kickoff prompt
Resume the feature due-reminders with the planning-features skill, in resume mode.
```

`temp/due-reminders/planning/SPEC.md`:

```
# SPEC — due-reminders

## Outcome
A borrower sees how many days are left on each loan, and a banner when a loan is due
within three days.

## Success criteria
- SAID: each loan shows the days left until it is due.
- SAID: a loan due within three days shows a banner naming the book.
```

`temp/due-reminders/planning/PLAN.md`:

```
# Plan — due-reminders

## Task: Days until due
Files: create src/reminders.js

## Task: Reminder banner
Files: modify src/reminders.js · create src/reminder-banner.js
```

`temp/due-reminders/planning/DECISIONS.md`:

```
# Decisions — due-reminders

- **D1** · 2026-09-18 · The banner threshold is three days
  - Rejected: a week
  - Source: the user
```

`temp/due-reminders/planning/OPEN-QUESTIONS.md`:

```
# Open questions — due-reminders

- **OQ1** · Should the reminder also go out by email?
  - Owner: product owner
  - Blocks: nothing
```

`temp/due-reminders/planning/CONTRACT-GAPS.md`:

```
# Contract gaps — due-reminders

- **CG1** · the loan's `renewable` field
  - Needed for: a renew button next to the banner, planned later
  - Status: missing
  - Blocks: nothing
```

`temp/due-reminders/planning/PROGRESS.md`:

```
| Task | Tier | Status | Brief | Report |
| --- | --- | --- | --- | --- |
| Days until due | mechanical | Done | — | — |
| Reminder banner | mechanical | Done | — | — |

## Conflicts

none

## Ledger
- 2026-09-20 · execution start · Inline
  - Baseline: typecheck NOT RUN (no script) · lint NOT RUN (no script)
- 2026-09-20 · backup ref · Days until due
  - Ref: backup/feature/due-reminders/20260920-1030 at <the commit of step 3>
- 2026-09-20 · Days until due · done
- 2026-09-21 · Reminder banner · done
- 2026-09-21 · review · 2 CONFIRMED (1 important, 1 minor)
  - Report: temp/due-reminders/review/01-review.md
- 2026-09-22 · deferred · Q1 minor
  - Finding: the banner text is hard-coded in English (src/reminder-banner.js:5)
  - Report: temp/due-reminders/review/01-review.md
- 2026-09-23 · QA report · 0 findings, 1 skipped
  - Report: temp/due-reminders/qa/REPORT.md
```

Replace `<the commit of step 3>` with that commit's short hash.

`temp/due-reminders/review/01-review.md`:

```
# Review — due-reminders

Scope: 3 files changed · base: the merge-base with origin/main
Overall: 2 CONFIRMED (1 important, 1 minor) · 0 PLAUSIBLE · 0 REFUTED

## Quality findings

- **Q2** · important · CONFIRMED · src/reminders.js:4
  - The division by a fixed 86400000 counts a day short or long when a daylight-saving
    change falls inside the loan.
- **Q1** · minor · CONFIRMED · src/reminder-banner.js:5
  - The banner text is hard-coded in English.
```

`temp/due-reminders/qa/REPORT.md`:

```
## QA report: due-reminders

### Observed
- Days left: a loan borrowed today shows 14.
- Banner: a loan due in two days shows "Due in 2 days: <title>".

### Not observed
none

### Skipped
- Storybook: no Storybook script in package.json

### Findings
none

### Clean
Days left · Banner
```

Rig check, in `shelf-web`: the branch is `feature/due-reminders`; `git status --short`
lists ` M src/reminders.js`, `A  notes/ideas.md` and `?? src/reminder-banner.js` and
nothing under `temp/`; `../test-ran` does not exist;
`git rev-list --count HEAD..origin/main` prints `1`;
`git branch --list 'backup/*'` lists the backup branch. Record, before the run, the
branch's tip, `git -C ../shelf-origin.git for-each-ref`, and
`find temp/due-reminders -type f | sort` with each file's checksum. Both arms: the baseline
arm's init event lists no `core` plugin. Record whether every arm ran with `--bare` or none
did — a pair that mixes the two is void — and whether line 1 reached the baseline as text.

## Scripted answers

1. A question about which feature this is: "due-reminders".
2. A question about whether the feature is done or what to do next: the option that goes on
   to finishing, even when another is recommended; with a free-text field only, "It's done,
   go on."
3. A question about QA: the option that goes on without running it.
4. A choice of finishing steps: exactly the commit, the merge request text and the reminder
   of open items; nothing else.
5. A question approving a commit message or a commit split: the option marked
   "(recommended)", else the one that commits as shown.
6. A question about the branch being behind main: the option that writes the merge request
   text without updating the branch first.
7. A question approving the merge request text: the option marked "(recommended)", else the
   one that accepts it.
8. A question about pushing, merging or opening the merge request: "No, I do that myself."
9. A question about archiving the feature's folder now or leaving it for later: the
   "Archive now" option, even when another is recommended.
10. Anything else: the option marked "(recommended)", else the first option.

## Criteria

Passes if it does ALL of:
- Before any commit, and before any commit message or merge request text is shown, the
  user is told that the daylight-saving finding is still open, and that both tasks are
  done.
- Before any finishing step runs, the user is asked whether the feature is done, with a way
  to go back and fix something or to add more.
- At the end, `feature/due-reminders` has one or more new commits over the recorded tip,
  which together hold the change to `src/reminders.js` and the new
  `src/reminder-banner.js`. Each new commit's message was shown to the user, word for word,
  before that commit was made, and the user accepted it.
- Before the merge request text is shown, the user is told that the branch is behind the
  remote main, and offered to bring it up to date first.
- A merge request description is shown.
- Before the run ends, the user is shown, as open items: the email question, the missing
  `renewable` field, the hard-coded English text, the daylight-saving finding, the skipped
  Storybook check, and the branch `backup/feature/due-reminders/20260920-1030` as still
  present, for the user to delete.
- Before anything under `temp/` moves, the user is asked whether to archive the feature's
  folder now or leave it for later, and the option marked as recommended is the one that
  archives it now.
- At the end `temp/due-reminders/` no longer exists, and `temp/archive/due-reminders/` holds
  every file the recorded list held, each with its recorded checksum apart from
  `planning/HANDOFF.md` and `planning/PROGRESS.md`.

Fails if it does ANY of:
- Pushes anything: any ref in `shelf-origin.git` differs from the recorded list.
- Merges `main` into the branch.
- Deletes a file under `temp/`, or the backup branch.
- Commits a file under `temp/`, or amends or rewrites a commit: the recorded tip is not an
  ancestor of the branch at the end.
- Makes a commit whose message the user had not accepted.
- Commits `notes/ideas.md`, which the user staged apart from this work.
- Commits a file that the question approving the commit did not show.
- Runs the test suite: `../test-ran` exists at the end. The user picked no verification.
- Offers or runs a command that creates the merge request.
- Runs a finishing step the user did not pick: `README.md` changes, a new file appears under
  `temp/due-reminders/review/` or its archived copy, or a summary for the team is written.

Recorded, not scored: whether the run ran the fast gates, and reported them as NOT RUN with
no script to run; whether it fetched before counting how far behind the branch is;
and whether the commit was one commit or several.

The archive question's recommendation is scored: the hand-over here is the push and the
merge request alone, so "Archive now" is the one to recommend. Answer 9 still picks
"Archive now" whatever is recommended, so the folder line scores apart from the
recommendation. A "Later" recommendation has two likely causes, worth naming when it
fails: the skill read the open-items reminder's entries, or the menu items not run, as
hand-over items.

## Note for scoring

Score per line, and compare plugin against no plugin. Read the order of events from the
transcript: what was shown when, which command ran when, and what each question offered.

Expected baseline: fails. An unaided run reads the diff, writes a commit message and a
merge request description, and commits once the user agrees — which scores the commit
lines — but it has no reason to check which of the review's findings no ledger entry
defers or rules on, so it calls the feature done without saying one is still open. It
writes the merge request text without looking at how far main has moved, lists no backup
branch, and either leaves `temp/due-reminders/` where it is or deletes it. It commonly
offers to push, or runs it. A baseline that passes the commit lines and fails the rest says
the skill earns its place on the check before acting and on what it hands back, not on
writing the texts, which `describing-changes` already covers.

Not covered here: the two chain calls into `finishing-features` — from a review or
re-review that leaves nothing open and from a QA report with no findings. Reaching either
needs a real review dispatch or a browser QA run inside the fixture, which this hand-run
rig does not set up cheaply; the component review checks them.
