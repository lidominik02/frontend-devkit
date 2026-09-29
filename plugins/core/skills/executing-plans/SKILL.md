---
name: executing-plans
description: >-
  Implements an approved PLAN.md task by task, in subagent-per-task or inline mode, and
  fixes the findings of its review. Use when the user says "implement the plan", "execute
  task X", "start implementing" or "fix the findings". For "write the plan", "break it
  into tasks" or "resume", use planning-features; for "review this", reviewing-changes.
argument-hint: "[subagent|inline|fix-findings] [feature] [task]"
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/project-facts.mjs) Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs *) Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.mjs *) Bash(git check-ignore *) Bash(git cat-file -e *) Bash(git rev-parse *) Read Grep Glob Agent Skill AskUserQuestion SendMessage
---

You carry out an approved plan, one task at a time. In subagent mode `core:implementer`
workers write the code and a `core:reviewer` reviews each task; in inline mode this session
writes it. In both, the plan, the gates and the artifacts decide when a task is done. Every
ledger, decision and question entry follows `../planning-features/references/artifacts.md`,
and each write makes the move its "The archive" section requires — a ledger entry that takes
the ledger past 60 entries, a decision that supersedes another. What this skill reads of each
artifact follows that file's read rule, "Reading the artifacts".

In the feature lifecycle this runs after `planning-features`, which writes PLAN.md, takes the
user's approval and the execution mode, and calls this skill or leaves a kickoff prompt for a
new session. When every task is done this skill calls `reviewing-changes` for the whole
feature, unless its rules hold the review, and stops. Once the user has read the code and
the report, `fix-findings` fixes what the user wants fixed.

## 1. Pre-flight

Once per run, in both execution modes. `fix-findings` needs only the feature, the recorded
mode and, inline, the framework rules: steps 1, 3 and 7.

1. **Feature.** The caller or the user names it. When neither does and `temp/` holds several
   feature folders, ask with one AskUserQuestion form which one. The planning files are in
   `temp/<feature>/planning/`. Every `temp/` path in this skill and its reference is under
   the repository root that `git rev-parse --show-toplevel` prints, whatever the current
   directory: write each file there, and hand each path on as an absolute one.
2. **Read the state.** `HANDOFF.md`: the execution mode, the rules, the stage. `PLAN.md`,
   once: the header's Global Constraints and Review Focus, and every task. `PROGRESS.md`'s
   task table and latest ledger entries: what is already Done — a restarted run continues at
   the first task not Done. A task the user names is where the run starts, once every task in
   its Blocked by is Done and it is not blocked; otherwise name what blocks it and ask. A
   task whose Blocked by names an open question — by `OQ<n>` or, in an older feature, by its
   quoted wording, with no `Answered:` sub-item or older free-text answer mark in
   `OPEN-QUESTIONS.md`, and no answered entry under that id in
   planning/archive/OPEN-QUESTIONS.md — is blocked this run, and so is every task whose
   Blocked by names a blocked task: each gets its `PROGRESS.md` row Blocked and a `blocked`
   ledger entry, and the run continues with the rest. A task not Done whose Blocked by names
   a question now answered was planned before the answer: read its Steps, Acceptance
   criteria and Interfaces against the `DECISIONS.md` entry that answered it, and when they
   contradict that entry, stop before any task runs, name the task, the entry and what
   contradicts it, and offer planning-features `plan` to revise it.
3. **Mode.** A mode named in the arguments is the user's choice. With none there and none
   recorded, ask with the mode form in the Forms section of `references/dispatch.md`.
   Record the mode in `HANDOFF.md` (`Execution mode:`).
4. **Conflict table.** A `## Conflicts` section in `PROGRESS.md`, above the ledger: each file
   more than one task modifies, with those tasks; each interface a task consumes, with the
   task that produces it. Tasks run strictly one at a time in one working tree; the table is
   what each task's diff is checked against.
5. **Baseline.** Run the fast gates once, so a failure that predates the run is never blamed
   on a task, and take the pre-execution tree — the base the final review diffs from. Record
   both in one ledger entry. A restarted run keeps the latest recorded tree. When "The final
   review's base" in `../planning-features/references/artifacts.md` takes the base from a
   `sync` entry, or from the merge-base of a `pruned` entry, that settles it for every later
   run; otherwise check the tree with `git cat-file -e <tree>^{tree}`. A failed check, and any
   gate run that reports a hung gate or a directory that is not a project root, go by the
   troubleshooting table in `references/dispatch.md`, never as a task failure.

   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.mjs" --stage fast --json
   node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs" take
   ```

6. **Untracked `temp/`.** When `git check-ignore -q temp/` exits 1, say once that the briefs,
   reports and diffs land in an untracked `temp/`.
7. **Inline only: framework rules.** Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/project-facts.mjs"`
   and, for each `stack.packs` entry in order, call the Skill tool with that pack's
   engineering skill. A later pack wins every conflict.

## 2. Subagent per task

For each task neither Done nor blocked, in plan order — a git history or index task runs by
section 4 in place of steps 2 to 7:

1. **Base.** `snapshot.mjs take` prints the task's base tree. `HANDOFF.md`: the stage
   `execute (task N/M, Subagent per task) — owner: executing-plans`, with Status and Next
   action naming the task; Status also names each stale `qa/` file, by the `qa/` section of
   `../planning-features/references/artifacts.md`. The task's `PROGRESS.md` row: In progress.
2. **Brief.** Write `temp/<feature>/tasks/<NN>-<task-slug>-brief.md`, `<NN>` being the task's
   position in the plan, from the template in `references/dispatch.md`, every field filled.
   Fill the row's Brief and Report columns.
3. **Dispatch** `core:implementer` by that fully-qualified name, in the foreground
   (`run_in_background: false`), with the prompt and the model `references/dispatch.md` gives.
4. **Status.** Act on the implementer's status by the table in `references/dispatch.md`. It
   stops for the user on a `BLOCKED`, on a concern that changes the scope or the product,
   and on a question `SPEC.md` and `DECISIONS.md` do not answer.
5. **Check the report against the code.**

   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs" diff <task base> --out temp/<feature>/tasks/<NN>-<task-slug>.diff
   ```

   Every changed file is in the brief's Files or named in the report with a reason. Take the
   files from the diff's stat lines and grep the report for each file outside the brief's
   Files: the read rule leaves diffs and worker reports to workers and grep. A file outside
   both, or one the conflict table gives to another task, is raised to the reviewer and to
   the user — never silently accepted.
6. **Task review.** Run the fast gates once, and each released gate once
   (`--gate test --json`, `--gate build --json`). Then dispatch `core:reviewer`, `sonnet`,
   foreground, with the task-review prompt of `references/dispatch.md`: role `two-axis`, the
   absolute diff path step 5 printed, its intent sources and one gate block per command run.
7. **Fix loop**, for critical and important findings only: at most three rounds, each run
   as the Fix rounds section of `references/dispatch.md` says, its decision check first.
   A critical or important finding still open after round 3 stops the run for the user,
   unless it is a reversible plan defect, ruled on as section 3's Deviations says. Each
   minor finding, from any round, gets a `deferred` ledger entry; the final review sees the
   code again.
8. **Close the task.** The row is Done only when every step ran and every gate in its Done
   when passed; otherwise it stays open and the ledger names what was skipped. One ledger
   entry: the task, the gates, the rounds, the review result.
9. **Pause** after every task, unless the user chose "Continue without pausing" earlier in
   this run, with the pause brief and form in the Forms section of `references/dispatch.md`.
   Without pausing, the run still stops and asks wherever a step above says to.

## 3. Inline

For each task neither Done nor blocked, in plan order — a git history or index task runs by
section 4 in place of steps 2 and 3:

1. **Open** the task by reading it in `PLAN.md`, not from memory of the plan, and quoting
   its `## Task:` heading as read. The run's first task also sets `HANDOFF.md`'s stage,
   `execute (task N/M, Inline) — owner: executing-plans`, and its Next action to itself.
2. **Implement** with Edit and Write, since the format-on-write hook runs after those tools
   and never after a Bash write. A scripted Bash edit is allowed only for conflict hunks and
   mechanical renames, and the format pass in `references/dispatch.md` follows it, over the
   files it touched and no others.
3. **Gates.** `node "${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.mjs" --stage fast --json`, its
   result read from its exit code and JSON, never through a pipe that drops the exit code.
4. **Close** in one combined write: the task's `PROGRESS.md` row, its ledger entry, and
   `HANDOFF.md`'s stage and Next action moved on to the next task. Continue with it without
   pausing.

**Deviations.** A change to what a plan step or a `DECISIONS.md` entry says, or to what an
option the user picked promised, is asked with the deviation form in the Forms section of
`references/dispatch.md`. Only a reversible plan defect — a wrong path, a mismatched
interface name, a task order that cannot work — is ruled on without a form, each with its
own `DECISIONS.md` entry and a `ruling · plan defect` ledger entry naming it.

Stop and ask on an ambiguity `SPEC.md` and `DECISIONS.md` do not answer, on a product
question, or on a gate failure the task caused and cannot fix — the baseline shows which
failures predate it.

## 4. A git history or index task

A plan task the user approved that names a git history or index operation verbatim — a
reset, a stash, a rebase, a fast-forward — is the only way this skill runs one. This
session runs it in either mode, and nothing beyond what the task names. A fast-forward
runs as `git rebase <target>`; a task that words it as a merge (`git merge --ff-only`, a
`git pull` without `--rebase`) is handed back to the user with the command, before step 1,
since the user merges:

1. Create a backup ref, a branch named `backup/<branch>/<YYYYMMDD-HHMM>` at
   `git rev-parse HEAD`, and name it in a `backup ref` ledger entry.
2. Run the operation as the task words it. The conflicted files it leaves are code, changed
   before step 3 under the mode's own rules — in subagent mode by an implementer through
   section 2 steps 2 to 7, with a conflicts brief naming them (`references/dispatch.md`).
3. Run the fast gates. When HEAD has moved, that run and a new pre-execution tree are the
   new baseline: one `baseline retaken` ledger entry naming the task and what the new base
   leaves out of the final review — every Done task before it, each file its conflicts changed.
4. Close the task by the mode's close step before any other work, so Next action never
   names an operation that already ran.

## 5. End of the run

The run's work stays uncommitted until the user commits it. However the run ends — here, or
at a Stop on the pause form — run `snapshot.mjs take` once more and record the tree id as a
recovery point: in a `recovery tree` ledger entry and in `HANDOFF.md` Status. That Status
also names each stale `qa/` file and, for a review from a pre-execution tree, what the
`baseline retaken` entries leave out of it.

When every task is Done, call the Skill tool with "core:reviewing-changes", naming the
feature and the base "The final review's base" in
`../planning-features/references/artifacts.md` gives, with what it leaves out named as
outside the review — or no base when that is the merge-base, so `reviewing-changes` takes
the merge-base itself.
It writes the report and sets the stage `user reads code + findings`. Then stop.

When the rules that govern the feature hold the review until the user asks for it, do not
call it: write a `review held by rule` ledger entry quoting the rule, set the stage
`user reads code + findings` with "no review ran" in Status, and name that base — the sync's
commit, the tree id or the merge-base — in Next action. Then stop.

When the only tasks not Done are blocked ones, do not call it: name each with the question
that blocks it and ask with the blocked-tasks form in the Forms section of
`references/dispatch.md`. Any other task still open stops the run before the review: name
it and what it lacks, and ask.

## 6. Mode: `fix-findings`

The user has read the code and the review report and says what to do with each finding.

1. Read the feature's review chain, `temp/<feature>/review/`, from its latest
   `<NN>-review.md` on, by "An open finding" in
   `../planning-features/references/artifacts.md`: the latest report — the highest number —
   and, for a finding it carries from an earlier report, that finding's block in the report
   its `Re-reviews:` lines lead back to. The findings it leaves open are this mode's. Ask
   about each one the user has not decided, in the fix-findings forms of the Forms section
   of `references/dispatch.md`.
2. Record each finding the user defers or keeps as designed in its `deferred` or `ruling`
   ledger entry, which names its id and the report so `re-review` sets it aside. A decision
   the user changes gets a new `DECISIONS.md` entry that supersedes the old one, and the same
   write moves the old one to planning/archive/DECISIONS.md.
3. Verify each finding before fixing it: open the cited `file:line` and confirm the failure
   scenario holds. One that does not is reported back with the evidence, not fixed; one the
   code cannot settle is reported as "cannot verify without X".
4. **Triage** each verified finding the user chose to fix whose failure scenario is a wrong
   outcome — a bug, not a cleanup's cost — by "The triage threshold" in
   `../fixing-bugs/references/loop.md`, the fix judged from the finding's `fix` line
   against the code at its location. It is a rule, not a question:
   - **Evident, one function: fixed at once**, in step 6. It gets a regression test at a
     correct seam ("A correct seam" in the same file), or none where no correct seam
     reaches it, and the fix brief says which. The test's one file runs red before the fix
     and green after, by "Running one test file" there; the suite stays held.
   - **Evident, wider: sent to `fixing-bugs`** in step 7.
   - **Unclear, or beyond the frontend: investigated** in step 5.

   Every other finding the user chose to fix — a cleanup — is fixed in step 6 as it stands.
5. When anything is left to investigate or fix, `HANDOFF.md`: the stage
   `fix findings — owner: executing-plans`. **Investigate the unclear ones**, when there
   are any, in this run: group them by area and dispatch the
   read-only agents of `investigating-bugs`' batch mode, by its steps 2 to 4, with the
   dispatch prompt in `../investigating-bugs/references/batch.md` — this skill dispatches
   them and never calls that skill. Then ask the remit ruling — whether each is the user's
   to fix — with the remit form in the Forms section of `references/dispatch.md`. A finding
   the user takes goes to `fixing-bugs` in step 7. One not taken gets its
   `ruling · <id> · not ours` ledger entry, in the shape
   `../planning-features/references/artifacts.md` gives, which closes it.
6. Fix in the recorded mode the findings fixed at once and the cleanups; with none, go to
   step 7. Subagent: one fresh `core:implementer`, foreground, session model, with the fix
   brief from `references/dispatch.md`, its status handled as in the per-task step 4.
   Inline: this session fixes.
7. **End the run.** With findings sent to `fixing-bugs`, say in the chat which go there and
   why, then call the Skill tool with "core:fixing-bugs" last, naming the feature, as one
   list. A finding sent from step 4 is handed on as its diagnosis: owning layer the
   frontend, root cause its cited `file:line` and failure scenario, confidence Confirmed by
   the step 3 check. An investigated one goes with its short report, and one whose Next step
   is "fix inline" enters `fixing-bugs` by its evident-cause entry. Its closing `re-review`
   judges every fix of this run. With none, when step 6 fixed something, call the Skill tool
   with "core:reviewing-changes" in `re-review` mode for the feature. Either call ends this
   run.

   When this run leaves nothing to fix, it runs no re-review. When the latest report, with
   the ledger's `deferred` and `ruling` entries, leaves no finding open and PROGRESS.md's
   task table shows every task Done or Blocked, call the Skill tool with
   "core:finishing-features", naming the feature. Otherwise say in the chat which findings
   stay open and why, and stop.

## What this must NOT do

- Commit or push. Stage or touch the index or refs — plumbing included: `git write-tree`,
  `git update-index`, `git read-tree`, `git commit-tree` — outside a section 4 task.
  `snapshot.mjs` builds its tree in a private temporary index and is the exception. The
  user stages and commits after reading the code.
- Edit code on the main thread in subagent mode.
- Run tests, a build, Storybook or a browser before the user releases them.
- Decide a product question, or rule on anything but a reversible plan defect.
- Mark a task Done with a step skipped or a gate unrun.
- Run two implementers at once.
- Carry a fact about an individual repository. A repo's conventions live in its own files,
  read at the moment of use.
