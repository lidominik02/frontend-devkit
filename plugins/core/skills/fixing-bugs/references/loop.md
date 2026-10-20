# The fix loop: lookup

## Contents
- Running one test file
- Skipping a repro that stays red
- Repro by kind of bug
- A correct seam
- The revert proof
- The owner report
- FIX.md

## Running one test file

Only the repro's own file runs. The runner is the test command the project declares for
the workspace that holds the test file — `## Gates` and `## Held checks` in
`../../planning-features/references/project.md` find it and its source — narrowed to the
runner's own documented single-file form and run from that workspace's directory. Call the
tool the declared command runs directly — `node --test <file>` for a `"test": "node --test"`
script — never through the script or target itself: one can add watch mode, coverage or
other suites. A tool the project installs for itself rather than on the `PATH` runs through
the launcher the project's own files already use for it — a build-tool wrapper, a virtual
environment, a local tool manifest, a package manager — never one guessed in its place. With no declared test command there is no runner: the
repro is `NOT RUN (no declared test command)`, and section 5 of `SKILL.md` governs.

`<file>` is the path from the directory the command runs in.
- **Exact path.** Some runners read a file argument as a filter or a pattern, so a short
  name also matches its neighbours: pass the whole relative path, or the runner's
  exact-path option where it has one. Never a watch mode.
- **Check each run's summary.** It must show one file ran: the runner's own count of files
  or suites where it prints one, otherwise a command naming exactly one file and a result
  listing only that file's tests. A wider run means the command widened: correct it, and
  never repeat it.
- A red run counts only on the test's assertion; failing to import, compile or mock is the
  test's own defect.

## Skipping a repro that stays red

Only the repro test is skipped, never its neighbours or its group, by the runner's own skip
form — a `.skip` call, a skip option, a skip marker. The one-line comment sits above it:
```ts
// Fails until the pricing service returns a VAT rate for every country it lists.
it.skip('adds VAT to the cart total for every listed country', () => {
```
```python
# Fails until the pricing service returns a VAT rate for every country it lists.
@pytest.mark.skip(reason="the pricing service omits VAT rates")
def test_vat_for_every_listed_country():
```

Run the file alone once more: the runner's summary counts it skipped, not failed.

## Repro by kind of bug

Match the repository's existing tests — location, naming, helpers, way of mocking.
| Kind of bug | Repro |
| --- | --- |
| A wrong value from a function or module | Call it with the input from the report; assert the expected output |
| A request an HTTP handler or a server route gets wrong | Drive the handler with the request from the report — in process, or through a server the test starts on a free port — and assert on the status and the body |
| A CLI or a script | Run it as a child process with the report's arguments and input, against a temporary directory; assert on the exit code, the output and the files it writes |
| Rendering or state in a component | Mount it with the library the repository's tests use, drive the reported interaction, assert on what the user would see |
| A value that goes stale | Mount, change the source, wait on a condition (never a fixed sleep), assert |
| Timing: a debounce, a timeout, a retry | Fake timers, advanced by exactly the interval that matters |
| A response from another service, mishandled here | Mock at the network boundary as the repository's tests do, with the payload from the report; a captured real payload beats an invented one |
| A route or a navigation guard | A router in memory mode; navigate; assert where it lands |
| A store | A fresh store per test, and the action sequence from the report |
| Intermittent | Repeat the case in a loop inside the test and control randomness and time until it fails every run |
| Layout, focus, hydration, a real browser API | Usually no correct seam in a unit test: see "A correct seam" |

## A correct seam

A test at a correct seam drives the code through what its callers use — a function's
arguments and result, a handler's request and response, a command's arguments and output, a
component's props, events and rendered output, a store's actions and state — and mocks only
what lies outside this repository's code: the network, time, randomness. A test
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
Owner: <who> — the repository, team or service, when known
Symptom: what the user sees, and the steps that show it
Evidence: the request and the response, or the claim, as observed, with where each was
  seen; `path:line` in the owner's code when it was readable
Root cause: what is wrong on the owner's side, and why it produces the symptom
Change needed: the endpoint, field, claim or rule, and the change
Meanwhile here: nothing | the guard the user approved, what it does and what it costs
Verify: the observation that shows the owner's fix works
```

## FIX.md

Owner report appears only when the cause is in consumed code, or the user chose "Owner
report instead".
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
<or> NOT RUN (no declared test command) | none — no correct seam: <why>
## Gates         <gate line>; … — a FAIL with each error, the fix's or pre-existing
## Owner report  <the owner report>
```
