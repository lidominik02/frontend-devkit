# Conflicts: lookup

Every git behaviour here was observed on git 2.43.0 or read in its man pages.

## The classes

Each conflicted file gets one class. The class decides how it is resolved and what its log
entry must show as evidence.

### regenerate

A file derived from others: a lockfile, or a generated file. A lockfile is any file the
table below lists for the package manager `project-facts` reports as `packageManager`, in
any workspace package, and any other file the table lists, whatever manager is detected: a
file a package manager writes is never merged by hand. A generated file is one whose header
says it is generated or not to be edited, that `.gitattributes` marks `linguist-generated`,
or that a script in `package.json` writes. Its lines cross-reference each other, so a merge
of its hunks is wrong even when it parses.

1. Resolve its sources first: `package.json` for a lockfile, the schema or the source files
   for a generated file. They are ordinary conflicts of their own class.
2. Take the side being built on whole: `git checkout --ours <path>` in a rebase, which is
   `<target>`'s side — main, or the parent's name — or in a cherry-pick, which is the
   receiving branch's.
3. Run the regeneration: for a lockfile, the install on the table row that lists it — the
   manager that owns that file, whatever `packageManager` names — run in the lockfile's own
   directory; for a generated file, its generator. A generator that runs only inside a held
   command — the build, the dev server — is not run: the file keeps that side, and a
   question in the stop's batch says which command regenerates it. A generated file whose
   generator cannot be found is a question too.
4. Evidence: the command, the directory it ran in and its exit code; that `git diff --check`
   finds no marker; and, for a lockfile, that it lists each dependency the branch added to
   the `package.json` beside it.

| Package manager | Its lockfiles | Regenerates the lockfile | Source |
| --- | --- | --- | --- |
| npm | `package-lock.json`, `npm-shrinkwrap.json` | `npm install` | npm 5.7.0 release notes: `npm install` fixes a conflicted `package-lock.json`. npm's docs: with both files present, `npm-shrinkwrap.json` takes precedence |
| pnpm | `pnpm-lock.yaml` | `pnpm install` | pnpm.io/git: `pnpm install` resolves conflicts in `pnpm-lock.yaml` |
| yarn | `yarn.lock` | `yarn install` | yarnpkg/yarn#3544, Yarn Classic; Yarn Berry's behaviour is unverified |
| bun | `bun.lock`, `bun.lockb` | `bun install` | bun.sh docs: Bun v1.2 made the text `bun.lock` the default; `bun.lockb` is the older binary form. Conflict handling unverified |

Taking the side being built on first means the install starts from a lockfile with no
markers, which is what makes the command valid where the manager's own conflict handling is
unverified. The install runs behind the permission prompt, as the plan named it.

### trivial

The two sides do not disagree, which the file's three versions show:

- **identical**: `git diff :2:<path> :3:<path>` prints nothing;
- **whitespace only**: `git diff --ignore-all-space :2:<path> :3:<path>` prints nothing —
  take the side being built on, then the format pass the skill's Resolve step runs over it
  decides;
- **one side a superset**: every change one side made to the base, in the zdiff3 region
  between `|||||||` and `=======`, the other side also made, and it removed nothing the
  other kept. Take the superset.

Evidence: the command that showed it, or the hunk compared against the base.

### semantic

Both sides changed the same lines for their own reasons. Recover each intent per hunk before
resolving:

- **main's side**: `git log --format='%h %s%n%b' <old merge-base>..<target> -- <path>`, and
  `git log -L<start>,<end>:<path> <target>` for the hunk's own history;
- **the branch's side**: the commit being replayed, `git show REBASE_HEAD`
  (`CHERRY_PICK_HEAD` in a cherry-pick), and the branch's earlier commits on the path;
- any document a commit or the code cites — a decision record, a spec, a convention file.
  A side that departs from a written rule says so in its intent.

Both intents are kept wherever both can hold: combine the hunks so each still does what its
commit meant. They truly conflict only when both cannot hold — one value set two ways, one
side removing what the other extends, two behaviours for the same input. Only that becomes
a question, and it carries both intents with their evidence, never one side's rationale
alone.

Evidence: the commits each intent came from, and for a combined hunk, what each side still
does.

### rename

A conflict about where a file lives or whether it exists, rather than its content. Git
names the kind in its `CONFLICT (<kind>)` line: rename/rename, rename/delete,
modify/delete, file location. Observed on a rebase that replays a directory rename while
main added a file inside the old directory:

```
CONFLICT (file location): lib/new.ts added in HEAD inside a directory that was renamed in
6268953 (feat change, move lib to src), suggesting it should perhaps be moved to src/new.ts.
```

`git status --porcelain` then lists `AU src/new.ts` and `D  lib/new.ts`.

- **The path follows the side that moved it**, and the other side's content change goes to
  that path.
- **modify/delete**: the deleting commit's message says why. A file moved or replaced gets
  the other side's change carried to where it went; a file removed while the other side
  extended it is a question.
- **References follow the file.** Grep for the old path and its import specifiers; each
  import the move breaks is updated in the same resolution.

Evidence: the `CONFLICT` line, where the file ended, and the grep that finds no reference
to the old path.

## Git mechanics

### The three versions

`git show :1:<path>` is the base, `:2:` is ours, `:3:` is theirs. `git status --porcelain`
marks an unmerged path `UU` (both modified), `AA` (both added), `AU` / `UA` (added by one
side), `DU` / `UD` (deleted by one side) or `DD` (both deleted).

### The swap

| Operation | Ours — stage 2, the `<<<<<<<` side | Theirs — stage 3, the `>>>>>>>` side |
| --- | --- | --- |
| `rebase`, `rebase --onto` | the branch being rebased onto, with the commits replayed so far (`<<<<<<< HEAD`) | the user's commit being replayed (`>>>>>>> <sha> (<subject>)`) |
| `cherry-pick` | the branch receiving the commit | the picked commit |
| an autostash applied after a rebase | the rebased branch (`<<<<<<< Updated upstream`) | the carried work (`>>>>>>> Stashed changes`) |

`man git-checkout` states the rebase reversal: `--ours` gives the branch the changes are
rebased onto, `--theirs` the branch holding the work being rebased. The same reversal
applies to `-X ours` and `-X theirs` in `man git-rebase`.

### zdiff3

`-c merge.conflictStyle=zdiff3` on the operation adds the base between the sides, from
`|||||||` to `=======`, and moves lines both sides share out of the region. It sets nothing
in the repository's config, and it lasts for that one command: a `--continue` without it
replays the next commit with the configured style, so its stop can lack the base region.
Observed: the first stop of a two-stop rebase carried the base and the second did not,
until `--continue` repeated the `-c`. It exists from git 2.35 (git-scm.com's docs for
`git-merge` 2.34.0 lack it, 2.35.0's list it); on an older git, use `diff3`.

### Moving only the named branch

`--no-update-refs` keeps a rebase from moving any other branch that points into the
rebased range, even where `rebase.updateRefs` is configured. `--update-refs` and
`rebase.updateRefs` both arrived in git 2.38.0: its release notes add the option, and
git-scm.com's docs for `git-rebase` and `git-config` 2.37.0 lack both while 2.38.0's list
them. On an older git, leave the flag out: nothing there moves another branch.
`git --version` tells which, behind the permission prompt.

### Writing the working tree, not the index

`git checkout --ours <path>` and `--theirs` with no tree-ish rewrite only the working-tree
file; the path stays unmerged. `git add` and `git rm` write the index, and they are what
marks a path resolved, so they wait for the log form. `git diff --check` reports each
leftover conflict marker as `<path>:<line>: leftover conflict marker` and exits 2, on an
unmerged path too.

### Continuing

`git -c merge.conflictStyle=zdiff3 -c core.editor=true rebase --continue` replays the
commit with its own message and opens no editor, and the next stop still shows the base.
`cherry-pick --continue` takes the same two `-c`. A replayed commit whose resolution leaves
no change is dropped by `--continue` without a stop or a prompt: the branch ends one commit
shorter. `--skip` drops
the current commit outright. Either loses the commit's change unless main already holds it,
so its log entry names the commit and shows main holding its change.

### An operation in progress

- `git rev-parse --verify -q REBASE_HEAD`, `CHERRY_PICK_HEAD` or `MERGE_HEAD` succeeds while
  that operation is under way.
- In a rebase, the branch's ref still points at its original tip until the rebase ends, and
  the file at `git rev-parse --git-path rebase-merge/orig-head` holds that tip;
  `rebase-merge/head-name` holds the branch. That tip is the backup ref's commit.
- An operation the user started keeps its own options; the plan adds only the backup ref
  and the commands that continue it.
- The files the user already resolved by hand live only in the working tree, and an abort
  discards them. `snapshot.mjs take` works with the index still unmerged and records them,
  leaving the index as it was: observed, a file resolved mid-rebase read back with
  `git show <tree>:<path>` after `git rebase --abort`, with nothing staged.

### The autostash

`--autostash` stashes the uncommitted changes to tracked files before the rebase and applies
them after it. Untracked files stay in place throughout. When the apply conflicts, git
prints "Applying autostash resulted in conflicts. Your changes are safe in the stash.",
leaves the path `UU` and keeps `stash@{0}: autostash`. `git reset -q -- <path>` then clears
the conflict and leaves the resolved work unstaged. `git rebase --abort` reapplies the
autostash ("Applied autostash.").

### Restoring the backup

After the confirmation form, for each branch the sync rewrote:

1. **A backup ref at the synced tip**, `git branch backup/<branch>/<YYYYMMDD-HHMM> HEAD`,
   so the rebased commits, their ids and messages stay reachable by name after the reset.
   Git refuses a name already taken, so an earlier backup is never overwritten; take the
   next minute's name. Record it in LOG.md beside the one it restores.
2. `snapshot.mjs take`, recorded in LOG.md as the post-sync recovery tree: the uncommitted
   state the reset discards — consolidations, an applied autostash — which no commit holds.
3. `git reset --hard <backup ref>` on that branch.
4. When the pre-sync tree held uncommitted work, put it back:
   `git diff --name-only <backup ref> <pre-sync tree>` lists its paths, and
   `git restore --source=<pre-sync tree> --worktree -- <those paths>` rewrites them — a path
   the tree lacks is removed, since no-overlay is the default — without touching the index.
   A sync that began as an operation already in progress has an in-progress tree instead,
   which holds conflict markers, so this step does not apply.

The pre-sync tree leaves out credential paths and `temp/`. `temp/` is untracked, so the
reset leaves it alone; an uncommitted change to a tracked credential path is not in the
tree, and the reset discards it. The confirmation form names every path `git status` listed
before the sync that step 4's list lacks, so the user copies them first.
