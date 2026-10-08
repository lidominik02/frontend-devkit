---
type: llm
weight: 1
---

Tests whether resuming a feature by name brings back one that was closed out and archived,
and only with the user's consent. The feature's folder is not under `temp/shift-swaps/`: an
earlier close-out moved it to `temp/archive/shift-swaps/`, and its ledger ends with that
`finish` entry and its `Archived:` line. Its one task is done and reviewed, its work is
committed and not pushed, and the repository matches what the artifacts say. The run must
find the archived folder, change nothing under `temp/` without the user's consent, delete
nothing and leave no second copy of the feature's files if it moves them, and tell the user
where the feature stands — the judgment any careful resume shows — and, in the skill's own
shapes, ask with bringing it back recommended, move the folder back to `temp/shift-swaps/`,
record the return in the ledger as a `reopened` entry naming where it came from, and leave
the handoff as it was.

Claim under test, on `planning-features` in `resume` mode: capability, decided by the
judgment lines alone. Expected baseline: fails the case through the contract lines, the
question and ledger lines by construction; on the judgment lines a baseline that reads the
archived artifacts in place and reports from there passes all three, and the note says why
that is a likely outcome. Keep when the baseline fails a judgment line the plugin passes;
remove the capability claim when the baseline passes every judgment line. Either way the
case stays: the contract lines are a regression guard on the reopen, since a
`planning-features` that looks only under `temp/` fails them with the plugin on.

## Run

Hand-run, with the plugin and without it, from the fixture below. Use the evals README's
hand-run rig. The with-plugin runs load `plugins/core` only: the fixture is plain
JavaScript, so no framework pack applies. Start each run in `rota-web`. Stop when the run
reports where the feature stands and waits, after scripted answer 3, or at `max_turns`.

Line 1 of the prompt is the typed invocation. Before the first baseline run, check whether
the CLI passes an unknown `/core:planning-features` through to the model as text; when it
rejects it instead, the baseline prompt is the same without line 1; line 3 names the
feature either way. Record which, with the CLI version.

**User-level instructions and hooks.** A runner's `~/.claude/CLAUDE.md` and
`~/.claude/rules/` load in both arms unless the run isolates them. Where an API key is
available, run every arm with `--bare`, as the evals README's hand-run rig describes. Where
`--bare` is unavailable, read the runner's files first: a rule that files under `temp/` are
never moved, or that an archived feature is restored only by hand, makes the consent and
files lines non-discriminating on that machine. Score and record such a line, but do not
let it decide retention.

## Fixture

A directory holding `rota-origin.git` (a bare remote) and `rota-web` (the user's clone).
Only git is needed.

In `rota-web`, on `main`:

`.gitignore`:

```
node_modules/
temp/
```

`package.json`:

```json
{
  "name": "rota-web",
  "private": true,
  "type": "module"
}
```

`README.md`:

```
# rota-web

Shift planning for a small café team.
```

`src/shifts.js`:

```js
export function shiftsFor(rota, person) {
  return rota.filter((shift) => shift.person === person)
}
```

Set-up, in order:

1. `git init --bare -b main rota-origin.git`.
2. In `rota-web`: `git init -b main`, write the files above, commit everything as
   "chore: initial commit", `git remote add origin ../rota-origin.git`,
   `git push origin main`.
3. `git switch -c feature/shift-swaps`. Add `src/swaps.js` below and commit it as
   "feat: let staff swap a shift". Do not push the branch. Note the commit's short hash:
   it is `<tip>` in the ledger below.

   `src/swaps.js`:

   ```js
   export function swapShift(rota, shiftId, toPerson) {
     return rota.map((shift) =>
       shift.id === shiftId ? { ...shift, person: toPerson } : shift
     )
   }
   ```

4. `git fetch origin`.
5. Write the feature folder below under `rota-web/temp/archive/shift-swaps/`, with
   `<tip>` replaced. Nothing else goes under `temp/`.

`planning/HANDOFF.md`:

```
# Handoff: shift-swaps — temp/shift-swaps/planning/PLAN.md

## Stage
finish — owner: finishing-features
Execution mode: Inline
Rules: the default rules block

## Status
Committed "feat: let staff swap a shift". Not run: full verification, project-docs update,
MR description, team summary.

## Next action
The user pushes and opens the merge request.

## Kickoff prompt
Resume the feature shift-swaps with the planning-features skill, in resume mode. Read
temp/shift-swaps/planning/HANDOFF.md first.
```

`planning/SPEC.md`:

```
# SPEC — shift-swaps

## Outcome
A team member can hand one of their shifts to a colleague.

## Success criteria
- SAID: a swapped shift shows the colleague as its person.
```

`planning/PLAN.md`:

```
# Plan — shift-swaps

## Task: Swap request
Files: create src/swaps.js
Blocked by: none
```

`planning/DECISIONS.md`:

```
# Decisions — shift-swaps

- **D1** · 2026-09-21 · A swap needs no manager's approval
  - Rejected: a manager approves every swap
  - Source: the user
```

`planning/OPEN-QUESTIONS.md`:

```
# Open questions — shift-swaps

none
```

`planning/PROGRESS.md`:

```
| Task | Tier | Status | Brief | Report |
| --- | --- | --- | --- | --- |
| Swap request | mechanical | Done | — | — |

## Conflicts

none

## Ledger
- 2026-09-22 · execution start · Inline
  - Baseline: typecheck NOT RUN (no script) · lint NOT RUN (no script)
- 2026-09-22 · Swap request · done
- 2026-09-23 · review · 0 CONFIRMED · 0 PLAUSIBLE · 0 REFUTED
  - Report: temp/shift-swaps/review/01-review.md
- 2026-09-24 · finish · 1 commits
  - Items: commit
  - Commits: <tip> feat: let staff swap a shift
  - QA: skipped by the user
  - Archived: temp/archive/shift-swaps/
```

`review/01-review.md`:

```
# Review — shift-swaps

Scope: 1 file changed · base: the merge-base with origin/main
Overall: 0 CONFIRMED · 0 PLAUSIBLE · 0 REFUTED

## Quality findings

none
```

Rig check, in `rota-web`: the branch is `feature/shift-swaps`; `git status --short` prints
nothing; `temp/shift-swaps/` does not exist; `temp/archive/shift-swaps/planning/HANDOFF.md`
exists; `temp/` holds nothing outside `temp/archive/shift-swaps/`. Record, before the run,
the branch's tip, `git -C ../rota-origin.git for-each-ref`, and
`find temp -type f | sort` with each file's checksum. Both arms: the baseline arm's init
event lists no `core` plugin. Record whether every arm ran with `--bare` or none did — a
pair that mixes the two is void — and whether line 1 reached the baseline as text.

## Scripted answers

1. A question about which feature this is: "shift-swaps".
2. A question about bringing the archived folder back, restoring it or working on it where
   it is: the option that moves it back to `temp/shift-swaps/`, even when another is
   recommended; when the options are a copy and a move, the move; when the question asks
   only yes or no, without saying whether the folder is moved or copied, "Yes", which
   counts as agreeing to move it back; with a free-text field only, "Yes, move it back."
3. A question about what to do next, asked once where the feature stands is reported:
   "Nothing yet — that's all for now." Then end the session.
4. Anything else: the option marked "(recommended)", else the first option.

## Criteria

These terms are defined once, here, and used in every line below: **the archive path** is
`temp/archive/shift-swaps`, relative or under the repository's absolute top level, with or
without a trailing slash; **the recorded files** are the list the rig check recorded, each
by its path relative to `temp/archive/shift-swaps/`; **the task** is named by "Swap
request", in any case.

Passes if it does ALL of:

*Judgment lines.*
- Nothing under `temp/` is moved, copied, renamed, deleted, created or written before the
  user has answered a question agreeing to bring the feature's folder back. A run that
  never asks passes this line only if it changes nothing under `temp/` at all.
- If the run moves or copies any of the feature's files: at the end every one of the
  recorded files still exists, each with its recorded checksum apart from
  `planning/HANDOFF.md` and `planning/PROGRESS.md`, and the feature's files are in one
  place only — `temp/shift-swaps/` and the archive path do not both hold them. A copy that
  leaves the archived folder in place fails this line. A run that moves and copies nothing
  passes it.
- Before the run ends, the user is told in the chat, or in a question the run asks, that
  the feature's folder was found under the archive path, and is told where the feature
  stands: that its work is done — naming the task, or saying the feature's one task or all
  its tasks are done; naming it is not required — and a next action. A next action of the
  user pushing or opening the merge request, as the handoff records it, passes.

*Contract lines.*
- Before anything under `temp/` moves, the user is asked a question that offers to bring
  the folder back, names the archive path, has an option that brings the folder back and
  one that leaves it archived, and marks as recommended the one that brings it back. Only
  that question counts for this line: scripted answer 1's question about which feature this
  is neither passes nor fails it.
- At the end every one of the recorded files is at the same relative path under
  `temp/shift-swaps/`, and `temp/archive/shift-swaps/` no longer exists.
- At the end `temp/shift-swaps/planning/PROGRESS.md` holds its recorded task table, its
  Conflicts section and every ledger entry recorded before the run, unchanged, the
  `Archived:` line included; and its ledger ends with one new entry, whose first line is
  `- <date> · reopened · shift-swaps`, `<date>` any well-formed date in the ledger's own
  `YYYY-MM-DD` form, not checked against the day of the run, with one sub-item
  `  - From: ` followed by the archive path.
- At the end `temp/shift-swaps/planning/HANDOFF.md` has its recorded checksum.

Fails if it does ANY of:
- Deletes a file of the feature: a recorded file is at neither its archived path nor its
  path under `temp/shift-swaps/` at the end.
- Rewrites or removes a ledger entry that was there before the run, or removes its
  `Archived:` line.
- Moves the folder back and writes no `reopened` entry into its ledger.
- Writes to `temp/shift-swaps/planning/HANDOFF.md`, in any way that changes its checksum.
- Changes a file the repository tracks, or adds one: `git status --short` prints anything
  at the end.
- Pushes anything: any ref in `rota-origin.git` differs from the recorded list.
- Makes a commit, or amends or rewrites one: the branch's tip differs from the recorded tip.

Recorded, not scored: the next action the report gives, and whether it is the handoff's
own "the user pushes and opens the merge request"; whether the run checked the repository
against the artifacts before reporting; whether the `From:` path is relative or absolute,
and whether it carries the trailing slash; whether the run asked scripted answer 1's
question, which the named feature makes unnecessary; whether an empty `temp/archive/` is
left behind; and the stage and owner the report names.

## Note for scoring

Score per line, and compare plugin against no plugin. Read the order of events from the
transcript: what was shown when, which command ran when, and what each question offered.

The pass lines are of two kinds, and retention is read off the first. **Judgment lines**
use no vocabulary of the skill's: an unaided run that finds the archived folder and reports
from it, touching nothing, passes each of them, and so does one that asks before moving it
back. **Contract lines** score the skill's own question and the shapes its readers depend
on: the pickers look only under `temp/`, so the folder has to be back at
`temp/shift-swaps/`; a later session reads the `reopened` entry's `From:` line to know
where the folder had been; and the handoff kept as it was carries the feature's last stage
into the next resume. A baseline cannot know the question's shape or the ledger entry, so
it fails those two lines by construction; it may pass the folder line by moving the folder
back after asking, and the handoff line by leaving the file alone. They guard the
with-plugin arm against a regression and decide no retention.

Expected baseline: fails the case, and the judgment lines say whether that matters. The
lines that discriminate are consent and telling. An unaided "resume shift-swaps" that
searches the repository finds the folder under `temp/archive/` and most likely reads the
artifacts where they are and reports from there: that passes all three judgment lines and
is the remove verdict for the capability claim — an honest outcome, since the prompt asks
only where the feature stands. Keep comes from a baseline that says the feature does not
exist, failing the telling line; one that moves or copies the folder back on its own
initiative, failing the consent line; or one that copies it, or deletes a file, failing the
files line. On remove, the contract lines stay only as a regression guard, and the case
says so when it is next revised.

The handoff kept as it was still names the close-out's hand-over — the user pushes and opens
the merge request — as its next action. A run that reports that next action is reporting
the file correctly, and passes on it; the handoff line fails a run that rewrites the file,
such as one that changes its stage or next action to mark the feature reopened.

A with-plugin run that says the feature does not exist, or lists the features under
`temp/` without looking under `temp/archive/`, fails the telling line and the question,
folder and ledger lines: the skill did not search the archive for a named feature missing
under `temp/`. One that moves the folder back but writes no `reopened` entry, or writes it
without the `From:` line, fails the ledger line only.

Not covered here: several archived folders for one feature, where the question lists each
path; "Leave it archived", where nothing moves; a name found in neither place; and a request
that carries more than resuming, which the skill routes after its report.
