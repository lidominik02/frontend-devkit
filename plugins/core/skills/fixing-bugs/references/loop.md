# The fix loop: lookup
## Running one test file

Only the repro's own file runs. Find the runner in `package.json` — `vitest` or `jest` among
the dependencies, or the command behind its `test` script — in the workspace package that
holds the test file, and run from that package's directory. Call the runner through the
package manager `../../planning-features/references/project.md` reads, never through the
`test` script: a script can add watch mode, coverage or other projects.

| Package manager | Vitest | Jest |
| --- | --- | --- |
| npm | `npx vitest run <file>` | `npx jest --runTestsByPath <file>` |
| pnpm | `pnpm exec vitest run <file>` | `pnpm exec jest --runTestsByPath <file>` |
| yarn | `yarn vitest run <file>` | `yarn jest --runTestsByPath <file>` |
| bun | `bunx vitest run <file>` | `bunx jest --runTestsByPath <file>` |

`<file>` is the path from the directory the command runs in.
- **Vitest** reads the argument as a filter, not an exact path: `cart.test.ts` also runs
  `mini-cart.test.ts` (read in Vitest 4.1.11): pass the whole relative path. Without `run`
  it watches; with several Vitest projects, `--project <name>` keeps the file to one.
- **Jest** reads a bare argument as a path regex; `--runTestsByPath` takes the exact path
  (read in `jest-config` and `@jest/core` 25.5.4). Never `--watch`.
- **Check each run's summary.** Vitest's `Test Files` line and Jest's `Test Suites:` line
  count exactly one file (labels read in Vitest 4.1.11 and `@jest/reporters` 25.5.1). A
  count above one means the run widened: correct the command, and never repeat it.
- A red run counts only on the test's assertion; failing to import, compile or mock is the
  test's own defect. **Another runner**: its documented single-file form, the same check.

## Skipping a repro that stays red

Only the repro test is skipped, never its neighbours or its `describe`: `it` → `it.skip`,
`test` → `test.skip` (Jest also `xit`, `xtest`). The one-line comment sits above it:
```ts
// Fails until the pricing API returns a VAT rate for every country it lists.
it.skip('adds VAT to the cart total for every listed country', () => {
```

Run the file alone once more: Vitest's `Tests` and Jest's `Tests:` line count it skipped,
not failed (read in `@vitest/runner` 4.1.11, `jest-circus` 29.7.0, `@jest/reporters` 25.5.1).

## Repro by kind of bug

Match the repository's existing tests — location, naming, helpers, way of mocking.
| Kind of bug | Repro |
| --- | --- |
| A wrong value from logic | Call the function with the input from the report; assert the expected output |
| Rendering or state in a component | Mount it with the library the repository's tests use, drive the reported interaction, assert on what the user would see |
| A value that goes stale | Mount, change the source, wait on a condition (never a fixed sleep), assert |
| Timing: a debounce, a timeout, a retry | Fake timers, advanced by exactly the interval that matters |
| A response the frontend mishandles | Mock at the network boundary as the repository's tests do, with the payload from the report; a captured real payload beats an invented one |
| A route or a navigation guard | A router in memory mode; navigate; assert where it lands |
| A store | A fresh store per test, and the action sequence from the report |
| Intermittent | Repeat the case in a loop inside the test and control randomness and time until it fails every run |
| Layout, focus, hydration, a real browser API | Usually no correct seam in a unit test: see "A correct seam" |

## A correct seam

A test at a correct seam drives the code through what its callers use — a function's
arguments and result, a component's props, events and rendered output, a store's actions and
state — and mocks only what lies outside the frontend: the network, time, randomness. A test
that has to mock the module under test, reach into private state, or assert how rather than
what, passes and fails with the implementation instead of the behaviour, so it proves
nothing about the bug. When no correct seam reaches the bug, that is the finding: the fix
goes ahead without a regression test, and FIX.md says why.

## The revert proof

It shows the test fails without the fix, and ends with the fix in place. Edits use Edit,
state is read with `snapshot.mjs` as the set-up runs it, and git never takes a fix out.

1. With the fix in and the repro green, run `snapshot.mjs take`: tree F.
2. `snapshot.mjs diff <base tree> --out <work folder>/fix.diff` — `fix-2.diff`, `fix-3.diff` on
   a later pass from step 4, a taken name being refused: each hunk's original text.
3. Revert each hunk of the fix — not the test — with Edit, fixed text → original.
4. Run the repro file: red, on the same assertion as the first red run. Green means the test
   does not depend on the fix: restore it, strengthen the test, start again at step 1.
5. Restore each hunk with Edit, original → fixed text.
6. Run the repro file: green. `snapshot.mjs take` again must equal F; when it differs,
   `snapshot.mjs diff F --out <work folder>/restore.diff` (`restore-2.diff` when taken) names
   what did not come back.

## The owner report

Written so the owner can act without asking back; credentials are named, never pasted.
```
## Owner report: <one line>
Owner: backend | identity/auth | the API contract — the repository or team, when known
Symptom: what the user sees, and the steps that show it
Evidence: the request and the response, or the claim, as observed, with where each was
  seen; `path:line` in the owner's code when it was readable
Root cause: what is wrong on the owner's side, and why it produces the symptom
Change needed: the endpoint, field, claim or rule, and the change
Frontend meanwhile: nothing | the guard the user approved, what it does and what it costs
Verify: the observation that shows the owner's fix works
```

## FIX.md

Owner report appears only when the cause is not the frontend's.
```
# Fix: <one-line summary>
Status: fixed | fixed, no regression test | owner report | sent back for diagnosis
Branch: <branch> · Base tree: <id>
Baseline gates: <gate line>; … — a FAIL with the errors it names

## Report        <verbatim; non-English quoted, then translated>
## Diagnosis     Given: <source> · Layer: <layer> — <evidence> · Root cause: <path:line> — <what>
                 Contradicted: <what the repro showed against it> | no
## Repro         <the test file and its single-file command> | <manual steps, and why no test>
                 Skipped: no | <the test> — un-skip once <the owner's change> is in · <summary line>
## Fix           <path:line — the change> · Failed attempt: <change, what its run showed> | none
                 Adjacent defects seen, not fixed: <path:line — what> | none
## Regression proof
- Red before: <command> — <the failing assertion> · <summary line>
- Green after: <command> · <summary line>
- Red with the fix reverted: <command> — <the failing assertion> · <summary line>
- Green restored: <command> · <summary line> · tree <F> equals <F again>
<or, for the evident-cause entry> the red before and green after lines only
<or> none — no test runner | none — no correct seam: <why>
## Gates         <gate line>; … — a FAIL with each error, the fix's or pre-existing
## Owner report  <the owner report>
```
