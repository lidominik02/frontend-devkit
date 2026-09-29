# The fix loop: lookup

## Running one test file

Only the repro's own file runs. Find the runner in `package.json` — `vitest` or `jest` among
the dependencies, or the command behind the script `project-facts` reports as `gates.test` —
in the workspace package that holds the test file, and run from that package's directory.
Call the runner through the package manager `project-facts` names, never through the `test`
script: a script can add watch mode, coverage or other projects.

| Package manager | Vitest | Jest |
| --- | --- | --- |
| npm | `npx vitest run <file>` | `npx jest --runTestsByPath <file>` |
| pnpm | `pnpm exec vitest run <file>` | `pnpm exec jest --runTestsByPath <file>` |
| yarn | `yarn vitest run <file>` | `yarn jest --runTestsByPath <file>` |
| bun | `bunx vitest run <file>` | `bunx jest --runTestsByPath <file>` |

`<file>` is the path from the directory the command runs in.

- **Vitest** reads the argument as a filter, not an exact path: it runs every test file whose
  path contains it, so `cart.test.ts` also runs `mini-cart.test.ts` (read in the source of
  Vitest 4.1.11). Pass the whole relative path. `run` makes it run once; without it Vitest
  watches in an interactive terminal. With several Vitest projects configured,
  `--project <name>` keeps the file to one of them.
- **Jest** reads a bare argument as a regular expression over paths; `--runTestsByPath`
  takes the exact path (read in the source of `jest-config` and `@jest/core` 25.5.4). Never
  `--watch`.
- **Check each run's summary.** Vitest's `Test Files` line and Jest's `Test Suites:` line
  count exactly one file; the labels were read in the source of Vitest 4.1.11 and of
  `@jest/reporters` 25.5.1. A count above one means the run widened: correct the command
  before reading the result, and never repeat it.
- Both runners exit non-zero when a test fails. A red run counts only when the failure is
  the test's assertion: a failure to import, compile or mock is the test's own defect.
- **Another runner**: its own documented single-file form, and the same one-file check.
  **No runner at all**: the skill's section on a missing runner or seam.

## Skipping a repro that stays red

Only the repro test is skipped, never its neighbours or the `describe` around them. The call
keeps its name: `it` becomes `it.skip`, `test` becomes `test.skip`.

| Runner | Skip form |
| --- | --- |
| Vitest | `it.skip(…)` or `test.skip(…)` |
| Jest | `it.skip(…)` or `test.skip(…)`; `xit(…)` and `xtest(…)` are aliases |

Another runner uses its own documented skip form. The skill's one-line comment sits on the
line above the test:

```ts
// Fails until the pricing API returns a VAT rate for every country it lists.
it.skip('adds VAT to the cart total for every listed country', () => {
```

Run the file alone once more: Vitest's `Tests` line and Jest's `Tests:` line count it
skipped, not failed. The forms and the labels were read in the source of Vitest and
`@vitest/runner` 4.1.11, `jest-jasmine2` 25.5.4, `jest-circus` 29.7.0 and `@jest/reporters`
25.5.1.

## Repro by kind of bug

Match the repository's existing tests — their location, naming, helpers and way of mocking —
so the regression test reads like its neighbours.

| Kind of bug | Repro |
| --- | --- |
| A wrong value from logic: a formatter, a calculation, a mapper | Call the function with the input from the report; assert the expected output |
| Rendering or state in a component | Mount it with the component-testing library the repository's tests already use, drive the interaction the report describes, assert on what the user would see |
| A value that goes stale or stops updating | Mount, change the source, wait for the framework's update cycle or the pending promises, assert. Wait on a condition, never a fixed sleep |
| Timing: a debounce, a timeout, a retry | Fake timers, advanced by exactly the interval that matters |
| A response the frontend mishandles | Mock at the network boundary, the way the repository's tests already do, with the payload from the report; a captured real payload beats an invented one |
| A route or a navigation guard | A router in memory mode; navigate; assert where it lands |
| A store | A fresh store per test, and the action sequence from the report |
| Intermittent | Raise the rate rather than chase a clean repro: repeat the case in a loop inside the test and control randomness and time until it fails every run |
| Layout, focus, hydration, a real browser API | Usually no correct seam in a unit test: see "A correct seam" |

## A correct seam

A test at a correct seam drives the code through what its callers use — a function's
arguments and result, a component's props, events and rendered output, a store's actions and
state — and mocks only what lies outside the frontend: the network, time, randomness. A test
that has to mock the module under test, reach into private state, or assert how rather than
what, passes and fails with the implementation instead of the behaviour, so it proves
nothing about the bug. When no correct seam reaches the bug, that is the finding: the fix
goes ahead without a regression test, and FIX.md says why.

## The triage threshold

A bug found inside a feature — a review finding, a QA finding, a bug the user reports — is
sorted by what its evidence shows before anything is fixed. The evidence is the cited line
and the failure scenario, or the report and the code it points to.

- **Evident, one function.** The evidence shows the cause, in the frontend's code, and the
  fix touches one function, judged from the proposed change against the code at the cause.
  It is fixed at once, with a regression test at a correct seam, or none where no correct
  seam reaches it. `fix-findings` in `executing-plans` fixes a review finding itself; any
  other goes to `fixing-bugs`' evident-cause entry.
- **Evident, wider.** The evidence shows the cause the same way, but the fix spans more
  than one function: `fixing-bugs`, with that cause as its diagnosis.
- **Unclear, or beyond the frontend.** The evidence shows where the failure appears, not
  why, or the cause reaches into the data, the contract or identity/auth:
  `investigating-bugs` first, then the user's ruling on remit.

## Instrumentation tags

The tag is `[fixing-bugs:<slug>]`, with the work folder's slug. Every instrumentation line
carries it, and every line that carries it is instrumentation, so removing the tagged lines
removes the instrumentation and nothing else:

```ts
console.log('[fixing-bugs:cart-total]', 'rate for', code, rate)
const seenBefore = calls.length // [fixing-bugs:cart-total]
```

- One line per statement. A statement split over several lines leaves its tail behind when
  the tagged line is removed.
- In markup, the language's own comment, on the same line, carries the tag.
- Log what the hypothesis predicts, at the boundary it names — the value as it arrives,
  before and after the suspect line — never everything.
- The runner prints console output with the test run, so the repro file's own run shows it.
- A token, a cookie or a credential in the output is named in FIX.md, never copied.

## The revert proof

It shows that the test fails without the fix, and it ends with the fix in place. Every step
edits with Edit and reads state with `snapshot.mjs`, run the way the skill's set-up runs it.
git never takes a fix out: `git stash`, `git checkout` and `git restore` touch the index or
discard work.

1. With the fix in and the repro green, run `snapshot.mjs take`: tree F.
2. Write the fix's diff, `snapshot.mjs diff <base tree> --out <work folder>/fix.diff`, for
   the original text of each hunk of the fix.
3. Revert each hunk of the fix — not the test, not the tags — with Edit: the fixed text as
   `old_string`, the original as `new_string`.
4. Run the repro file: red, on the same assertion as the first red run. Green means the test
   does not depend on the fix: restore the fix, strengthen the test, and start again at
   step 1.
5. Restore each hunk with Edit: the original as `old_string`, the fixed text as
   `new_string`.
6. Run the repro file: green. Run `snapshot.mjs take` again: the tree must equal F. When it
   differs, `snapshot.mjs diff F --out <work folder>/restore.diff` names what did not come
   back; put it right and take the tree again.

FIX.md's Regression proof records four runs — red before the fix, green after it, red with
it reverted, green with it restored — each with its command and summary line, and the two
tree ids.

## The owner report

Written so the owner can act without asking back:

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

Tokens and credentials are named, never pasted.

## FIX.md

Hypotheses appears only when hypotheses were ranked, and Owner report only when the cause is
not the frontend's.

```
# Fix: <one-line summary>
Status: fixed | fixed, no regression test | owner report | escalated | stopped at the hypotheses
Branch: <branch>
Base tree: <id>
Baseline gates: <gate> pass | FAIL: <the errors it names> | NOT RUN (<reason>) · …
Tag: [fixing-bugs:<slug>]

## Report
<verbatim; non-English quoted, then translated>

## Diagnosis
Given: <where the diagnosis came from> | Found: <the confirmed hypothesis>
Layer: frontend | backend | identity/auth | contract — and the evidence
Root cause: <path:line> — <what is wrong>
Contradicted: <what the repro showed against a given diagnosis> | no

## Repro
<the test file and its single-file command> | <the manual steps, and why there is no test>
Skipped: no | <the test> — un-skip once <the owner's change | a fix for the cause> is in · <summary line>

## Hypotheses
1. <cause at path:line> — <evidence>; predicts <what the tags show>; refuted by <what> —
   confirmed | refuted: <what the tags showed> | untested

## Fix
<path:line — the change>
Failed attempts: <each change, and what its run showed> | none
Adjacent defects seen, not fixed: <path:line — what> | none

## Regression proof
- Red before: <command> — <the failing assertion> · <summary line>
- Green after: <command> · <summary line>
- Red with the fix reverted: <command> — <the failing assertion> · <summary line>
- Green restored: <command> · <summary line> · tree <F> equals <F again>
<or, for the evident-cause entry> the red before and green after lines only
<or> none — no test runner | none — no correct seam: <why>

## Cleanup
Tagged lines removed: <n> · grep for the tag outside temp/: no match · repro green
Gates: <gate> pass | FAIL: <each error, the fix's or pre-existing> | NOT RUN (<reason>) · …

## Owner report
<the owner report>
```
