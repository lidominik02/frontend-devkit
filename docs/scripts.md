# Scripts

## `snapshot.mjs`

`plugins/core/scripts/snapshot.mjs` is the one script `core` ships. The lifecycle skills use
it to give a review a base that covers uncommitted and untracked work without committing or
staging anything. It needs Node 22 and git, nothing else.

```
node plugins/core/scripts/snapshot.mjs take
node plugins/core/scripts/snapshot.mjs diff <base> [--out <file>]
```

- **`take`** prints a tree id for the current working state: tracked changes, staged
  changes and untracked files that are not ignored. The tree is built in a temporary copy of
  the index, so the user's index stays byte-identical.
- **`diff <base>`** writes a header line, a `--stat` and a `-U10` diff from `<base>` — a
  tree id, a commit or any rev — to the current state, and prints the file's path. The
  header ends in `snapshot tree <id>`, which a later re-review diffs from. A relative
  `--out` resolves from the repository root; without one the file goes to
  `temp/snapshots/`. An `--out` that already exists is refused with exit 1, so an earlier
  review's diff is never overwritten.

**What it leaves out.** `temp/`, every credential path (dotenv files, keys, certificates
and the like) — the header names a credential path that changed, since the diff cannot —
ignored files, and submodule work trees, which are recorded at the commit they have checked
out. Staged and unstaged versions of one file are not told apart.

**What it does not promise.** It is a review base, not a backup. The tree is reachable from
no ref, so `git gc` can prune it once its expiry passes. Recovering committed work is a
backup ref's job; uncommitted work is the user's to commit. A clean filter that is not
`required` and fails stores the content unfiltered, and the script still exits 0 (git
2.43.0); a `required` one that fails (Git LFS sets it) exits 1.

Exit 0 means the tree id or the diff path is on stdout. Exit 1 means nothing is on stdout and
stderr says why: not a git work tree, a failed required clean filter, a base that names no
tree, an existing `--out`, or a usage error.
