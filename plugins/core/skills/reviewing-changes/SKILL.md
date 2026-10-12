---
name: reviewing-changes
description: >-
  Reviews the current changes — committed on the branch, uncommitted and untracked —
  against the spec and the repository's own rules, with an independent reviewer and a
  verification pass. Use when the user says "review this", "code review", "review my
  changes" or "is this safe to merge". For how it looks in a browser, use verifying-ui;
  for a QA list, testing-changes; for a commit message, describing-changes; for a root
  cause, investigating-bugs.
argument-hint: "[review|re-review] [feature] [base]"
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs *) Bash(git rev-parse *) Bash(git merge-base *) Bash(git symbolic-ref *) Bash(git check-ignore *) Bash(npm run *) Bash(pnpm run *) Bash(yarn run *) Bash(bun run *) Read Grep Glob Agent Skill AskUserQuestion
---

You review the current changes from the main thread. `core:reviewer` workers do the reading;
you set the scope, dispatch them, and write the report. You add no finding of your own: you
wrote this code or watched it being written.

In the feature lifecycle this runs after implementation — `executing-plans` calls it once the
work is built, `clarifying-features` once a bounded change is done — and the user can invoke
it directly. Fixing is not its job: the user reads the code and the report together, and
`executing-plans` fixes, then calls this skill again in `re-review` mode. Read
`../planning-features/references/project.md` first: the package manager, the framework
packs, the gates and the base branch come from there.

## 1. Scope

1. **Feature.** The caller or the user names it. When neither does and `temp/` holds feature
   folders, ask with one form which one applies, "none" included.
2. **Base.** A base the caller or the user names — a commit, a tag or a tree id; "the last
   commit" is `HEAD~1`. Otherwise the base branch rule in `project.md`. Otherwise ask. On
   the base branch itself the scope is the commits not yet pushed plus the uncommitted work.
3. **Review folder.** `temp/<feature>/review/` with a feature, else `temp/reviews/`, at the
   repository's top level (`git rev-parse --show-toplevel`). `<NN>` is one more than the
   highest number already in the folder; a review's diff and report share it
   (`03-review.diff`, `03-review.md`).
4. **Diff.**

   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs" diff <base> --out <review folder>/<NN>-review.diff
   ```

   It covers committed, uncommitted and untracked work, and leaves out `temp/` and
   credential paths. It prints the diff file's absolute path, the one every dispatch
   carries. The file's first line ends in `snapshot tree <id>`: record that tree in the
   report, because `re-review` diffs from it. The reviewers read the diff; this thread takes
   only its header and stat lines, by grep.
5. **Empty diff** — the header line and no stat: say there is nothing to review and stop.
6. **Untracked `temp/`.** When `git check-ignore -q <top>/temp/` exits 1, say once that the
   diff and the report land in an untracked `temp/`.

## 2. Intent sources

Pass each that exists as a path, never a paraphrase: `temp/<feature>/PLAN.md`, naming the
task or tasks the scope covers; `temp/<feature>/DECISIONS.md`; `requirements/` when there is
one; the approved in-chat design the caller passes, verbatim. With none of them, the spec
axis is NOT RUN, and the report and the chat brief say so. Never infer intent from commit
messages or the branch name.

## 3. Gates, once

Run the fast gates once, here, as `project.md` describes, and put the block into every
dispatch as already run: a reviewer never runs them. `test` and `build` stay NOT RUN (held)
unless the user released them; a released one runs once here too.

## 4. Dispatch

One `core:reviewer` with `Role: two-axis`, then one with `Role: verify` over its candidates
— by that fully-qualified name, in the foreground, with no model named. Each carries the
dispatch shape in `references/formats.md`: the role, the absolute diff path, the intent
sources, the `Packs:` line `project.md` gives, the gate block, what is released, and the
role material. `verify` gets each candidate's id, location, category, severity, summary and
failure scenario — never the finder's reasoning, fix suggestion or confidence. No
candidates: skip `verify`.

## 5. The report

Write `<review folder>/<NN>-review.md` in the shape `references/formats.md` gives: the
header (the scope, the base, the snapshot tree, the gates, the packs, each NOT RUN item);
the overall line of counts — never a verdict, neither the reviewers nor the report approve
or reject; the findings by axis, CONFIRMED before PLAUSIBLE, each the verifier's block with
the finder's fix. A finding the finder marked `conflicts with D<n>` keeps that mark beside
its verdict, and the user decides it. Then PREDATES_CHANGE, Refuted, Declined to judge,
Runtime-only (it seeds the QA list), Clean and Inconclusive.

Then give the chat brief from the same reference: the overall line, each critical and
important finding on one line, the NOT RUN items and the report path.

## 6. STATUS.md

With a feature, once the diff is non-empty, the Stage `review — owner: reviewing-changes`.
When the report is written: the gate block into `Verified` as `latest:`, the Stage
`user reads code + findings — owner: the user`, the Next action "the user reads the code and
the review report" with its path, a Log line `<date> · review · <overall line>`, and the
kickoff prompt rewritten to match.

When the report leaves no finding open and every task in the Tasks table is done or
blocked, call the Skill tool with "core:finishing-features", naming the feature. Otherwise
stop: no fixing, no form, no next skill. Without a feature, nothing is written beyond the
diff and the report.

## 7. Mode: `re-review`

After fixes:

1. Read the latest report in the review folder — the highest number — and take the snapshot
   tree from its header.
2. Write the fix diff. An empty one means nothing changed since that report: say so and stop.

   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs" diff <that tree> --out <review folder>/<NN>-re-review.diff
   ```

3. Run the gates once, as section 3 describes.
4. Take the open findings: the CONFIRMED and PLAUSIBLE findings of that report — from a
   re-review report, its NOT ADDRESSED and new findings — without those STATUS.md's
   `Closed findings` lines close for that report. Without a feature nothing is closed.
5. Dispatch one `core:reviewer`, `Role: re-review`, with those findings as `Prior findings:`.
6. Write `<NN>-re-review.md` naming the report it re-reviews, with each closed finding and
   its `Closed findings` line in their own section. The chat brief lists the NOT ADDRESSED
   and the new findings. Section 6's writes and its call follow.

## What this must NOT do

- Change code, stage, commit, or touch the index. The diff, the report and STATUS.md are all
  it writes.
- Add a finding of its own, drop a verified finding, or move a severity.
- Show the verifier the finder's reasoning.
- Run `test`, `build`, a browser, the design tool or Storybook unless the user released it.
- Imply a gate passed or the spec axis ran when it did not.
- Carry a fact about an individual repository. A repo's conventions live in its own files,
  read at the moment of use.
