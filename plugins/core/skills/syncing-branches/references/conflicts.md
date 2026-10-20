# Conflicts: lookup

## Contents
- The classes
- Git mechanics

Every git behaviour here was observed on git 2.43.0 or read in its man pages. Each
conflicted file gets one class, which decides its resolution and its log entry's evidence.

## The classes

### regenerate

A file derived from others: a lockfile, or a generated file. A lockfile is any file the
table below lists for the tool "The tool that runs a manifest" in
`../../planning-features/references/project.md` finds, in any workspace package, any other
file the table lists, and a file the table does not list that is a lockfile by its name or
its tool's role — `go.sum`, `Gemfile.lock`, `uv.lock`, `Pipfile.lock`,
`packages.lock.json`: a file a tool writes is never merged by hand. A generated file is one
whose header says it is generated or not to be edited, that `.gitattributes` marks
`linguist-generated`, or that a manifest's target writes (a script in `package.json`). Its
lines cross-reference each other, so a merge of its hunks is wrong even when it parses.

1. Resolve its sources first — `package.json`, a schema, source files — by their own class.
2. Take the side being built on whole: `git checkout --ours <path>` — in a rebase
   `<target>`'s side, main or the parent; in a cherry-pick the receiving branch's.
3. Regenerate: for a lockfile, the install on the table row that lists it — the manager
   that owns that file, whatever manager was found — run in the lockfile's own directory;
   for a lockfile the table does not list, nothing runs: the file keeps that side, and a
   question in the stop's batch asks which command regenerates it; for a generated file,
   its generator. A generator that runs only inside a held command —
   the build, the dev server — is not run: the file keeps that side, and a question in the
   stop's batch says which command regenerates it. A generator not found is a question too.
4. Evidence: that `git diff --check` finds no marker; where a command ran, the command,
   its directory and exit code, and for a lockfile, that it lists each dependency the
   branch added beside it; where nothing ran, the side the file kept, that it is not
   regenerated, and the question in the stop's batch.

| Package manager | Its lockfiles | Regenerates the lockfile | Source |
| --- | --- | --- | --- |
| npm | `package-lock.json`, `npm-shrinkwrap.json` | `npm install` | npm 5.7.0 release notes: `npm install` fixes a conflicted `package-lock.json`. npm's docs: with both files present, `npm-shrinkwrap.json` takes precedence |
| pnpm | `pnpm-lock.yaml` | `pnpm install` | pnpm.io/git: `pnpm install` resolves conflicts in `pnpm-lock.yaml` |
| yarn | `yarn.lock` | `yarn install` | yarnpkg/yarn#3544, Yarn Classic; Yarn Berry's behaviour is unverified |
| bun | `bun.lock`, `bun.lockb` | `bun install` | bun.sh docs: Bun v1.2 made the text `bun.lock` the default; `bun.lockb` is the older binary form. Conflict handling unverified |

Taking the side being built on first means the install starts from a lockfile with no
markers, which makes the command valid where the manager's own conflict handling is
unverified. The install runs behind the permission prompt, as the plan named it.

### trivial

The two sides do not disagree, which the file's three versions show:

- **identical**: `git diff :2:<path> :3:<path>` prints nothing;
- **whitespace only**: `git diff --ignore-all-space :2:<path> :3:<path>` prints nothing —
  take the side being built on; the formatter the skill's Resolve step runs decides;
- **one side a superset**: every change one side made to the base, in the zdiff3 region
  between `|||||||` and `=======`, the other side also made, and it removed nothing the
  other kept. Take the superset.
Evidence: the command that showed it, or the hunk compared against the base.

### semantic

Both sides changed the same lines for their own reasons. Recover each intent per hunk:

- **main's side**: `git log --format='%h %s%n%b' <old merge-base>..<target> -- <path>`, and
  `git log -L<start>,<end>:<path> <target>` for the hunk's own history;
- **the branch's side**: the commit being replayed, `git show REBASE_HEAD`
  (`CHERRY_PICK_HEAD` in a cherry-pick), and the branch's earlier commits on the path;
- any document a commit or the code cites — a decision record, a spec, a convention file.
  A side that departs from a written rule says so in its intent.

Both intents are kept wherever both can hold: combine the hunks so each still does what its
commit meant. They truly conflict only when both cannot hold — one value set two ways, one
side removing what the other extends, two behaviours for the same input. Only that becomes
a question, carrying both intents with their evidence, never one side's rationale alone.
Evidence: the commits each intent came from; for a combined hunk, what each side still does.

### rename

A conflict about where a file lives or whether it exists. Git names the kind in its
`CONFLICT (<kind>)` line: rename/rename, rename/delete, modify/delete, file location.
Observed on a rebase that replays a directory rename while main added a file inside the old
directory:

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
Evidence: the `CONFLICT` line, where the file ended, and the grep finding no old path.

## Git mechanics

### The swap

`git show :1:<path>` is the base, `:2:` ours, `:3:` theirs. `git status --porcelain` marks
an unmerged path `UU`, `AA`, `AU` / `UA`, `DU` / `UD` or `DD` (U unmerged, A added, D deleted).

| Operation | Ours — stage 2, the `<<<<<<<` side | Theirs — stage 3, the `>>>>>>>` side |
| --- | --- | --- |
| `rebase`, `rebase --onto` | the branch being rebased onto, with the commits replayed so far (`<<<<<<< HEAD`) | the user's commit being replayed (`>>>>>>> <sha> (<subject>)`) |
| `cherry-pick` | the branch receiving the commit | the picked commit |

`man git-checkout` states the rebase reversal (`--ours` the branch rebased onto, `--theirs`
the work being rebased); `man git-rebase` the same for `-X ours` and `-X theirs`.

### zdiff3

`-c merge.conflictStyle=zdiff3` adds the base between the sides, from `|||||||` to
`=======`, and moves lines both sides share out of the region. It sets nothing in the
repository's config and lasts for that one command: observed, the first stop of a two-stop
rebase carried the base and the second did not, until `--continue` repeated the `-c`. It
exists from git 2.35 (git-scm.com's `git-merge` docs: 2.34.0 lack it, 2.35.0 list it); on
an older git, use `diff3`.

### Moving only the named branch

`--no-update-refs` keeps a rebase from moving any other branch that points into the
rebased range, even where `rebase.updateRefs` is configured. Both arrived in git 2.38.0:
its release notes add the option, and git-scm.com's `git-rebase` and `git-config` docs
lack both at 2.37.0 and list them at 2.38.0. On an older git, leave the flag out: nothing
there moves another branch. `git --version` tells which, behind the permission prompt.

### Continuing

`git checkout --ours <path>` and `--theirs` with no tree-ish rewrite only the working-tree
file; the path stays unmerged. `git add` and `git rm` write the index and mark a path
resolved, so they wait for the log form. `git diff --check` reports each leftover marker as
`<path>:<line>: leftover conflict marker` and exits 2, on an unmerged path too.
`git -c merge.conflictStyle=zdiff3 -c core.editor=true rebase --continue` replays the
commit with its own message, opens no editor, and the next stop still shows the base;
`cherry-pick --continue` takes the same two `-c`. A replayed commit whose resolution leaves
no change is dropped by `--continue` without a stop or a prompt; `--skip` drops the current
commit outright. Either loses the commit's change unless main already holds it, so its log
entry names the commit and shows main holding its change.

### An operation in progress

- `git rev-parse --verify -q REBASE_HEAD`, `CHERRY_PICK_HEAD` or `MERGE_HEAD` succeeds while
  that operation is under way.
- In a rebase, the branch's ref points at its original tip until the rebase ends;
  `git rev-parse --git-path rebase-merge/orig-head` names the file holding that tip, and
  `rebase-merge/head-name` the branch. That tip is the backup ref's commit.
- An operation the user started keeps its own options; the plan adds only the backup ref
  and the continue commands.
- The files the user already resolved by hand live only in the working tree, and an abort
  discards them. `snapshot.mjs take` works with the index still unmerged and records them,
  leaving the index as it was: observed, a file resolved mid-rebase read back with
  `git show <tree>:<path>` after `git rebase --abort`, with nothing staged. A credential path
  or a file under `temp/` is not in that tree: a resolution there survives an abort only
  when the user copies it first.

### Restoring the backup

After the confirmation form, for each branch the sync rewrote:

1. **A backup ref at the synced tip**, `git branch backup/<branch>/<YYYYMMDD-HHMM> HEAD`,
   so the rebased commits stay reachable by name after the reset. Git refuses a name
   already taken, so an earlier backup is never overwritten; take the next minute's name.
   Record it in LOG.md beside the one it restores.
2. `git reset --hard <backup ref>` on that branch.
The reset discards every uncommitted change to a tracked file (`temp/`, untracked, stays):
the confirmation form names each path `git status --porcelain` lists, to commit or copy.
