---
name: syncing-branches
description: >-
  Brings the user's branch up to date by rebasing it — onto main after main moved,
  mid-work, or across stacked branches — behind a backup ref, keeping both sides' intent
  in every conflict and consolidating what main also added. Use when the user says
  "update my branch", "rebase on main", "resolve these conflicts", "main moved" or "the
  parent branch merged". For "is this safe to merge" or "review this", use
  reviewing-changes.
argument-hint: "[feature] [branch]"
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/project-facts.mjs) Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs *) Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.mjs *) Bash(git status *) Bash(git log *) Bash(git diff *) Bash(git show *) Bash(git merge-base *) Bash(git rev-parse *) Bash(git branch --list *) Bash(git check-ignore *) Read Grep Glob Skill AskUserQuestion
---

You bring the user's own branch up to date with the branch it builds on, by rebasing it,
and lose nothing from either side. Apart from the fetch that makes the plan current, every
git operation runs after one form that approves the plan and behind a backup ref. A
resolved file is marked only after the user approves the resolution log. Nothing is
pushed: the user force-pushes.

In the lifecycle this runs whenever main moves under a branch — mid-work, or before the
merge request — and hands the result to `reviewing-changes`, which reviews it against the
pre-sync branch, or, inside a feature, in the feature's review chain.

**The rebase swap.** During a rebase git's "ours" — stage 2, `<<<<<<< HEAD` — is the branch
being rebased onto: main, with the user's commits replayed so far. "Theirs" — stage 3 — is
the user's own commit being replayed. That is the reverse of a merge. Every log entry and
every resolution question names the sides "`<target>` (ours in this rebase)" — main, or the
parent's name for a child rebased onto its unmerged parent — and "your branch (theirs in
this rebase)", never "ours" or "theirs" alone. A cherry-pick does not swap: ours is the
branch receiving the commit. A cherry-pick and an autostash label their sides by "The
swap" in `references/conflicts.md`, which holds the mechanics.

## The three situations

- **A finished branch after main moved.** Its commits are replayed onto the current main,
  then the overlap scan looks for what main brought that the branch also built.
- **Mid-work.** The same rebase, with the uncommitted work carried across by `--autostash`
  or committed by the user first; the plan form asks which. The overlap scan matters most
  here: the branch is still growing, so what main just brought is what it should build on.
- **Stacked branches.** The branch builds on another unmerged branch, detected by
  `references/stacks.md`. The plan offers carrying a fix either way between them and, once
  the parent has merged, moving the child onto main with `rebase --onto`, a squash merge
  included.

An operation already stopped on conflicts — the user's own rebase or cherry-pick, "resolve
these conflicts" — runs the same recipe; its plan is to finish that operation, and its
backup ref is the tip it started from. A merge in progress is never continued here: the plan
offers `git merge --abort` and the rebase, or stopping so the user finishes the merge.

## 1. Set up

1. **Facts.** Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/project-facts.mjs"`. For each
   `stack.packs` entry, in order, call the Skill tool with that pack's engineering skill; a
   later pack wins every conflict. The target is `baseBranch.name`: `origin/<base>` when
   `git rev-parse --verify --quiet refs/remotes/origin/<base>` exits 0, else the local
   branch. A `baseBranch.source` of `not detected` or `current branch (no remote HEAD)`
   detects none: ask. A stacked child's target is its parent until the parent has merged.
2. **Branch and state.** `git rev-parse --abbrev-ref HEAD` names the branch — during a
   rebase HEAD is detached, and "An operation in progress" gives the branch instead. On the
   base branch itself there is nothing to rebase: say so and stop. `git status --porcelain`
   shows the uncommitted work. "An operation in progress" in `references/conflicts.md`
   detects a rebase, cherry-pick or merge already under way; `references/stacks.md`
   detects a stack.
3. **Work folder.** The slug is the branch name with each `/` made `-`, then
   `-<YYYYMMDD-HHMM>`. Inside a feature — one the caller or the user names — the folder is
   `temp/<feature>/syncs/<slug>/`, otherwise `temp/syncs/<slug>/`, both under the top level
   `<top>` that `projectRoot.gitTopLevel` reports. It holds `LOG.md`, in the shape below,
   written as each step ends. When `git check-ignore -q <top>/temp/` exits 1, say once that
   it lands in an untracked `temp/`. Never `git add` it. Inside a feature, what this skill
   reads of the feature's artifacts follows "Reading the artifacts" in
   `../planning-features/references/artifacts.md`.
4. **Baseline.** Before anything moves, run the fast gates and take the pre-sync tree, and
   record both in LOG.md. The tree holds the uncommitted and untracked work as it stands,
   apart from `temp/` and credential paths. It is the pre-sync state: the overlap scan's
   and the review's base, and the restore's source. With an operation already in progress,
   the gates are NOT RUN (operation in progress), since its conflict markers break them,
   and the pre-sync state is the tip the operation started from. The tree is still taken,
   as the in-progress tree: it records every file the user already resolved by hand, which
   an abort would discard.

   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.mjs" --stage fast --json
   node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs" take
   ```

LOG.md:

```
# Sync — <branch> — <date>
## Plan        the operation plan, its commands verbatim, and the form's answer
## Backup      each backup ref at its commit · the pre-sync or in-progress tree · the baseline gates
## Stops       per stop: the commit being replayed, then one entry per file
## Overlaps    each candidate, its proposal, the user's decision, what changed
## Gates       the fast gates after the sync, against the baseline
## Review      the review report's path
```

One entry per conflicted file, the side labels following the operation:

```
- `<path>` · regenerate | trivial | semantic | rename
  - <Target> (ours in this rebase): <its intent> — <the commit or message it comes from>
  - Your branch (theirs in this rebase): <its intent> — <the commit>
  - Resolution: <what the file became>
  - Evidence: <the command run and what it showed>
```

## 2. The plan and its form

First fetch the target when it is remote, `git fetch origin <base>`, behind the permission
prompt: it moves only the remote-tracking ref, so the counts and the conflict files below
are current. Then look with read-only git — `merge-base`, `log`, `diff --name-only` of
each side since the merge-base — and write the plan into LOG.md, its commands verbatim and
in order. It names:

- the branch, the target and its commit as fetched;
- the commits to replay (`git log --oneline <merge-base>..HEAD`) and how many main brought;
- the files both sides changed since the merge-base: where the conflicts will be;
- the uncommitted work, as `git status --porcelain` lists it, and how it is carried:
  `--autostash`, or the user commits first;
- each stack operation, by `references/stacks.md`;
- the backup ref of each branch it rewrites;
- for a lockfile conflict, the install of the manager that owns that lockfile, run in the
  lockfile's directory, by "regenerate" in `references/conflicts.md`;
- what it will not do: push. The user force-pushes.

Ask one AskUserQuestion form: "Run this plan (recommended)" or "Stop here", with each choice
the plan holds — the carry of uncommitted work, each stack operation — as a further question
in the same form. No mutating command but the fetch runs before the answer; each runs after
it, behind the normal permission prompt.

## 3. Backup ref and the operation

1. **Backup ref**, for each branch the plan rewrites, before anything else moves:
   `git branch backup/<branch>/<YYYYMMDD-HHMM> <tip>`, where the tip is the branch's
   commit before the operation, or, for an operation already in progress, the commit it
   started from. Record each in LOG.md with its commit. This skill never deletes one; the
   user does.
2. **Run the operation** as the plan words it, with `-c merge.conflictStyle=zdiff3` so each
   conflict shows the base between the two sides, and `--no-update-refs` so only the branch
   the plan names moves:
   `git -c merge.conflictStyle=zdiff3 rebase --no-update-refs [--autostash] <target>`.
   `-c` lasts for one command, so every `--continue` repeats it. "zdiff3" and "Moving only
   the named branch" in `references/conflicts.md` give the git versions both need.
   Just before each rebase, resolve its onto target to a commit,
   `git rev-parse --verify <target>^{commit}`, and record it in LOG.md, so a later move of
   main or of the parent does not change it; for a rebase already in progress, read it from
   `rebase-merge/onto` under `git rev-parse --git-path`.
3. A run with no conflict goes to section 5; a stop on conflicts goes to section 4.

## 4. Each stop: classify, resolve, log

A stop is one replayed commit whose changes conflict.

1. **List** the unmerged paths from `git status --porcelain`, the operation's `CONFLICT`
   lines, and the commit being replayed: `git log -1 REBASE_HEAD`, or `CHERRY_PICK_HEAD`
   in a cherry-pick.
2. **Classify** each file into one class by "The classes" in `references/conflicts.md`:
   regenerate, trivial, semantic, or rename (a rename or file-location conflict).
3. **Resolve** in the working tree only — with Edit and Write, a side taken whole with
   `git checkout --ours | --theirs <path>`, which writes only the working tree, or the
   regeneration command. Nothing writes the index yet. A side taken whole with Bash is then
   formatted, since no format-on-write hook follows a Bash write: "The format pass after a
   Bash edit" in `../executing-plans/references/dispatch.md` over that file alone, and its
   command goes into the entry's Evidence; when nothing resolves, the entry says so. A regenerated file stays as its tool
   wrote it. A lockfile or a generated file is regenerated, never merged by hand. A
   semantic conflict keeps both intents wherever both can hold; only where they truly
   conflict is it a question, asked in batched forms of up to four questions, each giving
   both sides' intent with its evidence, the sides labelled with the swap, and a
   recommended resolution first.
4. **Check.** `git diff --check` reports no leftover conflict marker in a resolved file. A
   resolution that leaves the replayed commit with no change drops that commit on continue
   ("Continuing" in `references/conflicts.md`): its entry and the form name it.
5. **Log** one entry per file in LOG.md.
6. **The log form.** One form: each file with its class and its resolution in a line, any
   commit that drops, and LOG.md's path. "Mark resolved and continue (recommended)",
   "Change a resolution" — the free-text answer names which and how; resolve, log and ask
   again — or "Stop and abort the operation" (section 7), whose wording says what the abort
   discards.
7. **Mark and continue**, only after that answer: `git add <path>` for each resolved file
   and `git rm <path>` for each path the resolution removes, then
   `git -c merge.conflictStyle=zdiff3 -c core.editor=true rebase --continue` —
   `cherry-pick --continue` for a cherry-pick — so the next stop shows the base too and
   each replayed commit keeps its message. The next stop is this section again.
8. **An autostash conflict**, when the carried work does not apply over the rebased branch,
   goes through the same steps; its marking is `git reset -q -- <path>`, which clears the
   conflict and leaves the work uncommitted and unstaged. Git keeps the stash entry: name
   it in the chat for the user, and never drop it.

## 5. The overlap scan

After every sync onto main, whether or not anything conflicted, look for what main brought
that the branch also built, with no conflict to show it.

1. **Compare** what main brought since the old merge-base,
   `git diff <old merge-base> <new target>`, with what the branch added,
   `git diff <branch base> <pre-sync state>`, its uncommitted work included. The branch
   base is the old merge-base; for a child moved onto main after its parent merged, it is
   the parent's last commit (`references/stacks.md`), so the parent's work counts as
   main's and none of it reads as an overlap. A candidate
   is a new export, component, composable, util, store or type on each side with the same
   or a similar name, or with the same purpose, read from both bodies. The scan proposes;
   the user decides.
2. **Ask** each candidate in batched forms, one question each: both definitions at
   `path:line`, their callers, and every behavioural difference between them — signature,
   defaults, edge cases, errors. The options, the recommended one first, named with the
   side labels, never "ours", "theirs" or "mine": "main's" (main's stays, your branch's
   callers move to it, your branch's copy goes); "your branch's" (your branch's stays,
   main's callers move to it); "forged" (one definition holding both, saying what changes
   for which caller). An option that changes what any caller does says so.
3. **Apply** each answer with Edit and Write; the user commits. Log each candidate, the
   decision, what changed and the callers it touched. With no candidate, log what was
   compared.

## 6. Gates, close and review

1. **Gates.** Run the fast gates as the baseline ran them and compare error by error: a
   failure the baseline had is pre-existing, one it did not have is the sync's. `test` and
   `build` stay NOT RUN unless the user released them (`--gate test --json`).
2. **Chat brief**: each branch and its new tip, the conflicts per class, any dropped
   commit, the overlap decisions, the gates, each backup ref and how section 7 restores it,
   and LOG.md's path. Inside a feature whose final review has not run, it says that review
   covers this sync. The user force-pushes, with `git push --force-with-lease`; this skill
   never pushes.
3. **Inside a feature**, one PROGRESS.md ledger entry, `- <date> · sync · <slug> · <status>`,
   with the sub-items `- Ref: <backup ref> at <commit>`, one per backup ref,
   `- LOG: <LOG.md path>`, and, when the sync rebased the branch,
   `- Final review: from <commit>`, the onto commit section 3 recorded: main's tip, or the
   parent's tip for a child synced onto its unmerged parent. The rebase put commits that
   are not the feature's under its pre-execution tree, and for that child the merge-base
   with main sits below the parent's commits, so a review from it would count them as the
   feature's. When it takes the ledger past 60 entries, the same write moves
   closed tasks' entries to planning/archive/PROGRESS.md, by "The archive" in
   `../planning-features/references/artifacts.md`.
4. **Review.** Outside a feature, call the Skill tool with "core:reviewing-changes", naming
   no feature and the pre-sync state from section 1 as the base. Inside a feature whose
   final review has run, by "The review chain" in
   `../planning-features/references/artifacts.md`, call it in `re-review` mode for the
   feature. Either diff holds what main brought as well as the resolutions; say so in the
   chat. The call ends this skill's run. Before the final review, this skill stops after
   step 3.

## 7. Stop and undo

- **At the plan form**, only the fetch has run, and it moved only the remote-tracking ref.
- **During an operation**, `git rebase --abort` — `git cherry-pick --abort` for a
  cherry-pick — puts HEAD back where the operation started and reapplies an autostash. It
  discards every resolution in the working tree: this skill's, which LOG.md keeps, and, for
  an operation the user started, the files the user resolved by hand, which the in-progress
  tree keeps (`git show <tree>:<path>` reads one back). The log form's stop option names
  those files and that tree, and choosing it is the confirmation.
- **After a finished sync**, restoring the backup ref is a destructive reset: it discards
  the rebased commits and every resolution and consolidation made since. It runs only after
  a confirmation form that names what it discards, "Keep the sync (recommended)" first, and
  then by "Restoring the backup" in `references/conflicts.md`, which first puts a new backup
  ref at the synced tip.

## What this must NOT do

- **Push, force-push, merge or open a merge request.** The user pushes.
- **Merge main into the branch**, or continue a merge in progress. The user's branches are
  rebased.
- **Run a mutating git command before the plan form's answer**, the target's fetch apart,
  or an operation without its backup ref. Never delete a backup ref or a stash entry.
- **Mark a file resolved or continue before the log form's answer** — no `git add`,
  `git rm` or `git reset` of a conflicted path until then.
- **Merge a lockfile or a generated file by hand.**
- **Drop a commit silently.** A `--skip`, or a resolution that empties a commit, is named
  in the log and the form first.
- **Reset to a backup ref, or run any `git reset --hard`,** without the confirmation form
  and a new backup ref at the tip it discards.
- **Rewrite a branch the plan does not name.**
- **Decide a product question.** Where intents truly conflict, and for every overlap, the
  user decides.
- **Run tests, a build, Storybook or a browser** before the user releases them.
- **Carry a fact about an individual repository.** A repo's conventions live in its own
  files, read at the moment of use.
