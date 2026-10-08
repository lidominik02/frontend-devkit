---
name: finishing-features
description: >-
  Closes out a finished feature: checks its plan, review, QA and open questions, asks
  "Are we done?" and runs a menu confirmed item by item — verification, docs, commit, MR
  text, team summary, open items — and archives its folder once the user confirms no work
  is left. Use
  when the user says "close it out", "wrap up the feature" or "are we done with this
  feature". For "write the commit message" or "MR description", use describing-changes;
  for "is this safe to merge", reviewing-changes.
argument-hint: "[feature]"
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/project-facts.mjs) Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.mjs --stage fast *) Bash(git status *) Bash(git log *) Bash(git diff *) Bash(git rev-parse *) Bash(git rev-list *) Bash(git merge-base --is-ancestor *) Bash(git branch --list *) Read Grep Glob Skill AskUserQuestion
---

You close out a finished feature. First you check what the artifacts say is left, then the
user says whether the feature is done, then each finishing step runs only when the user
picks it and confirms its result. Nothing is pushed, merged or opened as a merge request:
those steps are the user's, and this skill hands them over.

In the lifecycle this is the `finish` stage. The chain calls it when the artifacts say done
— a `reviewing-changes` report in the feature's review chain, review or re-review, with
nothing left open, `testing-changes`' report with no findings — and the user's "close it
out" starts it. `describing-changes` writes the commit
message and the merge request text; this skill decides when they are written and what
happens to them.

## 1. Set up

1. **Facts.** Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/project-facts.mjs"`. `<top>` is
   `projectRoot.gitTopLevel`; the base branch is `baseBranch.name`, and a
   `baseBranch.source` of `not detected` or `current branch (no remote HEAD)` detects none:
   ask when an item needs it.
2. **Feature.** The caller or the user names it. When neither does and `<top>/temp/` holds
   feature folders — a folder holding `planning/` with a HANDOFF.md, `temp/archive/`
   excluded — ask with one AskUserQuestion form which one, "none" included. With none,
   section 2 is NOT RUN (no feature) and says so, the form in section 3 still asks, and
   section 5 has no folder to archive.
3. **Reading.** What this skill reads of the feature's artifacts follows "Reading the artifacts" in
   `../planning-features/references/artifacts.md`, and every search of the ledger covers
   planning/archive/PROGRESS.md as well.
4. **A held archive.** The feature's archive is held when HANDOFF.md's stage is `finish`
   and the latest `finish` ledger entry carries `Archive: held`. This run is then its
   later close-out: sections 2 and 3 run as on any feature, section 3 decides whether the
   menu runs again, and section 5 asks the same archive question.

## 2. The completeness check

Read each source and give one line per source in the chat: done, or open with what is
open. Write nothing yet.

- **The plan.** Every task of PLAN.md is Done or Blocked in PROGRESS.md's task table; a
  Blocked task names what blocks it. Any other status is open.
- **The review.** The feature's review chain, `temp/<feature>/review/`: its latest
  `<NN>-review.md` and the re-reviews numbered after it, by "An open finding" in
  `artifacts.md`. Each finding the latest of them leaves open is open here: one no
  `deferred` or `ruling` ledger entry names by its id and its report, the match `re-review`
  makes in `../reviewing-changes/SKILL.md`. No report at all, or a task's `done | open`
  entry after the latest `review` entry whose `Report:` is in `temp/<feature>/review/`, is
  open: work the review has not seen.
- **QA.** `temp/<feature>/qa/REPORT.md`, current by the `qa/` rule in `artifacts.md`, with
  no Findings — or the user's skip, asked in section 3. A current report with findings is
  open.
- **Open questions.** The open entries of OPEN-QUESTIONS.md. One whose `Blocks:` is not
  `nothing` is open; the rest are listed for the reminder.
- **Contract gaps.** Every CONTRACT-GAPS.md entry, reminded only: a gap never makes the
  check open.
- **Hand-over.** The work left to the user beyond pushing and opening the merge request,
  from three sources only: the items HANDOFF.md's Status, as it stands before this run
  writes it, names explicitly as work after the push or the merge request, with Next
  action read as part of Status only when the stage is already `finish`; on a held
  archive, the items of the latest `Archive: held` line, as section 3's answer leaves
  them; and this close-out's own hand-over — what the run leaves to the user after the
  push and the merge request, such as a force-push, a reply to a reviewer or a check that
  runs after the push — known only by section 5, which adds it. On a held archive the
  held items come from that line alone: Status and Next action count only for an item it
  does not already hold. A close-out's own lines — its
  commits, its texts, the menu items not run — are never hand-over work, whichever finish
  wrote them. Listed, never open: section 3 asks which held items are still left, and
  section 5 step 1 recommends from this list.
- **Gates.** `node "${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.mjs" --stage fast --json`, once,
  each with its status; `test` and `build` stay NOT RUN (held) unless the user released
  them. Every later step reuses this result, until the project-docs item applies an edit
  and runs them once more.

## 3. "Are we done?"

One AskUserQuestion form. With nothing open the first option is recommended; otherwise the
recommended one is the route that closes what the check found, and the question names it.

- **"Done — open the finishing menu."** Only now, with a feature, HANDOFF.md gets the
  stage `finish — owner: finishing-features`, the next action "the finishing menu, item by
  item", and its kickoff prompt rewritten to match. Then section 4. Whatever the check left
  open goes into the open-items reminder.
  On a held archive, before that write, the menu is skipped when nothing changed since the
  last finish. The anchor is the last commit listed by the latest `finish` entry that
  lists one, since an entry written after a skipped menu lists none. First
  `git merge-base --is-ancestor <anchor> HEAD`: when it fails — the anchor does not
  resolve, or a rewrite since the last finish left it out of HEAD's history — section 4
  runs, and the user is told the history was rewritten since the last finish. Otherwise
  nothing changed when `git log <anchor>..HEAD` shows no commit and `git status` no
  uncommitted change outside `temp/`: section 5 then follows at once, and the next action
  names the archive question instead of the menu. When either shows something, or no
  `finish` entry lists a commit, section 4 runs as usual.
- **"Found something — fix it."** The free-text answer, or the check's open item, says
  what. An open review finding goes to `core:executing-plans` in `fix-findings` mode. A
  bug the user found, or a QA finding, is triaged by "The triage threshold" in
  `../fixing-bugs/references/loop.md`, and goes where it routes: to `core:fixing-bugs`
  inside the feature — by its evident-cause entry for an evident one-function cause, with
  the evident cause as its diagnosis for a wider one — or to `core:investigating-bugs`
  naming the feature, and the user rules on remit.
- **"Want something more."** An unfinished task of the plan goes to `core:executing-plans`
  for that task. Anything new or changed goes to `core:clarifying-features` in `gap` mode,
  naming what the user wants: it records the decisions and calls planning-features `plan`,
  which revises the plan for approval, and `executing-plans` builds it.

Without a current QA report, the same form asks a second question: run the QA list first
(`core:testing-changes`), or skip QA for this feature. A skip is recorded in section 5.
On a held archive, a "Done" answer with QA current or skipped is followed by forms asking,
multi-select, which of the held items the check listed are still left, four to a question
and four questions to a form; the ones picked stay in the hand-over list, and the rest are
done. Running the list first skips them, as does every other route.
Running the list first ends this run, and a report with no findings calls this skill
again.

A route other than "Done" writes nothing here: it calls its skill, which sets its own
stage, and ends this run. The chain comes back here once the artifacts say done again, or
on the user's word.

## 4. The menu

One AskUserQuestion form with two multi-select questions, since a question holds four
options at most:

- **Checks and texts:** full verification · project-docs update · commit · MR description.
- **Wrap-up:** team summary · open-items reminder · tidy `temp/`.

The picked items run in that order, each by its recipe in `references/menu.md`, and each
shows its result and is confirmed before anything is written, committed or moved.
Verification comes first because its review and its QA run end this run, and a failing
test suite goes back to the section 3 form; the docs come before the commit so they land in
it; the commit comes before the MR text, which describes it. When the picked items are
done, the menu returns once more with the items not yet run and "Nothing more — close out",
until the user picks that.

## 5. Archive and close

Without a feature only step 6 applies, and the archive question does not run.

1. **Archive now, or later.** Decided before anything in this section is written. One
   AskUserQuestion: "Archive now" or "Later — work is left", saying why in one sentence:
   the pickers look only under `temp/`, so an archived feature drops out of them.
   "Later — work is left (recommended)" when PROGRESS.md's task table holds a Blocked
   task, or the hand-over list section 2 recorded holds an item, with this close-out's own
   hand-over added to it by that bullet's third source. Otherwise "Archive now
   (recommended)". The items left are those Blocked tasks and hand-over items, and
   whatever the user's answer names; when that comes out empty on "Later", one more
   AskUserQuestion asks what is left, free text.
   On "Later", steps 3 and 5 are skipped and nothing moves; step 4 writes `Archive: held`
   in place of `Archived:`.
2. **HANDOFF.md**: Status is rewritten to what the finish did — each commit by its short
   hash and subject, each text produced, each item not run — and Next action becomes "the
   user pushes and opens the merge request". The stage stays `finish`. After a skipped
   menu nothing ran, so Status holds only the archive decision. On "Later", Status also
   lists each item left, Next action becomes the first of them, and the kickoff prompt is
   rewritten to match, its paths still under `temp/<feature>/`.
3. **The archive target**: by "The archived feature folder" in `artifacts.md`. It is
   worked out before the ledger write, since the ledger moves with the folder.
4. **PROGRESS.md**: one ledger entry, `- <date> · finish · <n> commits`, with the sub-items
   `- Items: <each menu item run>`, `- Commits: <hash subject>, …`, `- QA: skipped by the
   user` when it was, and `- Archived: <the archive target>` — or, when the archive was
   held, `- Archive: held — <each item left, joined by "; ">`. On a held archive's later
   close-out the entry is a new one, and the held entry stays as it was; its `<n>` counts
   the commits since the last finish, `git rev-list --count <anchor>..HEAD` with the
   anchor section 3 names, or this run's own commits when no `finish` entry lists one or
   the anchor failed section 3's ancestry check.
   After a skipped menu its sub-items are `- Items: none — menu skipped, nothing changed`
   and `- Commits: none`. When it takes the ledger
   past 60 entries, the same write moves closed tasks' entries by "The archive" in
   `artifacts.md`.
5. **Archive the folder.** Move `<top>/temp/<feature>/` to the archive target with
   `mkdir -p <top>/temp/archive` and `mv`, behind the normal permission prompt. Its `bugs/`
   and `syncs/` folders move with it. Nothing is deleted. Say where the folder is now, and
   that `resume` no longer finds the feature under `temp/<feature>/`.
6. **Chat brief**: the commits, the accepted texts in copyable blocks, the open items, and
   the archive path — or, when the archive was held, each item left, that the folder stayed
   at `temp/<feature>/`, and that another "close it out" archives it once no work is left.
   Then the hand-over: the user pushes and opens the merge request; this
   skill does neither. Stop.

## What this must NOT do

- **Push, merge, or create the merge request**, nor offer to. The user pushes, merges and
  opens it.
- **Commit before the user accepted that exact message**, commit anything under `temp/`,
  bypass a commit hook, or amend, squash or otherwise rewrite a commit already made.
- **Run a menu item the user did not pick**, or write, commit or move anything before its
  confirmation.
- **Delete anything**: a file under `temp/`, a backup ref, a branch. The reminder lists
  what the user may delete.
- **Send anything.** The team summary, the MR text and the open items are shown, never
  posted.
- **Run tests, a build, Storybook or a browser** unless the user picked full verification
  or released them.
- **Decide a product question.** Whether the feature is done is the user's answer.
- **Carry a fact about an individual repository.** A repo's conventions live in its own
  files, read at the moment of use.
