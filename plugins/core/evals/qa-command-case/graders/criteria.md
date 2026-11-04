---
type: llm
weight: 1
---

Tests the QA flow in a repository with no UI: a Node command-line script whose `CLAUDE.md`
declares a read-only check, a test suite and a build that writes. `plan` must verify the
criteria with `command` cases, each carrying its precondition, test data and retest, and no
`web:` check; `run`, once released, must run those commands, put the command and an extract
of its output in `REPORT.md` as the evidence, run no test or build the release does not
name, and run nothing that writes. Capability, on `testing-changes`' case schema and on its
`command` rule outside a frontend.

## Run

Hand-run, both arms, from the fixture below, with a fresh fixture per run, using the evals
README's hand-run rig started inside `work`. The with-plugin arm loads `plugins/core` only:
the fixture holds no UI, so no other plugin applies. The case has two turns in one session:
run it interactively, or send turn 1 with `claude -p` and turn 2 with `claude -p --continue`
in the same directory. Pass the prompt's `allowed_tools` as `--allowedTools`, `Bash`
unrestricted, so that holding a test, a build or a writing command back is the run's own
choice. Two runs per arm, minimum.

**User-level instructions.** Where an API key is available, run every arm with `--bare`, as
the README's hand-run rig describes; no line here depends on a hook. Where `--bare` is
unavailable, read the runner's `~/.claude/CLAUDE.md` and `~/.claude/rules/`: a rule that
holds tests or builds until released, or that forbids commands that write, makes lines (e)
and (e′) non-discriminating on that machine. Score and record them, but do not let them
decide retention.
The rig check records which applied.

## Fixture

A fresh directory per run. `git init -b main work`; in `work`, write the files below, commit
everything as "Initial commit", then write `temp/miles/PLAN.md`, which `.gitignore` keeps out
of git. There is no `package.json` anywhere.

`.gitignore`:

```
temp/
dist/
```

`CLAUDE.md`:

```markdown
# lengths

Converts a length between units. `bin/convert.mjs` is the command; the logic is in `src/`.

## Checks

- `node scripts/check.mjs` — every module under `src/` and `bin/` parses
- `node --test` — the test suite
- `node scripts/build.mjs` — the build: copies `src/` into `dist/`
```

`src/convert.mjs` (an unknown unit gives `NaN` instead of an error):

```js
const METRES = { m: 1, km: 1000, mi: 1609.344, ft: 0.3048 }

export function convert(value, from, to) {
  return (value * METRES[from]) / METRES[to]
}
```

`bin/convert.mjs`:

```js
#!/usr/bin/env node
import { convert } from '../src/convert.mjs'

const [value, from, to] = process.argv.slice(2)
console.log(convert(Number(value), from, to).toFixed(2))
```

`test/convert.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { convert } from '../src/convert.mjs'

test('a kilometre is a thousand metres', () => {
  assert.equal(convert(1, 'km', 'm'), 1000)
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

`scripts/build.mjs`:

```js
import { cpSync } from 'node:fs'

cpSync('src', 'dist', { recursive: true })
```

`temp/miles/PLAN.md`:

```markdown
# Plan: miles

## Success criteria
- SC1 · `node bin/convert.mjs <value> <from> <to>` prints the converted length to two
  decimals: 5 km is 3.11 mi — SAID
- SC2 · An unknown unit exits non-zero with a message naming the unit, and prints no
  number — SAID
- SC3 · That message reads clearly to someone using the tool for the first time — SAID
```

Rig check in `work`, before each run: `node scripts/check.mjs` exits 0;
`node bin/convert.mjs 5 km mi` prints `3.11`; `node bin/convert.mjs 5 km yd` prints `NaN`
and exits 0; `git status --short` prints nothing; `ls -R temp/miles` lists only `PLAN.md`;
no `dist/` and no `.claude/` directory exists. The baseline arm's init event lists no `core`
plugin; a with-plugin arm's lists `core@inline`. Record whether every arm ran with `--bare` or
none did — a pair that mixes the two is void.

## Scripted answers

1. Turn 1 is the prompt. When it ends, send turn 2, with the slash invocation on line 1:

   ```
   /core:testing-changes run miles

   The list is approved. Run it.
   ```

   That is the release for `run`; it names no test and no build.
2. A form asking to approve the list: the option that approves it as written.
3. A form offering to run the tests or the build: the option that keeps them held.
4. Anything else: the option marked "(recommended)", else the first option.

Stop when turn 2 ends or at `max_turns`. A run that reaches `max_turns` before turn 2 ends
is inconclusive on (d), (e), (e′), (f) and (g), not failed on them.

## Lines

Grade the list as the last write of the list file in turn 1, or, without one, the list in
turn 1's final reply; grade the report as the last write of the report file in turn 2, or,
without one, turn 2's final reply.

Passes if it does ALL of:
- **(a) Command case.** SC1 and SC2 each have at least one case whose check is a command
  that only reads — named as a command to run, with the command in the case. A case whose
  command is `node --test`, a test file or `scripts/build.mjs` does not count toward this.
  No case has a browser, design-intent or Storybook check: the repository has no UI. SC3
  may be user only.
- **(a′) The label, with-plugin arms only.** Each case counted under (a) carries the
  `command` label in its check. Scored in the with-plugin arms; the baseline arm is not
  held to the schema's label.
- **(b) Fields.** Every case states its precondition, its test data and what to retest after
  a fix. A field marked as having nothing to state is true for that case: a case that runs
  the command with input has test data, and a case that can be fixed has a retest — at
  least itself. SC1's and SC2's cases each name a real `data` value — the length and units
  SC1 converts, the unknown unit SC2 passes — and a retest other than none; `pre` may be
  none.
- **(c) Held for approval.** Turn 1 writes the list and stops: it runs no case's command —
  no `bin/convert.mjs`, no `node --test`, no `scripts/build.mjs` — and writes no report.
- **(d) The report runs it.** In turn 2, the command of every `command` case on the list that
  only reads runs — each a Bash call in the transcript — and the report gives each such case
  the command and an extract of its output. A case whose command is a test or the build is
  scored under (e), not here. SC1's case is observed with the output its data gives (`3.11`
  for 5 km to mi); SC2's case is a finding
  whose evidence shows `NaN` printed, or the exit code 0, for an unknown unit.
- **(e) Read-only and held.** Neither turn runs the test suite in any form — `node --test`
  with or without arguments, or a test file run directly, such as
  `node test/convert.test.mjs` — or `node scripts/build.mjs`; a case on the list that would
  need either is in the report as skipped or held, never as observed or clean. After the
  run `git diff --stat` prints nothing — no fixture file changed — and no `dist/` exists.
- **(e′) Nothing that writes.** Read from the transcript, not the end state: no Bash call in
  either turn writes a file or directory — no redirect into a file, no heredoc into a file,
  no `mkdir`, `cp`, `mv`, `rm`, `touch`, no script that writes, under `temp/`, `dist/` or
  anywhere else. Redirecting to `/dev/null` and duplicating a descriptor (`2>&1`) are not
  writes. The list and the report are written with the Write tool, which is expected.
- **(g) Every case accounted for.** Every case on the list appears in the report — observed,
  not observed, skipped or held with its reason, or a finding — including a case whose
  command would write.
- **(f) Nothing fixed.** `src/` and `bin/` are unchanged at the end, and the finding is left
  to the user.

Fails if it does ANY of:
- **(a)** Verifies SC1 or SC2 only by a manual step, by user only, or by a test or the build,
  or gives any case a browser, design-intent or Storybook check.
- **(a′)** In a with-plugin arm, a case counted under (a) labelled other than `command`.
- **(b)** Leaves the precondition, the test data or the retest out of the cases altogether,
  marks `data` as nothing to state on a case that passes input, names no real `data`
  value for SC1 or SC2, or gives an SC1 or SC2 case `retest: none`.
- **(c)** Runs a case's command, or writes a report, in turn 1.
- **(d)** Reports a `command` case as observed, clean or a finding with no run of its
  command, or with no command or output in its evidence.
- **(e)** Runs the test suite, a test file included, or the build, reports either as
  passed, or leaves `dist/` or a changed fixture file behind.
- **(e′)** Runs any Bash command that writes a file or directory, even one removed again or
  under a gitignored path, or writes the list or the report through Bash.
- **(f)** Edits `src/` or `bin/`.
- **(g)** Leaves a case on the list out of the report: neither observed, not observed,
  skipped, held nor a finding.

Recorded, not scored: whether the report says "frontend plugin not enabled in this session";
which skills the Skill tool calls named, in order; any permission prompt the run raised; the
exact form of the case lines.

## Note for scoring

Score per line, and compare plugin against no plugin; no run is recorded yet, so these are
expectations, not results. Without the plugin, (a) and (f) are expected to pass — a bare
model names a command to run for a command-line tool and fixes nothing it was not asked
to — so they are regression guards. (b) is expected to fail unaided: a free-form QA list
gives steps and an expected result, not a precondition, test data and a retest per case.
(e) is expected to fail unaided: a QA run on a project that declares a test suite tends to
run it, and the build with it. (c), (d), (e′) and (g) are uncertain at baseline; (a′) has no
baseline score. (b) and (e) decide retention.
