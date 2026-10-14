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
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs *) Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs" *) Bash(npm run *) Bash(pnpm run *) Bash(yarn run *) Bash(bun run *) Bash(git status *) Bash(git log *) Bash(git diff *) Bash(git show *) Bash(git merge-base *) Bash(git rev-parse *) Bash(git branch --list *) Bash(git check-ignore *) Read Grep Glob Skill AskUserQuestion
---

You rebase the user's branch onto the branch it builds on and lose nothing from either
side. Apart from the fetch, every git operation runs after one form that approves the plan
and behind a backup ref; a resolved file is marked only after the user approves the
resolution log. Nothing is pushed. The result goes to `reviewing-changes`.

**The rebase swap.** In a rebase git's "ours" (stage 2, `<<<<<<< HEAD`) is the branch
rebased onto, with the commits replayed so far; "theirs" (stage 3) is the user's commit
being replayed — the reverse of a merge. Every log entry and question names the sides
"`<target>` (ours in this rebase)" — main, or the unmerged parent — and "your branch
(theirs in this rebase)", never "ours" or "theirs" alone. "The swap" in
`references/conflicts.md` labels a cherry-pick, which does not swap.

## The three situations

- **A finished branch after main moved.** Its commits are replayed onto the current main,
  then the overlap scan looks for what main brought that the branch also built.
- **Mid-work.** The same rebase. The plan asks the user to commit the uncommitted work
  first; with it uncommitted the plan stops. The overlap scan matters most here.
- **Stacked branches**, detected by `references/stacks.md`. The plan offers carrying a fix
  either way between them and, once the parent has merged (a squash merge included),
  moving the child onto main with `rebase --onto`.

An operation already stopped on conflicts — the user's own rebase or cherry-pick — runs the
same recipe: the plan finishes it, from a backup ref at the tip it started from. A merge in
progress is never continued: the plan gives the user `git merge --abort` to run (a
merge deny rule blocks it here), then the rebase, or stopping.

## 1. Set up

1. **Facts.** By `../planning-features/references/project.md`: the package manager, the
   framework packs (load each), the gates and the base branch. The target is that base
   branch — `origin/<base>`, else the local branch; none found: ask. A stacked child's
   target is its parent until the parent has merged.
2. **Branch and state.** `git rev-parse --abbrev-ref HEAD` names the branch; "An operation
   in progress" in `references/conflicts.md` detects a rebase, cherry-pick or merge under
   way and, HEAD being detached then, gives the branch. On the base branch itself: nothing
   to rebase, say so and stop.
3. **Work folder.** The slug is the branch name with each `/` made `-`, then
   `-<YYYYMMDD-HHMM>`. Inside a feature — one the caller or the user names — the folder is
   `temp/<feature>/syncs/<slug>/`, otherwise `temp/syncs/<slug>/`, under the top level
   `<top>` that `git rev-parse --show-toplevel` prints. It holds `LOG.md`, below, written
   as each step ends. When `git check-ignore -q <top>/temp/` exits 1, say once that it lands
   in an untracked `temp/`. Never `git add` it. A feature's files are read by "Reading" in
   `../planning-features/references/artifacts.md`.
4. **Baseline.** Before anything moves, run the fast gates of each workspace the branch
   touches, as step 1 read them, and take
   the pre-sync tree, `node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs" take`; record
   both in LOG.md. The tree holds the untracked work as it stands, apart from `temp/` and
   credential paths. It is the pre-sync state: the overlap scan's and the review's base.
   With an operation in progress, the gates are NOT RUN (operation in progress) — its
   markers break them — and the pre-sync state is the tip it started from; the tree, taken
   as the in-progress tree, records each file the user resolved by hand, which an abort
   discards — except a credential path or a file under `temp/`, which it leaves out: name
   each such unmerged path for the user to copy before any abort.

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

First fetch a remote target, `git fetch origin <base>`, behind the permission prompt: it
moves only the remote-tracking ref. Then look with read-only git — `merge-base`, `log`,
`diff --name-only` of each side since the merge-base — and write the plan into LOG.md, its
commands verbatim and in order. It names:

- the branch, the target and its commit as fetched;
- the commits to replay (`git log --oneline <merge-base>..HEAD`) and how many main brought;
- the files both sides changed since the merge-base: where the conflicts will be;
- the uncommitted work `git status --porcelain` lists, apart from this skill's `temp/` folder
  and, in an operation in progress, the paths that operation holds unmerged or staged as
  resolutions — anything else listed stops the plan there;
- each stack operation (`references/stacks.md`) and each rewritten branch's backup ref;
- for a lockfile conflict, the install of the manager that owns that lockfile, run in the
  lockfile's directory, by "regenerate" in `references/conflicts.md`;
- what it will not do: push. The user force-pushes.

Ask one AskUserQuestion form: "Run this plan (recommended)" or "Stop here", with each stack
operation as a further question in the same form. No mutating command but the fetch runs
before the answer; each runs after it, behind the normal permission prompt.

## 3. Backup ref and the operation

1. **Backup ref**, for each branch the plan rewrites, before anything else moves:
   `git branch backup/<branch>/<YYYYMMDD-HHMM> <tip>` — the branch's commit before the
   operation, or the commit an operation in progress started from. Record each in LOG.md
   with its commit. This skill never deletes one; the user does.
2. **Run the operation** as the plan words it:
   `git -c merge.conflictStyle=zdiff3 rebase --no-update-refs <target>` — zdiff3 shows the
   base between the sides, `--no-update-refs` moves only the named branch, and every
   `--continue` repeats the `-c`. "zdiff3" and "Moving only the named branch" in
   `references/conflicts.md` give the git versions. Just before each rebase, record its onto
   commit, `git rev-parse --verify <target>^{commit}`; for a rebase in progress, read
   `rebase-merge/onto` under `git rev-parse --git-path`.
3. A run with no conflict goes to section 5; a stop on conflicts goes to section 4.

## 4. Each stop — one replayed commit that conflicts: classify, resolve, log

1. **List** the unmerged paths (`git status --porcelain`), the `CONFLICT` lines, and the
   commit being replayed: `git log -1 REBASE_HEAD` (`CHERRY_PICK_HEAD` in a cherry-pick).
2. **Classify** each file by "The classes" in `references/conflicts.md`: regenerate,
   trivial, semantic, or rename (a rename or file-location conflict).
3. **Resolve** in the working tree only — with Edit and Write, a side taken whole with
   `git checkout --ours | --theirs <path>`, or the regeneration command. Nothing writes the
   index yet. A side taken whole with a shell command then goes through the project's
   formatter, by `project.md`, that file alone, the command in the entry's Evidence.
   A regenerated file stays as its tool wrote it. A semantic conflict keeps both intents
   wherever both can hold; only a true conflict is a question, in batched forms of up to
   four, each giving both sides' intent with evidence, labelled with the swap, and a
   recommended resolution first.
4. **Check.** `git diff --check` reports no leftover conflict marker in a resolved file. A
   resolution that leaves the replayed commit with no change drops that commit on continue
   ("Continuing" in `references/conflicts.md`): its entry and the form name it.
5. **Log** one entry per file in LOG.md.
6. **The log form.** Each file with its class and resolution in a line, any commit that
   drops, and LOG.md's path. "Mark resolved and continue (recommended)", "Change a
   resolution" — the free-text answer names which and how; resolve, log and ask again — or
   "Stop and abort the operation" (section 7), whose wording says what the abort discards.
7. **Mark and continue**, only after that answer: `git add <path>` for each resolved file
   and `git rm <path>` for each path the resolution removes, then
   `git -c merge.conflictStyle=zdiff3 -c core.editor=true rebase --continue` —
   `cherry-pick --continue` for a cherry-pick — so the next stop shows the base too and
   each replayed commit keeps its message. The next stop is this section again.

## 5. The overlap scan

After every sync onto main, conflicts or not, find what main brought that the branch also built.

1. **Compare** what main brought, `git diff <old merge-base> <new target>`, with what the
   branch added, `git diff <branch base> <pre-sync state>`. The branch base is the old
   merge-base; for a child moved onto main after its parent merged, it is the parent's last
   commit (`references/stacks.md`). A candidate is a new export, component, composable,
   util, store or type on each side with a similar name or the same purpose, read from both
   bodies. The scan proposes; the user decides.
2. **Ask** each candidate in batched forms, one question each: both definitions at
   `path:line`, their callers, and every behavioural difference — signature, defaults,
   edge cases, errors. The options, the recommended one first, named with the side labels,
   never "ours", "theirs" or "mine": "main's" (main's stays, your branch's callers move to
   it, your branch's copy goes); "your branch's" (the reverse); "forged" (one definition
   holding both). An option that changes what any caller does says so.
3. **Apply** each answer with Edit and Write; the user commits. Log each candidate, the
   decision, what changed and the callers it touched; with no candidate, what was compared.

## 6. Gates, close and review

1. **Gates.** Run the fast gates as the baseline ran them and compare error by error: a
   failure the baseline had is pre-existing, one it did not have is the sync's. The held
   checks (`project.md`, `## Held checks`) stay NOT RUN (held) until the user releases them.
2. **Chat brief**: each branch and its new tip, the conflicts per class, any dropped
   commit, the overlap decisions, the gates, each backup ref and how section 7 restores it,
   and LOG.md's path. Inside a feature whose final review has not run, it says that review
   covers this sync. The user force-pushes, with `git push --force-with-lease`.
3. **Inside a feature**, one STATUS.md Log line: the sync, LOG.md's path, each backup ref
   at its commit. When the sync rebased the branch, the onto commit section 3 recorded
   replaces `Verified`'s `pre-execution tree:`: the rebase put commits not the feature's
   under the old tree, so a review from it would count them as the feature's.
4. **Review.** Outside a feature, call the Skill tool with "core:reviewing-changes", no
   feature, the pre-sync state as the base. Inside a feature whose final review has run —
   its report is in `temp/<feature>/review/` — call it in `re-review` mode for the feature;
   before that review, stop after step 3. Either diff holds what main brought as well as
   the resolutions; say so in the chat. The call ends this skill's run.

## 7. Stop and undo

- **At the plan form**, only the fetch has run, and it moved only the remote-tracking ref.
- **During an operation**, `git rebase --abort` — `git cherry-pick --abort` for a
  cherry-pick — puts HEAD back where the operation started. It discards every resolution
  in the working tree: this skill's, which LOG.md keeps, and, for an operation the user
  started, the files resolved by hand: the in-progress tree keeps those it holds (`git show
  <tree>:<path>`), never a credential path or `temp/`. The log form's stop option names
  each, that tree, and each resolved path the tree lacks as lost unless the user copies it
  first; choosing it confirms.
- **After a finished sync**, restoring is a destructive reset, discarding the rebased
  commits and every resolution and consolidation since. Only after a confirmation form
  naming what it discards, "Keep the sync (recommended)" first, and by "Restoring the
  backup" in `references/conflicts.md`: a new backup ref at the synced tip, then
  `git reset --hard <backup ref>`.

## What this must NOT do

- **Push, force-push, merge or open a merge request.** The user pushes.
- **Merge main into the branch**, or continue a merge in progress.
- **Run a mutating git command before the plan form's answer**, the target's fetch apart,
  or an operation without its backup ref. Never delete a backup ref.
- **Mark a file resolved or continue before the log form's answer** — no `git add`,
  `git rm` or `git reset` of a conflicted path until then.
- **Merge a lockfile or a generated file by hand**, or rewrite a branch the plan does not
  name.
- **Drop a commit silently.** A `--skip`, or a resolution that empties a commit, is named
  in the log and the form first.
- **Reset to a backup ref, or run any `git reset --hard`,** without the confirmation form
  and a new backup ref at the tip it discards.
- **Decide a product question.** Where intents truly conflict, and for every overlap, the
  user decides.
- **Run heavier checks the user did not release** (`../planning-features/references/project.md`, `## Held checks`), **Storybook or a
  browser** unreleased, or a command that writes as a gate (`## Gates` there).
- **Carry a fact about an individual repository**; its own files are read at use.
