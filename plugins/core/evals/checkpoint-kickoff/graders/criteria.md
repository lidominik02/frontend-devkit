---
type: llm
weight: 1
---

Tests the `checkpoint` mode: ad-hoc work with no plan — no feature folder, no `SPEC.md` or
`PLAN.md`, no tasks — a shape `plan` does not cover. The claim under test is that the skill
has *somewhere* to put this rather than forcing the user into a plan they explicitly said
they do not have, or silently doing nothing durable and leaving the state only in the
transcript — and that the file it writes ends with a prompt a new session can start from
by pasting it.

## Run

Hand-run, both arms, from the fixture below: the prompt describes a fix and a test suite,
and in the empty directory a harness run gets, a run that checks the repository would be
scored on finding neither. Checkpoint mode asks nothing, so
`claude -p` with the README's hand-run rig suffices. Score per line by hand: the harness's
verdict is whole-file and cannot show the discriminating lines.

The prompt types `/core:planning-features checkpoint`, so the with-plugin arm scores
checkpoint mode, not whether the description fires on "checkpoint". Check the `Skill` tool
result before anything else, as the rig requires.

User-level instructions: run both arms with `--bare` and an API key, as the README's
hand-run rig describes, so neither arm sees `~/.claude/CLAUDE.md` or `~/.claude/rules/`. No
line here depends on a hook; in a run without `--bare`, a gate result the Stop hook handed
the with-plugin arm is the hook's, not the skill's. Without an API key, both arms load the
runner's user-level instructions. On a machine whose user-level instructions ask for a
summary of what was done, what is verified and what is left, or for an unrun check to be
reported as NOT RUN, the line on what the file records and the fully-verified line are
non-discriminating: a baseline pass there comes from the runner's configuration. The rig
check records which applied.

## Fixture

A fresh directory per run, a git repository with one commit:

```
.gitignore                   node_modules/ and temp/, one per line
package.json                 below
tsconfig.json                below
src/reports/toCsv.ts         below
src/reports/toCsv.test.ts    below
src/reports/downloadBlob.ts  below, the committed version
src/reports/exportReport.ts  below
```

`package.json`:

```json
{
  "name": "reports-web",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "test": "vitest run"
  },
  "devDependencies": { "eslint": "^9.0.0", "typescript": "^5.6.0", "vitest": "^2.1.0" }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

`src/reports/toCsv.ts`:

```ts
export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\r\n')
}
```

`src/reports/toCsv.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { toCsv } from './toCsv'

describe('toCsv', () => {
  it('quotes every cell and escapes quotes', () => {
    expect(toCsv([['a', 'say "hi"']])).toBe('"a","say ""hi"""')
  })

  it('joins rows with CRLF', () => {
    expect(toCsv([['1'], ['2']])).toBe('"1"\r\n"2"')
  })
})
```

`src/reports/downloadBlob.ts`, as committed:

```ts
export function downloadBlob(filename: string, csv: string): void {
  const link = document.createElement('a')
  link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`
  link.download = filename
  link.click()
}
```

`src/reports/exportReport.ts`:

```ts
import { downloadBlob } from './downloadBlob'
import { toCsv } from './toCsv'

export function exportReport(name: string, rows: string[][]): void {
  downloadBlob(`${name}.csv`, toCsv(rows))
}
```

After the commit, overwrite `src/reports/downloadBlob.ts` in the working tree, uncommitted,
with the fix the prompt describes:

```ts
export function downloadBlob(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
```

Dependencies are not installed, so no run can observe the tests passing: the user's report
is the only evidence for them.

Rig check before each run: `git status --short` prints only ` M src/reports/downloadBlob.ts`,
`git log --oneline` prints one commit, and there is no `temp/`. Record whether both arms
ran with `--bare` and an API key, or without it and with user-level instructions present.

## Criteria

Plan structure, in the lines below, means a `SPEC.md`, a `PLAN.md`, a `PROGRESS.md` task
table, or a feature folder holding any of them. A handoff file on its own is not plan
structure, wherever it sits — `temp/handoffs/` included — and neither is a Left list of
the steps that remain.

Passes if it does ALL of:
- Writes a durable, on-disk handoff file for this work — not only a chat summary — without
  requiring or inventing plan structure.
- The file records what was done (the fix — object-URL streaming instead of a blob string
  for large CSVs), what is verified, what is not, and what is left (the manual check). It
  records the test pass as the user's report, not as something the run observed, and the
  manual check as not done or NOT RUN.
- States plainly whether this is safe to pick up in a fresh session or better finished now,
  choosing one, and says why — not merely a status dump with no judgment.
- The file ends with a paste-ready prompt for the next session that names what to read
  first (at least the handoff file itself) and the next action (the manual check of a CSV
  export over about 2MB).
- Invents no plan structure for one bug fix.

Fails if it does ANY of:
- Refuses, or asks the user to set up a plan first, before it will checkpoint anything.
- Produces only a chat-visible summary with nothing written to disk.
- Invents plan structure for what is explicitly a single, already-fixed bug with nothing
  further planned.
- Claims the fix is fully verified when the user said only that existing tests pass and
  manual verification is still pending. A status line saying verified, or done and
  verified, fires this even when the body lists the manual check as left.
- The file ends with no prompt for the next session, or with one that names no next
  action — a status file a new session has to interpret before it can act.

Secondary, reported but not part of the verdict: whether the kickoff prompt names the
rules that govern the work. The user set none for this fix, and the claim under test does
not include them.

## Notes

Scope: despite the case name, this tests `checkpoint` only, not `resume` — one session
cannot authentically test resuming with no memory of itself, since the same context that
wrote the checkpoint is still present to read it back. Resume's own behaviour — checking a
feature's artifacts against the actual repository state before trusting them — needs a
genuine cross-session setup and is verified by hand, the way this pack's README describes
for hand-run cases.

Scoring: no baseline expectation is claimed — plausibly a bare model already writes *some*
file when asked to "checkpoint," so the discriminating questions are whether it resists
inventing plan structure for a one-off fix, stays honest about what is and is not
verified, and leaves a prompt a new session can act on without reading the transcript.
Compare arms rather than assuming a result, after reading the Run section's note on
user-level instructions.
