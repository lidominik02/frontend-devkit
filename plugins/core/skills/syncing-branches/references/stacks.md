# Stacked branches: lookup

A stacked branch — the child — builds on another branch that has not merged — the parent —
rather than on main. Every git behaviour here was observed on git 2.43.0 or read in its man
pages. The rebase swap applies to every `rebase` below; a `cherry-pick` does not swap.

## Detecting a stack

A branch is stacked when its merge-base with main is behind another unmerged branch's tip:
it shares commits with that branch that main does not hold.

1. The candidates are the other branches, local (`git branch --list`) and remote
   (`git branch --list --remotes`), apart from the base branch and its remote, the child's
   own remote branch, and every `backup/` branch.
2. For each, `git merge-base <child> <candidate>` gives the commit they share. When
   `git merge-base --is-ancestor <that commit> <target>` exits 1, main does not hold it, so
   the candidate is a parent — unless that commit is the child's own tip, which makes the
   candidate a branch built on the child, not its parent.
3. With several parents, the nearest is the one whose shared commit the others' shared
   commits are ancestors of.
4. **Has the parent merged?** `git merge-base --is-ancestor <parent> <target>` exits 0 after
   a merge commit or a fast-forward. A squash or rebase merge leaves it at 1, so also compare
   the parent's files: `git diff --stat <parent> <target> --` with the paths
   `git diff --name-only <merge-base of parent and target> <parent>` lists. Nothing printed
   means main holds the parent's content, and the parent reads as merged. The plan form
   states which test decided it; the user confirms it there.
5. **A parent deleted after its merge** leaves no branch to find. The child's own commits
   then start after the last parent commit: show `git log --oneline <target>..<child>` in
   the plan form and ask which commit is the parent's last.

A parent that exists only as a remote branch is someone else's: nothing here rewrites it,
and a fix it needs is named in the chat for its owner.

## Carrying a fix between them

Each direction is a plan option, with a backup ref for every branch it rewrites. Every
`rebase` and `cherry-pick` here, and every `--continue` after it, carries
`-c merge.conflictStyle=zdiff3`, and every `rebase` carries `--no-update-refs` — both by
`conflicts.md`, which gives the git version each needs.

- **Parent to child.** The parent gained a fix the child needs. Rebasing the child onto the
  parent's tip, `git -c merge.conflictStyle=zdiff3 rebase --no-update-refs <parent>` on the
  child, brings every new parent commit, which is what a child built on top wants. When
  only the fix should come now, `git -c merge.conflictStyle=zdiff3 cherry-pick <sha>` on
  the child brings that one.
- **Child to parent.** A fix made on the child belongs in the parent. `git switch <parent>`,
  `git -c merge.conflictStyle=zdiff3 cherry-pick <sha>`, `git switch <child>`, then rebase
  the child onto the parent: the
  rebase drops the child's own copy as a clean cherry-pick of an upstream commit, so the fix
  is not applied twice. Switching needs a clean working tree; with uncommitted work, the
  plan offers this only once the user has committed it.
- **A commit that mixes the fix with other work** carries all of it. The plan says so;
  splitting it is the user's.

## Moving the child onto main after the parent merged

Once the parent has merged, the child's own commits move onto main and the parent's leave
its history:

```
git -c merge.conflictStyle=zdiff3 rebase --no-update-refs --onto <target> <parent's last commit> <child>
```

`<parent's last commit>` is `git merge-base <child> <parent>` while the parent branch exists,
or the commit the user named when it was deleted. Only the commits after it are replayed.

Always `--onto`, whatever the merge method. After a squash merge, main holds the parent's
change as one new commit, so a plain `git rebase <target>` replays the parent's own commits
on top of it and conflicts on them. Observed: a child of a squash-merged two-commit parent
stopped on the parent's first commit under a plain rebase, while `--onto` replayed only the
child's one commit. After a merge commit or a fast-forward the parent's commits are already
on main and `--onto` skips them the same way.

The overlap scan follows, as after any sync onto main, with `<parent's last commit>` as the
branch side's base: from the old merge-base with main, the child's side would hold the
parent's work too, and every export the parent added would read as an overlap with its own
squashed copy on main.
