---
name: fixing-bugs
description: >-
  Fixes a frontend bug and proves the fix with a regression test: red before, green
  after, red again with the fix reverted. Starts from an investigating-bugs diagnosis,
  and asks for one when the cause is unclear. Use when the user says "fix this bug",
  "make this failing case pass" or "fix it with a regression test". For "debug this",
  "diagnose this" or "find the root cause", use investigating-bugs; for "fix the
  findings", executing-plans.
argument-hint: "[feature] [diagnosis or bug report]"
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs *) Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs" *) Bash(npx vitest run *) Bash(pnpm exec vitest run *) Bash(yarn vitest run *) Bash(bunx vitest run *) Bash(npx jest *) Bash(pnpm exec jest *) Bash(yarn jest *) Bash(bunx jest *) Bash(npm run *) Bash(pnpm run *) Bash(yarn run *) Bash(bun run *) Bash(git check-ignore *) Read Grep Glob Skill AskUserQuestion
---

You fix a bug in the frontend and prove the fix. A test that passes after a fix proves
nothing until it has also failed without it, so every fix here ends with that shown: red
before, green after, and — apart from an evident cause fixed at once — red again with the
fix taken out, green once it is back.

It starts from an `investigating-bugs` diagnosis the user ruled theirs to fix, edits
frontend code only, runs only the one test file it writes, and hands on to `reviewing-changes`.

## 1. Set up

1. **Facts.** Read the package manager, the framework packs and the gates by
   `../planning-features/references/project.md`, and load the packs it names; a later pack
   wins every conflict. The test runner and its single-file command come from "Running one
   test file" in `references/loop.md`. With no runner, section 5 governs every step below.
2. **Work folder.** A short slug for the bug. Inside a feature — one the caller or the user
   names — the folder is `temp/<feature>/bugs/<slug>/`, otherwise `temp/bugs/<slug>/`, at
   the repository's top level. It holds `FIX.md` ("FIX.md" in `references/loop.md`),
   written as each step ends. When
   `git check-ignore -q temp/` exits 1, say once that it lands in an untracked `temp/`.
   Never `git add` it. Inside a feature, what this skill reads of the feature's files
   follows `../planning-features/references/artifacts.md`.
3. **Report.** FIX.md's Report holds the bug as given, verbatim; non-English text is quoted,
   then translated. The expected behaviour is what the test will assert: when neither the
   report nor the diagnosis states it, ask before writing any test.
4. **Baseline.** Before the first edit, the repro test included, run the fast gates of each
   workspace the fix and its repro test touch as `project.md` says and take the tree with `node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs" take`,
   and record both in FIX.md, with the errors of a gate that fails. The review diffs from
   the tree; section 3 step 4 compares against the gates, so a failure that predates the
   fix is never blamed on it.
5. **Entry.** A diagnosis is an `investigating-bugs` report, in the conversation or at a
   path the caller names, with an owning layer, a root cause at `path:line` and a
   confidence.
   - A diagnosis whose owning layer is not the frontend goes to section 4 at once, with no
     test written.
   - A bug the user reports inside a feature, with no diagnosis, whose cause is evident and
     whose fix touches one function, goes to the evident-cause entry in section 2; so does a
     diagnosis whose Next step says "fix inline" in those words.
   - Every other frontend diagnosis that is Confirmed or Likely goes to section 2 and its
     revert proof, however small the fix.
   - With no diagnosis, or an Inconclusive one, ask for one: call the Skill tool with
     "core:investigating-bugs", then return here with its report.

## 2. From a diagnosis

1. Write the repro test at the seam the root cause sits behind ("A correct seam" in
   `references/loop.md`), built the way "Repro by kind of bug" there gives for this kind.
   It asserts the expected behaviour, so it fails while the diagnosed defect exists. It
   runs alone, by the single-file command, never as part of the suite.
2. Run that file alone. Red on that assertion, for the diagnosed reason, proves the
   diagnosis: go to section 3.
3. A failure to import, compile or mock is the test's own defect: put it right and run
   again. When the test is green, or red for another reason, it contradicts the diagnosis.
   Record what it showed under Diagnosis and ask for a fresh one as section 1 step 5 does,
   naming what the test showed.

**The evident-cause entry** fixes at once, with no revert proof: the test written and run
as steps 1 and 2 do, red for the cause; the fix as section 3 step 1 says; the file again,
green. Both runs go under Regression proof, then section 3 steps 4 and 5. A test not red for
the cause, or a fix that leaves it red, is step 3's contradiction: undo any fix with Edit
first. With no correct seam, section 5 governs.

## 3. Fix and prove it

1. **Fix** the cause at its source with the smallest change that removes it, not a guard
   where the symptom shows. An adjacent defect seen on the way is named in FIX.md, never
   fixed.
2. **Run** the repro file. Green goes to step 3. Still red is a failed fix: undo it with
   Edit so that attempts never stack, record it under Fix with what the run showed, and
   continue at section 2 step 3's contradiction.
3. **Regression proof**, by "The revert proof" in `references/loop.md`: the tree taken
   with the fix in, the fix reverted with Edit and the test red on the same assertion, the
   fix restored with Edit and the test green, and the tree taken again, equal to the
   first. A test that stays green with the fix reverted guards nothing: strengthen it and
   prove again. The repro test stays as the regression test, named for the behaviour it
   protects.
4. **Gates.** Run the fast gates as the baseline ran them, read from the exit code, and
   compare with FIX.md's baseline, error by error for a gate that failed there. A failure
   the baseline did not have is the fix's: fix it. One the baseline already had is
   pre-existing, even in a file this fix touched: report it and leave it. The held checks
   (`project.md`, `## Held checks`) stay NOT RUN (held) until the user releases them.
5. **Close**, by section 6.

## 4. A cause outside the frontend

The contract settles the layer. A response the contract allows, mishandled by the
frontend, is the frontend's bug. A missing field, a wrong value or a wrong claim belongs to
its owner: the backend, identity/auth, or the contract itself.

1. Stop fixing. Backend and identity code, and any repository or path the frontend does
   not own, is read freely and never edited, whatever the diagnosis proposes.
2. Write FIX.md's Owner report in the shape "The owner report" in `references/loop.md`
   gives.
3. **Inside a feature**, also append one `CG<n>` line to the feature's
   `temp/<feature>/CONTRACT-GAPS.md`, creating the file when absent, in the shape its
   section of `../planning-features/references/artifacts.md` gives. Its first line names
   what the owner must change and reads `missing` or `differs`, as the evidence shows, or
   `unconfirmed` when the diagnosis is Likely rather than Confirmed; the owner report stays
   the full account. Its sub-items read `Needed for: the fix of <slug> (FIX.md: <path>)`
   and `Blocks:` the feature's task the bug blocks, or `nothing`. Nothing sends, reformats
   or copies it anywhere. Outside a feature there is no CONTRACT-GAPS.md.
4. Ask with one form: "Stop with the owner report (recommended)" or "Add a frontend guard:
   <what it does> — <what it costs>". Only a guard the user approves is built. It first
   gets a test at the guard's seam, written as section 2 step 1 writes one and red while
   the guard is missing, then goes through section 3 with that test, so the revert proof
   holds for the guard. Then a repro test written before it runs alone once more: green, it
   stays as a regression test the guard covers; still red, it is skipped as step 5 says.
   FIX.md calls it a guard: the fix stays the owner's.
5. Otherwise a repro test already written stays in the tree, marked skipped by "Skipping a
   repro that stays red" in `references/loop.md`, with a one-line comment stating in its
   own words why it fails — what the owner must change. The comment names no `temp/` path,
   planning id, ticket or session. FIX.md and the chat brief name the test, say it is
   skipped, and say to un-skip it once the owner's change is in.

## 5. No test runner, or no correct seam

No runner is when "Running one test file" finds none; no correct seam, when the behaviour
is reachable only in a running app — layout, focus, hydration, a real browser API — or only
by mocking the code under test. The fix goes ahead without a regression test, and says so:

- **Repro**: the manual steps that show the bug, for the user to run; nothing here runs the
  app. **Fix** what the diagnosis names.
- **Regression proof**: "none — no test runner" or "none — no correct seam: <why>", said
  again in the chat brief beside the manual steps that confirm the fix.
- Gates and the close as section 3 steps 4 and 5.

## 6. Close

Every path ends here: a fix, an owner report, a contradicted diagnosis, or the user's stop.

1. **Chat brief**: the status — fixed with a regression proof; fixed without a regression
   test, and why; an owner report; or sent back for diagnosis — then the test file and its
   runs, the gates and FIX.md's path. Inside a feature whose final review has not run, it
   says that review covers this fix.
2. **Inside a feature**, one STATUS.md Log line: `- <date> · fix <slug>: <status> — <FIX.md path>`.
3. **Review**, when a fix or an approved guard went in. Outside a feature, call the Skill
   tool with "core:reviewing-changes", naming no feature and the base tree from section 1
   as the base. Inside a feature whose final review has run, call it in `re-review` mode
   for the feature. The call ends this skill's run. Inside a feature whose final review has
   not run yet, stop after step 2: that review covers the fix. With no fix and no guard,
   stop after step 2.

## What this must NOT do

- **Edit backend or identity code, or anything the frontend does not own.** Read it and
  write the owner report.
- **Add a frontend guard or workaround for another owner's bug** without the user's
  approval in section 4's form.
- **Run more than the one test file**: never the suite, the declared test command, a watch
  mode, another heavier check the user did not release (`../planning-features/references/project.md`, `## Held checks`), a browser
  or Storybook unreleased, or a command that writes as a gate (`## Gates` there).
- **Leave the fix reverted.** The revert proof ends with the fix restored, the test green
  and the tree equal to the one taken before the revert.
- **Take a fix out with git.** No `git stash`, `git checkout` or `git restore`; no staging,
  no commit, nothing that touches the index. The user commits after reading the code.
- **Claim a regression test that never went red** — with the fix reverted, or on the
  evident-cause entry before the fix — or a gate that did not run.
- **Decide a product question.** The expected behaviour comes from the report, the
  diagnosis or the user.
- **Carry a fact about an individual repository.** A repo's conventions live in its own
  files, read at the moment of use.
