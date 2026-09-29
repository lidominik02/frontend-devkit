# The finishing menu

One recipe per menu item: what it calls or runs, what it shows, and what it asks. Every
item confirms its result before anything is written, committed or moved, and every form
puts the recommended option first. A mutating command runs behind the normal permission
prompt. The fast gates are the ones the completeness check ran; no item runs them again
but the project-docs update, once it applies an edit.

The feature's diff base is the final review's: "The final review's base" in
`../../planning-features/references/artifacts.md`. Without a feature it is the merge-base
with `origin/<base>`, or with the local base branch when there is no remote one.

**Every call into `core:describing-changes`** — the Commit and MR description items —
says, in these words: "Text only. Use these gate results and run no gate: <each gate with
its status>. Do not offer or run any command that commits or creates the merge request."
The results are the latest fast-gate run — the project-docs update's when it ran them,
else the completeness check's — and whatever full verification ran; `test` and `build`
are listed as NOT RUN (held) unless the user picked them there.

## Full verification

Runs only when picked, and the pick releases what the user picks inside it. One form, one
multi-select question:

- **Whole-branch review.** Call the Skill tool with "core:reviewing-changes", naming the
  feature and the diff base.
- **Test suite.** `node "${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.mjs" --gate test --json`,
  each status as given.
- **QA run — browser, design comparison, Storybook.** Call the Skill tool with
  "core:testing-changes", naming the feature: `run` when an approved list is current, the
  call saying the user released the run; otherwise `plan`, whose list the user approves on
  testing-changes' own path.

The test suite runs first. Shows: its status; a failure goes back to the "Are we done?"
form in section 3 of `../SKILL.md`, named as what was found. With none, the menu continues.

Then the review — or the QA run, when the review is not picked — ends this finishing run:
it writes its report and ends by its own rule, and a report that leaves nothing open calls
this skill again; without a feature, the user does. The picks not yet run are not kept; the
user picks them again.

## Project-docs update

Reads the repository's own docs, never a doc it does not have: the READMEs, `CLAUDE.md`,
`docs/`, a changelog, ADRs — whichever exist. From the feature's diff, take what a reader
of those docs would notice: a new or renamed export, route, command, script, environment
variable or configuration key, and a changed behaviour a doc describes. Grep the docs for
each.

Shows: one entry per proposed edit — the doc and its section, the text now, the text
proposed, and the change in the diff that makes it stale. With none, it says what it
searched and moves on.

Asks: batched forms of up to four questions, one per edit: "Apply (recommended)", "Skip",
or a free-text change. Applies each accepted edit with Edit. It creates no new doc file and
never edits under `temp/`. Once an edit is applied, it runs
`node "${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.mjs" --stage fast --json` once more, and the
Commit and MR description items take that result.

## Commit

With `git status --porcelain` empty there is nothing to commit: say so, and that the
branch's commits stand as they are. Nothing already committed is rewritten.

Otherwise call the Skill tool with "core:describing-changes" for the uncommitted work,
with the words above, saying that the shape comes first — one commit or several, by
`../../describing-changes/references/shaping-commits.md` — and that each commit takes
whole files, since this skill commits by path: a split inside one file is offered as whole
files, and the form says so. It returns each commit's files and message.

Shows: per commit, its files as `git status --porcelain` lists them, then its message in
full. `temp/` and credential paths are in none. Files already staged
(`git diff --cached --name-only`) that no commit names are listed apart: they stay staged
and go into no commit.

Asks: one form per commit, in order: "Commit with this message (recommended)", "Change it"
— the free-text answer says how; the message is redrafted and shown again — or "Skip this
commit". On the accepted message only:

```
git add -- <each file of that commit>
git commit -m "<subject>" -m "<body>" -- <each file of that commit>
```

with the accepted text exactly. The paths after `--` limit the commit to that commit's
files, whatever else is staged (git 2.43.0). Never `git add -A`, `git add .`,
`--no-verify` or `--amend`. A hook that rejects the commit — a convention check, a pre-commit gate — is
shown with its output and the form asks again; it is never bypassed. Record each commit as
`git log -1 --format='%h %s'` prints it.

## MR description

1. **Behind the base.** On the base branch itself there is no merge request: say so and
   skip the item. Otherwise, when `refs/remotes/origin/<base>` exists, update it with
   `git fetch origin <base>`, which moves only the remote-tracking ref, and count
   `git rev-list --count HEAD..origin/<base>`. When the fetch does not run, count against
   the ref as last fetched and say so. With no remote base the check is NOT RUN (no
   `origin/<base>`).
2. **When behind**, warn before any text: "The branch is <n> commits behind
   origin/<base>." One form: "Bring the branch up to date first (recommended)" or "Write
   the MR text anyway". The first calls the Skill tool with "core:syncing-branches",
   naming the feature. The sync ends by its own rule, so this run ends with it; a re-review
   that leaves nothing open calls this skill again, otherwise the user does once the review
   is read.
3. **The text.** Call the Skill tool with "core:describing-changes" for the merge request
   description of the branch against `origin/<base>`, in the repository's template when it
   has one, with the words above.

Shows: the text, whole. Asks: "Use this text (recommended)", "Change it" — redrafted and
shown again — or "Skip". The accepted text goes into the chat brief in a copyable block.
The user opens the merge request.

## Team summary

Written here, for a colleague who has only the repository and the merge request: what the
feature lets a user do, from SPEC.md's Outcome; how to try it; each commit; the gates as
run, an unrun one as NOT RUN; and what is left, with its owner. It names nothing that
exists only between the user and this session — no `temp/` path, no decision or question
id, no session, handoff or plan — and states a reason in its own words.

Shows: the summary. Asks: "Use it (recommended)", "Change it" or "Skip". It is printed
only; nothing sends it.

## Open-items reminder

Lists, each with the file or command it comes from:

- **Open questions**: the open entries of OPEN-QUESTIONS.md, each with its owner.
- **Contract gaps**: every CONTRACT-GAPS.md entry, with its status.
- **Findings left open**: each finding the feature chain leaves open, by "An open finding"
  in `../../planning-features/references/artifacts.md`; every `deferred` ledger entry that
  names a report from the chain's latest review on, from the ledger and
  planning/archive/PROGRESS.md, with its report; and
  whatever else the completeness check left open when the user answered "Done".
- **NOT RUN checks**: each gate the completeness check reported NOT RUN, the latest review
  report's NOT RUN items, the QA report's Skipped and Not observed, or the user's QA skip.
- **Backup refs**: `git branch --list 'backup/*'`, each with its commit. Mark the ones the
  feature's `backup ref` and `sync` ledger entries name, in the ledger and in
  planning/archive/PROGRESS.md, with the entry's task or sync. The user deletes one with
  `git branch -D <ref>` once it is no longer needed; this skill does not.

Shows the list and asks nothing: picking the item was the confirmation. It says the
artifacts it cites move with the folder to the archive target section 5 step 2 of
`../SKILL.md` works out. Nothing is sent.

## Tidy temp/

Lists what else under `<top>/temp/` belongs to this work and sits outside the feature
folder: a `temp/bugs/<slug>/` whose FIX.md or a `temp/syncs/<slug>/` whose LOG.md names
this branch or the feature, a review under `temp/reviews/` of this branch, and a checkpoint
under `temp/handoffs/` for it — each with the line that ties it to this work. Other work's
files are not listed.

Asks: one multi-select form of the listed paths, four to a question. Each picked path moves
under `<top>/temp/archive/`, keeping its path below `temp/` (`temp/bugs/<slug>/` becomes
`temp/archive/bugs/<slug>/`), with `mkdir -p` and `mv`. Nothing is deleted, and nothing
outside `temp/` moves.
