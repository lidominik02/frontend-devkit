---
name: reviewing-changes
description: >-
  Reviews the current changes — committed on the branch, uncommitted and untracked —
  against the spec and the repository's own rules, with independent reviewers and a
  verification pass. Use when the user says "review this", "code review", "review my
  changes" or "is this safe to merge". For how it looks in a browser, use verifying-ui;
  for a QA list, testing-changes; for a commit message, describing-changes; for a root
  cause, investigating-bugs.
argument-hint: "[review|re-review] [feature] [base]"
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/project-facts.mjs) Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs *) Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.mjs *) Bash(git rev-parse *) Bash(git merge-base *) Bash(git check-ignore *) Read Grep Glob Agent AskUserQuestion
---

You review the current changes from the main thread. `core:reviewer` workers do the reading;
you set the scope, dispatch them, merge what they return and write the report. You add no
finding of your own: you wrote this code or watched it being written.

In the feature lifecycle this runs after implementation — `executing-plans` calls it once the
work is built, `clarifying-features` once a change built from an approved in-chat design is
done — and the user can invoke it directly. Fixing is not its job: after the review the user
reads the code and the report together, and `executing-plans` fixes, then calls this skill
again in `re-review` mode.

## 1. Scope

1. **Feature.** The caller or the user names it. When neither does and `temp/` holds feature
   folders, ask with one AskUserQuestion form which one applies, "none" included.
2. **Base.** The first of these that gives one:
   1. A base the caller or the user names — a commit, a tag or a tree id; "the last commit"
      is `HEAD~1`.
   2. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/project-facts.mjs"` and take
      `baseBranch.name`. When `git rev-parse --verify --quiet refs/remotes/origin/<base branch>`
      exits 0, the base is `git merge-base HEAD origin/<base branch>`, since a merge request
      merges into the remote branch.
   3. Otherwise `git merge-base HEAD <base branch>`, against the local branch.
   4. Ask.

   A `baseBranch.source` of `not detected` or `current branch (no remote HEAD)` means no base
   branch was detected, so 2 and 3 do not apply. On the base branch itself the scope is the
   commits not yet pushed plus the uncommitted work — only the uncommitted work when there is
   no `origin/<base branch>`.
3. **Review folder.** `temp/<feature>/review/` with a feature, else `temp/reviews/`, at the
   repository's top level (`git rev-parse --show-toplevel`), where `snapshot.mjs` resolves a
   relative `--out` too. Number the files: `<NN>` is one more than the highest number
   already in the folder, and a review's diff and report share it (`03-review.diff`,
   `03-review.md`), so a later review never overwrites an earlier one.
4. **Diff.**

   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs" diff <base> --out <review folder>/<NN>-review.diff
   ```

   It covers committed, uncommitted and untracked work, and leaves out `temp/` and
   credential paths. It prints the diff file's absolute path: that path is the one every
   dispatch carries, so no reader depends on a working directory. The file's first line
   ends in `snapshot tree <id>`: record that tree in the report, because `re-review` diffs
   from it.
5. **Empty diff** — the header line and no stat: say there is nothing to review and stop.
6. **Untracked `temp/`.** When `git check-ignore -q <top>/temp/` exits 1, with `<top>` the
   top level from step 3, the top-level `temp/` is not gitignored: say once that the diff
   and the report land in an untracked `temp/`.

## 2. Intent sources

Gather each that exists and pass its path, never a paraphrase:

- From `temp/<feature>/planning/`: `SPEC.md`, whole — Sources, Success criteria with their
  SAID / ASSUMED / EXTRA tags, States, Design, Review Focus, Architecture fit; `PLAN.md`,
  naming the task or tasks the scope covers; `DECISIONS.md`.
- The requirement material under `temp/<feature>/requirements/`.
- The approved in-chat design the caller passes, pasted verbatim, since it has no path.

With none of them, the spec axis is NOT RUN, and the report header and the chat brief say
so. Never infer intent from commit messages or the branch name.

## 3. Gates, once

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.mjs" --stage fast --json` once, here,
and paste its output into every dispatch as already run: parallel reviewers each running the
type-checker would pay for it once per reviewer and can collide. `test` and `build` stay NOT
RUN (held) unless the user released them. A released one runs once here too
(`--gate test --json`, `--gate build --json`), and every dispatch says which are released.

## 4. Tier

Read the diff's stat summary line. The review is **large** when more than 400 lines changed
(insertions plus deletions) or more than 15 files did, or when the user asks for a thorough
or deep review; otherwise **small**. The two thresholds are a starting value, not a
measured boundary.

- **small** — one reviewer with role `two-axis`, then one with role `verify` over its
  candidates.
- **large**:
  1. One reviewer per section of `references/lenses.md`, role `lens <section heading>`,
     all in one message so they run in parallel. Paste each its section verbatim: agents
     cite no reference file, so every text an agent needs arrives in its dispatch. Leave out
     the `spec` lens when there is no intent source.
  2. Gap sweep, optional: a changed file that no lens accounted for — neither a finding nor
     Clean — gets one `two-axis` reviewer restricted to those files.
  3. Dedupe here. Qualify each id with its lens (`correctness/Q2`) so no two lenses share
     one. Candidates in the same file, with the same verbatim snippet, in the same enclosing
     function become one candidate that lists every id it absorbs and keeps the highest
     severity among them; the verifier can still lower it.
  4. `verify`. With more than about 15 candidates, split them by file across several
     `verify` dispatches in one message.
- No candidates: skip `verify`.

## 5. Dispatch

Dispatch `core:reviewer` by that fully-qualified name, in the foreground
(`run_in_background: false`) because every next step needs the result, and with
`model: opus` named on every dispatch — finders, verifiers and re-review alike.

Each dispatch carries the role, the absolute diff path `snapshot.mjs` printed (the fix
diff's for `re-review`), the intent source paths, the gate result marked as already run,
which of `test` and `build` are released, and the role material.
`verify` gets each candidate's id, location, category, severity, summary and failure
scenario — never the finder's reasoning, fix suggestion or confidence. The prompt shapes are
in `references/formats.md`.

## 6. Merge and write the report

Write `<review folder>/<NN>-review.md` in the shape `references/formats.md` gives:

1. **Header** — the scope (the stat summary line, the base, the snapshot tree), the tier,
   the gates, the framework packs the reviewers applied, the lenses run and any reviewer
   that did not return, and each NOT RUN item — the spec axis when there was no intent
   source.
2. **Overall line** — counts: CONFIRMED by severity, PLAUSIBLE, conflicts with a decision,
   PREDATES_CHANGE, REFUTED. It is counts, not a verdict: neither the reviewers nor the
   report approve or reject.
3. **Findings by axis**, spec then quality, CONFIRMED before PLAUSIBLE, each in the
   reviewer's finding block: the verifier's block for it, with the finder's fix.
4. **Conflicts with a decision.** Check every surviving finding against `DECISIONS.md` and
   the SPEC. One that contradicts a recorded decision or an EXTRA-tagged criterion moves to
   its own section as "conflicts with D<n> — the user decides", its verdict and severity
   unchanged.
5. **PREDATES_CHANGE**, in its own section: real, not introduced by this change, not
   blocking. Only the verifier sets it; a finder can only say so in the summary.
6. **Refuted**, each with the guard the verifier quoted.
7. **Declined to judge**, **Runtime-only** (what only a running page shows; it seeds the QA
   list), **Clean** (each changed file no CONFIRMED or PLAUSIBLE finding touches) and
   **Inconclusive**, merged from every reviewer.

Then give the chat brief from the same reference: the overall line, each critical and
important finding on one line, the NOT RUN items and the report path. Everything else stays
in the file.

## 7. Lifecycle

With a feature, once the diff is non-empty, `temp/<feature>/planning/HANDOFF.md` gets the
stage `review (automatic) — owner: reviewing-changes`. When the report is written:

- `HANDOFF.md`: the stage `user reads code + findings — owner: the user`, the next action
  "the user reads the code and the review report" with the report's path, and the kickoff
  prompt rewritten to match.
- `PROGRESS.md`: one ledger line, `- <date> — review — <overall line> — <report path>`.

Then stop: no fixing, no form, no next skill. Without a feature, nothing is written beyond
the diff and the report. Both modes end this way.

## 8. Mode: `re-review`

After fixes:

1. Read the latest report in the review folder — the highest number — and take the snapshot
   tree from its header.
2. Write the fix diff. An empty one means nothing changed since that report: say so and
   stop.

   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs" diff <that tree> --out <review folder>/<NN>-re-review.diff
   ```

3. Run the gates once, as **Gates, once** describes.
4. Take the prior CONFIRMED and PLAUSIBLE findings — from a re-review report, its NOT
   ADDRESSED and new findings — and set aside each one the user closed: one that a
   `PROGRESS.md` ledger line names by id and by a report that lists it under that id, as a
   `deferred` or as a `ruling` that leaves the code as it is — a "conflicts with D<n>"
   finding the user decided that way included. That report is the one being re-reviewed or
   an earlier one its `Re-reviews:` lines lead back to. An id is unique only within one
   review, and task-review ids restart with every task, so a line that names no report — a
   task review's — never sets a finding aside. Without a feature there is no `PROGRESS.md`,
   and nothing is set aside.
5. Dispatch one `core:reviewer`, `model: opus`, role `re-review`, with the findings that
   remain.
6. Write `<NN>-re-review.md` naming the report it re-reviews, with each set-aside finding
   and its ledger line in their own section. The chat brief lists the NOT ADDRESSED and the
   new findings.

## What this must NOT do

- Change code, stage, commit, or touch the index. The diff, the report, `HANDOFF.md` and
  `PROGRESS.md` are all it writes.
- Add a finding of its own, drop a verified finding, or move a severity. The one exception
  is a finding a `PROGRESS.md` ledger line sets aside by its id and its report, per
  `re-review` step 4: it leaves the dispatch and stays in the report.
- Show the verifier the finder's reasoning.
- Run `test`, `build`, a browser, the design tool or Storybook unless the user released it.
- Imply a gate passed or the spec axis ran when it did not.
- Carry a fact about an individual repository. A repo's conventions live in its own files,
  read at the moment of use.
