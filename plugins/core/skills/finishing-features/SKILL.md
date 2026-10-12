---
name: finishing-features
description: >-
  Closes out a finished feature: checks its plan, review, QA and open questions, asks
  "Are we done?", then runs the commit, the MR text and the open items, each confirmed
  before it is written, and archives its folder once the user agrees. Use when the user
  says "close it out", "wrap up the feature" or "are we done with this feature". For
  "write the commit message" or "MR description", use describing-changes; for "is this
  safe to merge", reviewing-changes.
argument-hint: "[feature]"
allowed-tools: Bash(git status *) Bash(git log *) Bash(git diff *) Bash(git rev-parse *) Bash(git rev-list *) Bash(git symbolic-ref *) Bash(git fetch origin *) Bash(git branch --list *) Bash(git add -- *) Bash(git commit -F *) Bash(mkdir -p temp/archive) Bash(mv temp/*) Read Write Grep Glob Skill AskUserQuestion
---

You close out a finished feature. First you check what the feature's files say is left,
then the user says whether the feature is done, then each finishing step runs with the
user's confirmation. Nothing is pushed, merged or opened as a merge request: those steps
are the user's.

In the lifecycle this is the `finish` stage. The chain calls it when the latest review
leaves nothing open; the user's "close it out" starts it too. `describing-changes` writes
the commit message and the merge request text; this skill decides when they are written and
what happens to them.

## 1. Set up

The feature is the one the caller or the user names; with several feature folders (holding
STATUS.md) under `temp/` and none named, ask with one form, "none" included. The base branch comes from
`../planning-features/references/project.md`. Read STATUS.md and PLAN.md whole.

## 2. The completeness check

One line per source in the chat — done, or open with what is open. Write nothing yet.

- **Tasks.** Every row of STATUS.md's Tasks table is `done` or `blocked`.
- **Review.** The open findings, as `../planning-features/references/artifacts.md` defines
  them, are open. No report at all is open: the review has not seen the work.
- **QA.** qa/REPORT.md with no findings, or the user's skip, asked in section 3.
- **Open questions.** DECISIONS.md's OQ lines without `answered:` whose `blocks:` is not
  `nothing` are open; the rest are listed as a reminder.
- **Contract gaps.** Every CONTRACT-GAPS.md line, as a reminder only.
- **Gates.** STATUS.md's `Verified` `latest:` results — the final review's run; with none,
  each gate is NOT RUN on the final code. Nothing runs again.

## 3. "Are we done?"

One form. With nothing open, the first option is recommended; otherwise the route that
closes what the check found.

- **Done** — go to section 4.
- **Found something** — an open review finding goes to `core:executing-plans` in
  `fix-findings` mode; a bug the user found, or a QA finding, to `core:fixing-bugs`.
- **Want something more** — `core:clarifying-features` in `gap` mode for the feature.

Without a current QA report, the same form asks a second question: run the QA list first
(`core:testing-changes`), or skip it. A route other than Done writes nothing and ends this
run.

## 4. Commit, MR text, open items

Three steps, in this order, each with its own form; the user may skip any.

1. **Commit.** `git status --porcelain` lists what changed. Call the Skill tool with
   "core:describing-changes" with "Text only. Use these gate results and run no gate: …" and
   the `Verified` lines; its shape follows
   `../describing-changes/references/shaping-commits.md`. Show the message;
   on acceptance, write it with the Write tool to a file outside the repository — never in
   quotes on a command line — then `git add -- <files>` and
   `git commit -F <message file> -- <files>`, the files named one by one, nothing under
   `temp/`.
2. **MR description.** `git fetch origin <base>`; when `git rev-list --count
   HEAD..origin/<base>` is above 0, say the branch is behind and offer
   `core:syncing-branches`. The text follows the repository's merge request template, shown
   in a copyable block.
3. **Open items.** The open questions, the contract gaps, the open findings, each NOT RUN
   gate, and `git branch --list 'backup/*'` — listed for the user, nothing deleted.

## 5. Close

1. STATUS.md: Stage `finish — owner: finishing-features`; each commit by its short hash and
   subject in a Log line; Next action "the user pushes and opens the merge request".
2. One form: **Archive now** (recommended when no task is blocked) or **Leave it**. Archive:
   `mkdir -p temp/archive && mv temp/<feature> temp/archive/<feature>`; when that name
   exists, `temp/archive/<feature>-<YYYYMMDD-HHMM>`. Leave: nothing moves.
3. Chat brief: the commits, the accepted texts in copyable blocks, the open items, and where
   the folder is now. Pushing, merging and opening the merge request are the user's. Stop.

## What this must NOT do

- **Push, merge, or create the merge request**, nor offer to.
- **Commit before the user accepted that exact message**, commit anything under `temp/`,
  bypass a commit hook, or amend, squash or otherwise rewrite a commit already made.
- **Delete anything**: a file under `temp/`, a backup ref, a branch.
- **Send anything.** The MR text and the open items are shown, never posted.
- **Run tests, a build, Storybook or a browser.**
- **Decide a product question.** Whether the feature is done is the user's answer.
- **Carry a fact about an individual repository.** A repo's conventions live in its own
  files, read at the moment of use.
