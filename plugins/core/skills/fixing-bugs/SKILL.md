---
name: fixing-bugs
description: >-
  Fixes a frontend bug and proves the fix with a regression test: red before, green
  after, red again with the fix reverted. Starts from an investigating-bugs diagnosis,
  or ranks hypotheses when the cause is unclear. Use when the user says "fix this bug",
  "make this failing case pass" or "fix it with a regression test". For "debug this",
  "diagnose this" or "find the root cause", use investigating-bugs; for "fix the
  findings", executing-plans.
argument-hint: "[feature] [diagnosis or bug report]"
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/project-facts.mjs) Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs *) Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.mjs *) Bash(git check-ignore *) Read Grep Glob Skill AskUserQuestion
---

You fix a bug in the frontend and prove the fix. A test that passes after a fix proves
nothing until it has also failed without it, so every fix here ends with that shown: red
before, green after, and — apart from an evident cause fixed at once — red again with the
fix taken out, green once it is back.

In the lifecycle this follows `investigating-bugs`: its report names the root cause and the
layer that owns it, the user rules that the bug is theirs to fix, and this skill starts
from that diagnosis. Without one it runs the loop in section 3. It edits frontend code
only, runs only the one test file it writes, and hands the result to `reviewing-changes`.

## 1. Set up

1. **Facts.** Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/project-facts.mjs"`. For each
   `stack.packs` entry, in order, call the Skill tool with that pack's engineering skill; a
   later pack wins every conflict. The test runner and its single-file command come from
   "Running one test file" in `references/loop.md`. With no runner, section 6 governs every
   step below.
2. **Work folder.** A short slug for the bug. Inside a feature — one the caller or the user
   names — the folder is `temp/<feature>/bugs/<slug>/`, otherwise `temp/bugs/<slug>/`,
   both under the top level `<top>` that `projectRoot.gitTopLevel` reports. It holds
   `FIX.md`, in the shape "FIX.md" in `references/loop.md` gives, written as each step ends
   rather than at the end. When `git check-ignore -q <top>/temp/` exits 1, say once that it
   lands in an untracked `temp/`. Never `git add` it. Inside a feature, what this skill
   reads of the feature's artifacts follows "Reading the artifacts" in
   `../planning-features/references/artifacts.md`.
3. **Report.** FIX.md's Report holds the bug as given, verbatim; non-English text is quoted,
   then translated. The expected behaviour is what the test will assert: when neither the
   report nor the diagnosis states it, ask before writing any test.
4. **Baseline.** Before the first edit, the repro test included, run the fast gates and
   take the tree, and record both in FIX.md. The review diffs from the tree; section 4
   step 5 compares against the gates, so a failure that predates the fix is never blamed
   on it. For a gate that fails here, run `run-gates.mjs --gate <name>` without `--json`,
   which echoes the gate's output, and record the errors it names.

   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.mjs" --stage fast --json
   node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs" take
   ```

5. **Entry.** A diagnosis is an `investigating-bugs` report, in the conversation or at a
   path the caller names, with an owning layer, a root cause at `path:line` and a
   confidence.
   - A diagnosis whose owning layer is not the frontend goes to section 5 at once, with no
     test written.
   - An evident frontend cause whose fix touches one function, by "The triage threshold"
     in `references/loop.md` — a bug the user reports inside a feature, or a diagnosis
     whose Next step is "fix inline" — goes to the evident-cause entry in section 2.
   - Any other frontend diagnosis that is Confirmed or Likely goes to section 2.
   - A bug report with no diagnosis, or an Inconclusive one, goes to section 3. What an
     Inconclusive diagnosis ruled out is evidence for the hypotheses.

**A list of findings.** `executing-plans`' `fix-findings` may hand on several findings in
one call. Each is one bug, with its own slug, work folder and FIX.md, and runs on its own
through steps 2 to 5 above and sections 2 to 7, then section 8's steps 1 and 2, one after
another. A form in one finding's run decides that finding, and the list goes on with the
next. Section 8's review runs once, after the last, whatever path each finding took: the
feature chain's `re-review`, which also judges the fixes `fix-findings` made before this
call.

## 2. From a diagnosis

1. Write the repro test at the seam the root cause sits behind ("A correct seam" in
   `references/loop.md`). It asserts the expected behaviour, so it fails while the
   diagnosed defect exists.
2. Run that file alone. Red on that assertion, for the diagnosed reason, proves the
   diagnosis: go to section 4.
3. A failure to import, compile or mock is the test's own defect: put it right and run
   again. When the test is green, or red for another reason, it contradicts the diagnosis.
   Record what it showed under Diagnosis and continue at section 3 step 3, the diagnosis
   ranked as one hypothesis among the others.

**The evident-cause entry** fixes at once, with no hypotheses and no revert proof. Write the
regression test as step 1 does, and run it as step 2 does: red for the cause. Fix it as
section 4 step 1 says, and run the file again: green. Both runs go under Regression proof,
and the gates and the close follow as section 4 steps 5 and 6. A test that is not red for
the cause, or a fix that leaves it red, shows the cause was not evident: undo any fix with
Edit, record what the runs showed under Diagnosis, and continue at section 3 step 3, the
cause ranked as one hypothesis. With no correct seam, section 6 governs.

## 3. From a report: the loop

1. **Repro.** A test file that goes red while the bug exists, built the way "Repro by kind
   of bug" in `references/loop.md` gives for this kind. It runs alone, by the single-file
   command, and never as part of the suite. It must be red for the reported symptom, not
   for a setup error.
2. **Minimise.** Remove one input, setup step or mock at a time and run again; keep a
   removal only while the test stays red. Stop when nothing more can go.
3. **Hypotheses.** Three to five, ranked most likely first. Each names the cause at
   `path:line`, the evidence for it, what the instrumentation will show if it is true, and
   the result that refutes it. A cause in the data, the contract or identity/auth is ranked
   on the same evidence as one in the frontend's code. Write them under Hypotheses.
4. **The stop.** One AskUserQuestion form with the ranking in its question: "Test them in
   this order (recommended)" and "Stop here, keep FIX.md". The user reorders or adds
   context through the form's free-text answer. Nothing but the repro test changes before
   the answer. This is the loop's only stop. On "Stop here", the repro test stays in the
   tree, skipped, commented and reported as section 5 step 6 says, the reason being that
   the cause is not yet found.
5. **Instrument, one hypothesis at a time**, in the agreed order: tagged lines only
   ("Instrumentation tags" in `references/loop.md`), then the repro file alone, its tagged
   output read against the prediction. A refuted hypothesis's tagged lines come out before
   the next one's go in. A confirmed hypothesis is the cause: its layer decides between
   section 4 and section 5.
6. **Every hypothesis refuted.** Rank new ones from what the tags showed and ask step 4's
   form again: the user approved that ranking, not the next.

## 4. Fix and prove it

1. **Fix** the cause at its source with the smallest change that removes it, not a guard
   where the symptom shows. An adjacent defect seen on the way is named in FIX.md, never
   fixed.
2. **Run** the repro file. Green goes to step 3. Still red is a failed fix: undo it with
   Edit so that attempts never stack, record it under Fix with what the run showed, and
   try the next hypothesis or the next change. The third failed fix goes to section 7.
3. **Regression proof**, by "The revert proof" in `references/loop.md`: the tree taken
   with the fix in, the fix reverted with Edit and the test red on the same assertion, the
   fix restored with Edit and the test green, and the tree taken again, equal to the
   first. A test that stays green with the fix reverted guards nothing: strengthen it and
   prove again. The repro test stays as the regression test, named for the behaviour it
   protects.
4. **Cleanup.** Remove every tagged line with Edit. Then Grep for the tag across the
   repository outside `temp/`, where FIX.md names it, and find no match. Run the repro file
   once more: green. Record the grep and the run under Cleanup.
5. **Gates.** Run the fast gates as the baseline ran them, read from the exit code and
   JSON, and compare with FIX.md's baseline, error by error for a gate that failed there.
   A failure the baseline did not have is the fix's: fix it. One the baseline already had
   is pre-existing, even in a file this fix touched: report it and leave it. `test` and
   `build` stay NOT RUN unless the user released them.
6. **Close**, by section 8.

## 5. A cause outside the frontend

The contract settles the layer. A response the contract allows, mishandled by the
frontend, is the frontend's bug. A missing field, a wrong value or a wrong claim belongs to
its owner: the backend, identity/auth, or the contract itself.

1. Stop fixing. Backend and identity code, and any repository or path the frontend does
   not own, is read freely and never edited, whatever the diagnosis proposes.
2. Remove any tagged lines and grep for the tag, as section 4 step 4 does.
3. Write FIX.md's Owner report in the shape "The owner report" in `references/loop.md`
   gives.
4. **Inside a feature**, also append one entry to the feature's planning/CONTRACT-GAPS.md,
   creating the file when absent, in the shape its section of
   `../planning-features/references/artifacts.md` gives, with the next `CG<n>` free across
   the live file and its archive ("The archive" there). Its first line names what the owner
   must change; the owner report stays the full account. A bug has no success criterion or
   task of its own, so the sub-items read:
   - `Needed for: the fix of <slug> (FIX.md: <FIX.md path>)`;
   - `Status:` `missing` or `differs`, as the evidence shows, or `unconfirmed` when the
     diagnosis is Likely rather than Confirmed;
   - `Blocks:` the feature's task the bug blocks, or `nothing`.

   Nothing sends, reformats or copies it anywhere. Outside a feature there is no
   CONTRACT-GAPS.md.
5. Ask with one form: "Stop with the owner report (recommended)" or "Add a frontend guard:
   <what it does> — <what it costs>". Only a guard the user approves is built. It first
   gets a test at the guard's seam, written as section 2 step 1 writes one and red while
   the guard is missing, since a diagnosis that sent the work here at once left no repro
   test. Then it goes through section 4 with that test, not skipped, so the revert proof
   holds for the guard. Once the guard is proven, a repro test written before it runs alone
   once more: green, it stays unskipped as a regression test the guard covers; still red, it
   is skipped exactly as step 6 says, its comment naming the owner's change. FIX.md calls it
   a guard: the fix stays the owner's.
6. Otherwise a repro test already written stays in the tree, marked skipped by "Skipping a
   repro that stays red" in `references/loop.md`, with a one-line comment stating in its
   own words why it fails — the reason: here, what the owner must change. The comment
   names no `temp/` path, planning id, ticket or session. FIX.md and the chat brief name
   the test, say it is skipped, and say to un-skip it once the reason is gone: the owner's
   change is in, or a fix for the cause.

## 6. No test runner, or no correct seam

There is no runner when "Running one test file" finds none. There is no correct seam when
the behaviour is reachable only in a running app — layout, focus, hydration, a real browser
API — or only by mocking the code under test. Either way the fix goes ahead without a
regression test, and says so:

- **Repro**: the manual steps that show the bug, for the user to run. Nothing here runs the
  app; the browser stays held.
- **From a diagnosis**, fix what it names. **From a report**, the hypotheses come from
  reading the code, with section 3's stop. No instrumentation goes in, since nothing would
  run it.
- **Regression proof**: "none — no test runner" or "none — no correct seam: <why>", said
  again in the chat brief beside the manual steps that confirm the fix.
- Gates and the close as section 4 steps 5 and 6.

## 7. Escalation after three failed fixes

A third fix that leaves the repro red ends the attempts: the cause is not where the
hypotheses put it, and a fourth guess costs more than a fresh look. Undo the third with
Edit, remove the tagged lines and grep for the tag, and record under Fix each attempt, what
it changed and what its run showed. Then ask with one form: "A fresh diagnosis through
investigating-bugs (recommended)", "Another attempt, in the direction the user gives", or
"Stop here". Unless the answer is another attempt, the repro test stays in the tree, skipped,
commented and reported as section 5 step 6 says, the reason being that the cause is not yet
found.

## 8. Close

Every path ends here: a fix, an owner report, an escalation, or the user's stop.

1. **Chat brief**: the status — fixed with a regression proof; fixed without a regression
   test, and why; an owner report; escalated; or stopped at the hypotheses — then the test
   file and its runs, the grep result, the gates and FIX.md's path. Inside a feature whose
   final review has not run, it says that review covers this fix.
2. **Inside a feature**, one PROGRESS.md ledger entry, `- <date> · fix · <slug> · <status>`,
   with the sub-item `- FIX: <FIX.md path>`. When it takes the ledger past 60 entries, the
   same write moves closed tasks' entries to planning/archive/PROGRESS.md, by "The archive"
   in `../planning-features/references/artifacts.md`.
3. **Review**, when a fix or an approved guard went in, and for a list always, once.
   Outside a feature, call the Skill tool with "core:reviewing-changes", naming no feature
   and the base tree from section 1 as the base. Inside a feature whose final review has
   run, by "The review chain" in `artifacts.md`, call it in `re-review` mode for the
   feature. The call ends this skill's run. Before the final review, and on every other
   path, this skill stops after step 2.

## What this must NOT do

- **Edit backend or identity code, or anything the frontend does not own.** Read it and
  write the owner report.
- **Add a frontend guard or workaround for another owner's bug** without the user's
  approval in section 5's form.
- **Run more than the one test file**: never the suite, `run-gates.mjs --gate test`, a
  watch mode, a build, a browser or Storybook before the user releases them. The test
  command is not pre-approved; it runs behind the normal permission prompt.
- **Leave the fix reverted.** The revert proof ends with the fix restored, the test green
  and the tree equal to the one taken before the revert.
- **Leave a tagged line behind.** The grep finds none before the review runs.
- **Take a fix out with git.** No `git stash`, `git checkout` or `git restore`; no staging,
  no commit, nothing that touches the index. The user commits after reading the code.
- **Stack a failed fix on another, or make a fourth attempt** without the user.
- **Claim a regression test that never went red with the fix reverted**, or a gate that did
  not run.
- **Decide a product question.** The expected behaviour comes from the report, the
  diagnosis or the user.
- **Carry a fact about an individual repository.** A repo's conventions live in its own
  files, read at the moment of use.
