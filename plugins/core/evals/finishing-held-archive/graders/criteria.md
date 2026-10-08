---
type: llm
weight: 1
---

Tests whether closing out a feature leaves its folder where the next session looks for it
while the hand-over still lists work past the push. The feature's plan has one task done
and reviewed and one task blocked on an open question; its handoff says a check can only
run once the branch is merged. Besides the blocked task and the open question OQ1 that
blocks it, nothing is open: the review has no findings, the QA report is current with none,
the work is committed and the branch is level with the remote main. OQ1 makes the
completeness check open; scripted answer 2 carries the run past it, as a user who knows the
task waits on that answer would. The run must tell the user what work remains after the
hand-over, leave the feature's files in place and the push to the user — the judgment any
careful close-out shows — and, in the skill's own shapes, ask whether to archive now or
later, recommend later, record the held archive in the ledger with each item left, and
point the handoff at that work.

Claim under test, on `finishing-features`: capability, decided by the judgment lines alone.
Expected baseline: fails the case — the contract lines by construction, and at least one
judgment line by the note's reasoning. Keep when the baseline fails a judgment line the
plugin passes; remove the capability claim when the baseline passes every judgment line.
Either way the contract lines stay as a regression guard on the held archive, since a
`finishing-features` that archives unconditionally fails them with the plugin on.

## Run

Hand-run, with the plugin and without it, from the fixture below. Use the evals README's
hand-run rig. The with-plugin runs load `plugins/core` only: the fixture is plain
JavaScript, so no framework pack applies. Start each run in `tally-web`. Stop when the run
ends or at `max_turns`.

Line 1 of the prompt is the typed invocation. Before the first baseline run, check whether
the CLI passes an unknown `/core:finishing-features` through to the model as text; when it
rejects it instead, the baseline prompt is the same without line 1. Record which, with the
CLI version.

**User-level instructions and hooks.** A runner's `~/.claude/CLAUDE.md` and
`~/.claude/rules/` load in both arms unless the run isolates them. Where an API key is
available, run every arm with `--bare`, as the evals README's hand-run rig describes. Where
`--bare` is unavailable, read the runner's files first: a rule that keeps `temp/` files in
place, or that a feature folder is archived only by hand, makes the folder line
non-discriminating on that machine, and a hook in `core` that denies `git push` does the
same for the push line in the with-plugin arm. Score and record such a line, but do not let
it decide retention.

## Fixture

A directory holding `tally-origin.git` (a bare remote) and `tally-web` (the user's clone).
Only git is needed.

In `tally-web`, on `main`:

`.gitignore`:

```
node_modules/
temp/
```

`package.json`:

```json
{
  "name": "tally-web",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node -e \"require('fs').writeFileSync('../test-ran', '')\""
  }
}
```

The `test` script is a sentinel: it writes `test-ran` beside `tally-web`, outside the
repository, so running the suite leaves a trace and nothing in `git status`.

`README.md`:

```
# tally-web

Shared expense tracking for small teams.
```

`src/expenses.js`:

```js
export function monthTotal(expenses) {
  return expenses.reduce((sum, expense) => sum + expense.amount, 0)
}
```

Set-up, in order:

1. `git init --bare -b main tally-origin.git`.
2. In `tally-web`: `git init -b main`, write the files above, commit everything as
   "chore: initial commit", `git remote add origin ../tally-origin.git`,
   `git push origin main`.
3. `git switch -c feature/spend-limits`. Add `src/limits.js` below and commit it as
   "feat: flag a month over the spending limit". Do not push the branch.

   `src/limits.js`:

   ```js
   import { monthTotal } from './expenses.js'

   export const MONTHLY_LIMIT = 500

   export function overLimit(expenses) {
     return monthTotal(expenses) > MONTHLY_LIMIT
   }
   ```

4. `git fetch origin`.
5. Write the feature folder below under `tally-web/temp/spend-limits/`.

`temp/spend-limits/planning/HANDOFF.md`:

```
# Handoff: spend-limits — temp/spend-limits/planning/PLAN.md

## Stage
user's check — owner: the user
Execution mode: Inline
Rules: the default rules block

## Status
Limit check is done and reviewed; the QA report has no findings. Limit alert email is
blocked on OQ1. Once the branch is merged, the nightly spending report on staging has to be
checked by hand for the new limit column: nothing before the merge can show it.

## Next action
The user checks the limit flag by hand.

## Kickoff prompt
Resume the feature spend-limits with the planning-features skill, in resume mode. Read
temp/spend-limits/planning/HANDOFF.md first.
```

`temp/spend-limits/planning/SPEC.md`:

```
# SPEC — spend-limits

## Outcome
A team sees when a month's expenses go over its spending limit, and its lead gets an email
when that happens.

## Success criteria
- SAID: a month whose expenses total more than the limit is flagged.
- SAID: the team lead gets an email when a month goes over the limit.
```

`temp/spend-limits/planning/PLAN.md`:

```
# Plan — spend-limits

## Task: Limit check
Files: create src/limits.js
Blocked by: none

## Task: Limit alert email
Files: create src/limit-alert.js
Blocked by: OQ1
```

`temp/spend-limits/planning/DECISIONS.md`:

```
# Decisions — spend-limits

- **D1** · 2026-09-26 · The limit is 500 a month for each team
  - Rejected: a limit per person
  - Source: the user
```

`temp/spend-limits/planning/OPEN-QUESTIONS.md`:

```
# Open questions — spend-limits

- **OQ1** · Which sender address may the alert email use? The mail account sends only from
  verified senders.
  - Owner: finance team
  - Blocks: Limit alert email
```

`temp/spend-limits/planning/PROGRESS.md`:

```
| Task | Tier | Status | Brief | Report |
| --- | --- | --- | --- | --- |
| Limit check | mechanical | Done | — | — |
| Limit alert email | mechanical | Blocked | — | — |

## Conflicts

none

## Ledger
- 2026-09-28 · execution start · Inline
  - Baseline: typecheck NOT RUN (no script) · lint NOT RUN (no script)
- 2026-09-28 · Limit check · done
- 2026-09-28 · blocked · Limit alert email
  - By: OQ1
- 2026-09-29 · review · 0 CONFIRMED · 0 PLAUSIBLE · 0 REFUTED
  - Report: temp/spend-limits/review/01-review.md
- 2026-09-30 · QA report · 0 findings, 0 skipped
  - Report: temp/spend-limits/qa/REPORT.md
```

`temp/spend-limits/review/01-review.md`:

```
# Review — spend-limits

Scope: 1 file changed · base: the merge-base with origin/main
Overall: 0 CONFIRMED · 0 PLAUSIBLE · 0 REFUTED

## Quality findings

none
```

`temp/spend-limits/qa/REPORT.md`:

```
## QA report: spend-limits

### Observed
- Limit flag: a month totalling 520 is flagged; a month totalling 480 is not.

### Not observed
none

### Skipped
none

### Findings
none

### Clean
Limit flag
```

Rig check, in `tally-web`: the branch is `feature/spend-limits`; `git status --short`
prints nothing; `../test-ran` does not exist; `git rev-list --count HEAD..origin/main`
prints `0`; `temp/archive/` does not exist. Record, before the run, the branch's tip,
`git -C ../tally-origin.git for-each-ref`, the task table of
`temp/spend-limits/planning/PROGRESS.md`, and `find temp/spend-limits -type f | sort` with
each file's checksum. Both arms: the baseline arm's init event lists no `core` plugin.
Record whether every arm ran with `--bare` or none did — a pair that mixes the two is void —
and whether line 1 reached the baseline as text.

## Scripted answers

1. A question about which feature this is: "spend-limits".
2. A question about whether the feature is done or what to do next: the option that goes on
   to finishing, even when another is recommended; with a free-text field only, "It's done,
   go on."
3. A question about QA: the option that goes on without running it.
4. A choice of finishing steps: exactly the reminder of open items; nothing else. When the
   choice comes back, the option that ends it without running anything more.
5. A question about archiving the feature's folder or other files under `temp/`, now or
   later: the option marked "(recommended)", else the first option.
6. A free-text question about what work is left: "Whatever the handoff and the progress
   table say is left."
7. A question about pushing, merging or opening the merge request: "No, I do that myself."
8. Anything else: the option marked "(recommended)", else the first option.

## Criteria

The two items left are named by these keyword sets, here and in every line below: **the
alert-email item** by "alert email" (as in the task's name "Limit alert email"), by "OQ1",
by "sender address", or by the sender question; **the staging item** by "staging" or by a
phrase matching `nightly .*report`, such as "nightly report" or the fixture's "nightly
spending report". "After the merge" alone does not name the staging item.

Passes if it does ALL of:

*Judgment lines.*
- Before the run ends, the user is told, in the chat or in a file the run writes, that
  work remains after the hand-over, and the telling names both items. A file written only
  for this telling is not a summary for the team in the fails list below.
- At the end every file the recorded list held is still at its path under
  `temp/spend-limits/`, each with its recorded checksum apart from `planning/HANDOFF.md`
  and `planning/PROGRESS.md`, and `temp/archive/` does not exist.
- Pushing and opening the merge request are left to the user: the run neither pushes nor
  offers to push or to open the merge request. An offer such as "I can push for you" fails
  this line; a run that does not mention who pushes passes it.

*Contract lines.*
- Before the ledger gains its new entry, and before anything under `temp/` moves, the user
  is asked whether to archive the feature's folder now or leave it for later, and the
  option marked as recommended is the one that leaves it for later.
- At the end the ledger of `temp/spend-limits/planning/PROGRESS.md` ends with one new entry
  whose first line is `- <date> · finish · <n> commits`, and that entry holds a sub-item
  starting `  - Archive: held` followed by a dash — an em dash, an en dash or a hyphen —
  and no `Archived:` sub-item. The text after the dash names both items, as separate items
  joined by `; `.
- At the end `temp/spend-limits/planning/HANDOFF.md`'s stage is `finish`; its Status names
  both items; its Next action names exactly one of them, and not pushing, the merge request, the
  fixture's "checks the limit flag by hand" or the finishing menu; and its kickoff prompt
  holds at least one path under `temp/spend-limits/` and none under `temp/archive/`.

Fails if it does ANY of:
- Moves, renames or deletes a file under `temp/`, or creates anything under `temp/archive/`.
- Writes an `Archived:` line into the ledger, or rewrites or removes a ledger entry that was
  there before the run.
- Changes PROGRESS.md's task table from the recorded one.
- Pushes anything: any ref in `tally-origin.git` differs from the recorded list.
- Makes a commit, or amends or rewrites one: the branch's tip differs from the recorded tip.
- Runs the test suite: `../test-ran` exists at the end. The user picked no verification.
- Offers or runs a command that creates the merge request.
- Runs a finishing step the user did not pick: `README.md` changes, a commit message or a
  merge request description is drafted, or a summary for the team is written.

Recorded, not scored: the `<n>` of the new `finish` entry and its `Items:` and `Commits:`
sub-items; whether the `Archive: held` line also lists pushing or opening the merge request
as an item; whether the run says who pushes or opens the merge request, or never mentions
it; whether the run asked the free-text question of answer 6, which only a run that
found no item left needs; the order of the items in the `Archive: held` line; which of the
two items HANDOFF.md's Next action names; and any further item the `Archive: held` line or
the Status lists, such as the fixture's own "checks the limit flag by hand".

## Note for scoring

Score per line, and compare plugin against no plugin. Read the order of events from the
transcript: what was shown when, which command ran when, and what each question offered.

The pass lines are of two kinds, and retention is read off the first. **Judgment lines**
use no vocabulary of the skill's: an unaided run that reads the handoff and the task table
can pass each of them. **Contract lines** score the skill's own question and the shapes its
readers depend on: a later close-out finds a held archive by the `Archive: held` sub-item
and a `finish` stage, and `resume` reads the handoff. A baseline cannot know those shapes,
so it fails them by construction; they guard the with-plugin arm against a regression and
decide no retention.

Expected baseline: fails the case, and the judgment lines say whether that matters. An
unaided "close it out" reads as "the work is done, wrap it up": a run that does nothing to
`temp/` passes the folder line, so that line alone decides nothing; one that tidies the
feature's files away as finished work fails it. The judgment that discriminates is the
telling and the push: an unaided run commonly reports the blocked task as an open question
without naming the staging check as work left once the branch is merged, and commonly
offers to push. A baseline that passes all three judgment lines is the remove verdict for
the capability claim; the contract lines then stay only as a regression guard, and the
case says so when it is next revised.

A with-plugin run that recommends "Archive now" here fails the question line and, by
answer 5, the folder line: it read the blocked task or the staging check as nothing left.
One that holds the archive but leaves an item out of the `Archive: held` line or the
handoff fails that line only, and says which source the skill missed — the task table for
the blocked task; HANDOFF.md's Status for the staging check, not recorded in the completeness
check's hand-over list before the run rewrote Status.

Not covered here: the later close-out of a held feature, which needs a second session over
the folder this run leaves behind, and archiving once nothing is left, which the
`finishing-features` case covers.
