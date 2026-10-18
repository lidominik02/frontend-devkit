---
type: llm
weight: 1
---

Tests the bug flow in a repository with no UI and no `package.json`: a Node command-line
script whose `CLAUDE.md` declares its checks, the tests among them as `node --test`. Asked
in the user's own words, with no skill typed, the run must reach `fixing-bugs`, treat the
code as this repository's own, prove the fix with one test file run by the declared runner,
take its gates from `CLAUDE.md` with the source named, and write no owner report.
Capability, on `fixing-bugs`' description and on its runner and gate rules outside a
JavaScript frontend.

## Run

Hand-run from the fixture below, with the plugin and without it. Use the evals README's
hand-run rig. The with-plugin runs load `plugins/core` only: the fixture holds no
framework, so no pack applies. Stop when the run ends, when a review report is written, or
at `max_turns`. Run each arm at least twice; the case passes when every line passes in both
with-plugin runs.

The prompt types no skill: line (a) is whether the description fires on it. Its last
sentence is in the register `fixing-bugs`' description quotes, so (a) mostly tests whether
the rest of the description — what kind of bug it is for — keeps it from firing in a
repository with no UI. Line (a) is scored in the with-plugin arms only; the baseline arm is
scored per line on (b)–(e).

Lines (c) and (d) score the fix phase: what the run does and reports up to its close. A
review the close starts may run its own commands; record those, and do not score them
against (c) or (d). A run that reaches `max_turns` before its close is inconclusive on
whatever it had not reached, not failed on it.

**User-level instructions.** A runner's `~/.claude/CLAUDE.md` and `~/.claude/rules/` load in
both arms unless the run isolates them. Where an API key is available, run every arm with
`--bare`, as the README's hand-run rig describes; no line here depends on a hook. Where
`--bare` is unavailable, read the runner's files: a rule that holds tests until released,
or that reports an unrun gate as NOT RUN, makes lines (c) and (d) non-discriminating on
that machine. Score and record such a line, but do not let it decide retention.

## Fixture

A fresh directory per run, one git repository, with no `package.json` anywhere.

`CLAUDE.md`:

```markdown
# tab-splitter

Splits a shared bill between people, to the cent. `bin/split.mjs` is the command; the
logic is in `src/`.

## Checks

- `node scripts/check.mjs` — every module under `src/` and `bin/` parses
- `node --test` — the test suite
```

`src/split.mjs` (lines 8–9 drop the remainder):

```js
export function splitCents(totalCents, people) {
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw new RangeError('totalCents must be a non-negative integer')
  }
  if (!Number.isInteger(people) || people < 1) {
    throw new RangeError('people must be a positive integer')
  }
  const share = Math.floor(totalCents / people)
  return Array.from({ length: people }, () => share)
}
```

`bin/split.mjs`:

```js
#!/usr/bin/env node
import { splitCents } from '../src/split.mjs'

const [total, people] = process.argv.slice(2)
const shares = splitCents(Math.round(Number(total) * 100), Number(people))
for (const cents of shares) console.log((cents / 100).toFixed(2))
```

`test/split.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splitCents } from '../src/split.mjs'

test('an even bill splits into equal shares', () => {
  assert.deepEqual(splitCents(9000, 3), [3000, 3000, 3000])
})
```

`scripts/check.mjs`:

```js
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

let failed = 0
for (const dir of ['src', 'bin']) {
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.mjs')) continue
    const result = spawnSync(process.execPath, ['--check', join(dir, name)], { stdio: 'inherit' })
    if (result.status !== 0) failed++
  }
}
process.exit(failed ? 1 : 0)
```

Set-up: `git init -b main`, add every file, commit as "Initial commit".

Rig check: `node scripts/check.mjs` exits 0; `node --test test/split.test.mjs` exits 0 and
reports one test; `node bin/split.mjs 100 3` prints `33.33` three times; `git status --short`
prints nothing. The baseline arm's init event lists no `core` plugin; a with-plugin arm's
lists `core`, from the source the run records. Record whether every arm ran with `--bare` or
none did — a pair that mixes the two is void. Pass the prompt's `allowed_tools` as
`--allowedTools`, `Bash` unrestricted. An untracked work folder under `temp/` after the run
is expected and is not a change to score.

## Scripted answers

1. A question about which feature the work belongs to: "none".
2. A form offering to fix the code here or to write an owner report instead: the option
   that fixes it here.
3. A form that offers only an owner report or a guard in another layer: the option marked
   "(recommended)". A run that reaches such a form has already failed (b) and (e); the
   answer only lets it end.
4. A form offering to release the held tests: the option that keeps them held.
5. Anything else: the option marked "(recommended)", else the first option.

## Lines

Passes if it does ALL of:
- **(a)** The `fixing-bugs` skill is invoked through the Skill tool — directly, or after an
  `investigating-bugs` call — before `src/split.mjs` changes.
- **(b)** The run treats the cause as this repository's code: where it names an owner or a
  layer for the bug, that is this repository. With none named, the line passes on the run
  fixing `src/split.mjs` here.
- **(c)** Before `src/split.mjs` changes, a test with a remainder in it — the report's 100.00
  between three, or another uneven split — is run with `node --test <that one file>` and
  fails on its assertion; after the fix it passes; with the fix taken back out it fails on
  the same assertion; with the fix put back it passes. At the end `splitCents(10000, 3)`
  returns `[3334, 3333, 3333]`, `splitCents(10, 4)` returns `[3, 3, 2, 2]`, and the new test
  is in the repository.
- **(d)** The run's chat brief, or its written fix record where it keeps one, names its
  gates from `CLAUDE.md`, with `CLAUDE.md` as their source: `node scripts/check.mjs` run,
  with its result; `node --test` over the whole suite not run and reported as held or
  NOT RUN, never as passed.
- **(e)** No owner report: the run's final status is not an owner report, and it addresses
  the cause to no one but the user.

Fails if it does ANY of:
- **(a)** Edits `src/split.mjs` with no Skill tool call for `fixing-bugs` before it.
- **(b)** Calls the cause another layer's or another owner's, or stops without fixing it
  because the code is not frontend code.
- **(c)** Changes `src/split.mjs` before any failing run of a test with a remainder; runs
  `node --test` with no file argument, with a directory, or with more than one file; takes
  the fix out with `git stash`,
  `git checkout` or `git restore`; or says the test would fail without the fix, with no run
  that shows it.
- **(d)** Names a gate no file of the repository declares — `npm test`, `npm run lint`, a
  linter or a type check — or reports a gate as passed that did not run.
- **(e)** Writes an owner report: a section headed as one, with content other than
  "none", in chat or in a written file.

Recorded, not scored: whether anything was staged, committed or stashed
(`git stash list`, `git diff --cached --name-only`, `git log`); which skills the Skill tool
calls named, in order; the commands a review started at the close ran; any permission
prompt the run raised.

## Note for scoring

Score per line, and compare plugin against no plugin. Read the order of events from the
transcript: which Skill calls ran, which file changed when, and what each test run printed.

Expected baseline. Without the plugin, (b) and (e) are expected to pass — nothing suggests
another owner — so they are regression guards, not evidence for retention; (c) and (d)
are expected to fail: an unaided run fixes first, runs `node --test` over the suite, and
reports no gate source. With `core` 0.4.1, (a) is uncertain: its `fixing-bugs` description
names a frontend bug, but the prompt's wording is the one it quotes. A run in which it fires
is expected to fail (c) — its runner lookup reads `package.json`, finds none, and fixes
with "no test runner" unless it takes its "another runner" line — and may fail (b) and (e)
on its "not the frontend" entry. Which of these fails today is what the 0.4.1 baseline
records, line by line.
