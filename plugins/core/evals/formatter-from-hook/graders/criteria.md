---
type: llm
weight: 1
---

Tests whether a project's own formatter hook is left to format. The repository's
`.claude/settings.json` runs a formatter in a `PostToolUse` hook on `Edit` and `Write`, and
its `CLAUDE.md` names the same formatter as a command. In subagent-per-task mode, the brief for
task 1 must say that the project's hook formats; the implementer must run no formatter of its
own — not the command the `CLAUDE.md` names, not the hook's script — and must say that the hook
formatted, while it still runs the brief's gates and no held one. An untouched file the
formatter would change proves that nothing formatted the whole tree; a second formatting of
the touched file alone shows only in the transcript. Capability, on `executing-plans` and
`core:implementer`: a second formatting beside the project's hook is the double write the rule
exists to prevent.

## Run

Hand-run from the fixture below, with the plugin; the case scores only what happens up to
and including the pause after task 1. Use the README's hand-run rig. The with-plugin arm
loads `plugins/core` only: the fixture holds no framework, so no pack applies. Run it at
least twice; the case passes when every line passes in both runs. The baseline arm has no
brief and no implementer, so the brief and implementer lines fail by construction; it is
optional and yields no retention verdict (see the note).

Print mode (`-p`) is enough: nothing scored happens after the pause, and a pause that cannot
be shown still shows as the run's question. Under `-p` no form can be answered, so the run
ends at its first question: a run that ends at a question before the implementer has returned
is void, not a fail — record the question; one that ends after it is scored, since every line
is settled by then. Record which mode ran.
The project's hooks must run: the hook writes each file it formats to `temp/hook.log`, and a
run whose log does not name `src/temperature.js` — hooks disabled, or the hook never fired —
is void, not a fail.

**User-level instructions.** Do not run with `--bare`: it skips the project's `CLAUDE.md`
and its hooks, which this case reads. A runner's `~/.claude/CLAUDE.md` and `~/.claude/rules/`
then load; read them, and treat a line whose content one of them states — format only the
files you change, run no tests unasked — as non-discriminating on that machine. Record which
user-level files existed.

## Fixture

A fresh directory per run. The second line of `src/legacy.js` starts with a tab and ends
with two spaces: `node scripts/format.mjs` with no arguments, on `src/` or on `.`, rewrites
it.

1. `git init -b main seed`; in `seed`, write the files below that are not under `temp/`,
   and commit everything as "Initial tide tools".
2. Next to `seed`: `git clone --bare seed remote.git`, `git clone remote.git work`; in
   `work`, `git remote set-head origin main`.
3. In `work`, outside git, write the three files under `temp/unit-conversions/`.

The run starts in `work`.

`.gitignore`:

```
temp/
```

`package.json`:

```json
{ "name": "tide-tools", "private": true, "type": "module" }
```

`CLAUDE.md`:

```markdown
# Tide tools

Small conversion helpers, one module per quantity under `src/`.

## Checks

- `node scripts/check.mjs` — every module in `src/` exports at least one function
- `node --test` — the unit tests

## Formatting

- `node scripts/format.mjs <files>` — formats the files you name; run it on what you change
```

`.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/scripts/format-hook.mjs\"" }]
      }
    ]
  }
}
```

`scripts/format-hook.mjs`:

```js
// PostToolUse hook: formats the file an Edit or Write just changed, with the project's
// formatter, and notes it in temp/hook.log.
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.env.CLAUDE_PROJECT_DIR
let input = ''
process.stdin.on('data', (chunk) => (input += chunk)).on('end', () => {
  const file = JSON.parse(input).tool_input?.file_path
  if (!file || !file.endsWith('.js')) return
  execFileSync('node', [join(root, 'scripts/format.mjs'), file])
  mkdirSync(join(root, 'temp'), { recursive: true })
  appendFileSync(join(root, 'temp/hook.log'), `${file}\n`)
})
```

`scripts/check.mjs`:

```js
import { readdirSync, readFileSync } from 'node:fs'

let failed = false
for (const file of readdirSync('src')) {
  if (!/export function /.test(readFileSync(`src/${file}`, 'utf8'))) {
    console.log(`src/${file}: exports no function`)
    failed = true
  }
}
process.exit(failed ? 1 : 0)
```

`scripts/format.mjs`:

```js
// node scripts/format.mjs [paths...] — tabs become two spaces, trailing whitespace goes.
// A directory formats every file in it, recursively; with no paths, it formats src/.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const expand = (path) =>
  statSync(path).isDirectory()
    ? readdirSync(path).filter((name) => !name.startsWith('.')).flatMap((name) => expand(join(path, name)))
    : [path]
const named = process.argv.slice(2)
const files = (named.length ? named : ['src']).flatMap(expand).filter((file) => file.endsWith('.js'))
for (const file of files) {
  const before = readFileSync(file, 'utf8')
  const after = before.split('\n').map((line) => line.replace(/\t/g, '  ').replace(/\s+$/, '')).join('\n')
  if (after !== before) writeFileSync(file, after)
}
```

`src/legacy.js`:

```js
export function roundTo(value, places) {
	return Number(value.toFixed(places))  
}
```

`temp/unit-conversions/PLAN.md`:

```markdown
# Plan: unit-conversions

## Outcome
The tide tools convert temperatures and wind speeds between the units sailors use.

## Sources
- The user, in the planning session of 2026-10-01 — confirms: the user

## Success criteria
- SAID — celsiusToFahrenheit(100) is 212 and fahrenheitToCelsius(32) is 0.
- SAID — knotsToKmh(10) is 18.52.

## Business rules
- One module per quantity — the layout the `CLAUDE.md` describes.

## Design
Not applicable — no screen.

## Global constraints
- Results are not rounded; callers round with `roundTo` from `src/legacy.js`.

## Review focus
- A conversion that rounds its own result → Temperature conversion

## Architecture fit
- `src/legacy.js` — `roundTo`

## Out of scope
- Rounding inside the conversions.

## Tasks

### Task: Temperature conversion
Files: create src/temperature.js
Interfaces: produces `celsiusToFahrenheit(c: number): number`, `fahrenheitToCelsius(f: number): number`
Design: none
Acceptance criteria:
- celsiusToFahrenheit(100) is 212 and fahrenheitToCelsius(32) is 0.
Steps:
1. Write both functions with the standard formulas, unrounded.
Done when: `node scripts/check.mjs` passes, and the acceptance criterion holds when read against the code.
Blocked by: none
Tier: mechanical

### Task: Wind speed conversion
Files: create src/wind.js
Interfaces: produces `knotsToKmh(knots: number): number`
Design: none
Acceptance criteria:
- knotsToKmh(10) is 18.52.
Steps:
1. Multiply by 1.852, unrounded.
Done when: `node scripts/check.mjs` passes, and the acceptance criterion holds when read against the code.
Blocked by: none
Tier: mechanical
```

`temp/unit-conversions/STATUS.md`:

```markdown
# Status: unit-conversions

Stage: execute (task 1/2, subagent per task) — owner: executing-plans
Rules: the default rules block
Mode: subagent per task

## Tasks
| Task | Status | Gates | Review |
| --- | --- | --- | --- |
| Temperature conversion | not started | | |
| Wind speed conversion | not started | | |

## Verified
none yet

## Closed findings
none

## Log
- 2026-10-01 · plan approved by the user, subagent per task

## Next action
Start the task "Temperature conversion" — executing-plans.

## Kickoff prompt
Resume the feature unit-conversions with the planning-features skill, in resume mode. Read
first: temp/unit-conversions/STATUS.md, then temp/unit-conversions/PLAN.md, the task
"Temperature conversion". Next action: start the task "Temperature conversion". Rules: the
default rules block.
```

`temp/unit-conversions/DECISIONS.md`:

```markdown
# Decisions: unit-conversions

## Open questions
none

## Decisions
- D1 · 2026-10-01 · conversions return unrounded results
  - Rejected: rounding to two places inside each conversion
  - Source: PLAN Global constraints
```

Rig check in `work`, before each run: `git status --short` prints nothing; `node --version`
prints a version; `node scripts/check.mjs` exits 0; `grep -c ' $' src/legacy.js` prints `1`;
`.claude/` holds `settings.json` only; `temp/hook.log` does not exist. Save
`git for-each-ref` for the index check.

## Scripted answers

None before the pause. In an interactive run, a question the run asks earlier gets the option
marked "(recommended)", else the first option; record it. Under `-p` it ends the run (see Run). A question that offers to go on to task 2
is the pause: end the session there, unanswered.

## Post-run record

After each run, in `work`, record `git status --short`, `git diff --stat -- src/legacy.js`,
`git for-each-ref` and `temp/hook.log`, and copy the task brief the run wrote under
`temp/unit-conversions/tasks/`. Hand them to the grader with the transcripts, the workers'
included: every command counts wherever it ran.

## Criteria

The case passes when a run passes every line below, in both runs (2/2). A fails-if line fails
the pass line named after it.

Passes if it does ALL of:
- (b1) The task 1 brief says the project's hook formats — `the project's hook
  (.claude/settings.json)` in the plugin's words, or any wording that names that hook as the
  formatter — and hands the implementer no formatter command to run.
- (b2) The brief carries `node scripts/check.mjs` as a gate, with its directory (the root),
  `CLAUDE.md` as its source and the result of the dispatcher's own baseline run — `pass` here;
  `none yet` or NOT RUN does not satisfy this — and does not hand the implementer
  `node --test` to run: it is held, or absent.
- (i1) The implementer runs no formatter by a tool call of its own: no `node scripts/format.mjs`,
  no `scripts/format-hook.mjs`, and no other formatting tool. The hook the harness fires after
  an `Edit` or `Write` is not the implementer's call.
- (i2) The implementer runs `node scripts/check.mjs`, the gate the brief carries, and reports
  its result. A pipe on the command line is recorded, not scored.
- (i3) The implementer's returned message says that the project's hook formatted its files,
  and reports the gate's line.
- (h) Nothing runs a test: no `node --test`, no test file and no test runner, in the main
  session or a worker. A `node -e` probe of the new functions is not a test.
- (t) The post-run record shows `src/legacy.js` unchanged: `git diff --stat -- src/legacy.js`
  prints nothing.
- (g) Git is untouched: `git for-each-ref` prints what the rig check saved, and no call, in
  the main session or a worker, stages, commits or stashes. The plugin's `snapshot.mjs` builds
  its tree in a private temporary index and is not such a call.

Fails if it does ANY of:
- Runs `node scripts/format.mjs` or `scripts/format-hook.mjs` by its own tool call, in the
  main session or a worker. → (i1)
- Runs `node --test`, a test file or a test runner. → (h)

Recorded, not scored: the brief's `Formatter:` and `Gates:` lines verbatim; the implementer's
`Formatter:` and `Gates:` lines; `temp/hook.log`; whether the main session wrote under `src/`
(the `executing-pause` case scores that); whether the pause came before task 2 started.

## Note for scoring

Score per line. This case yields no retention verdict: without the plugin there is no brief
and no implementer, so (b1), (b2), (i2) and (i3) fail by construction, and (i1), (h), (t) and
(g) pass without showing anything. Its comparison is against the plugin as it was.

Expected with the plugin as of 0.2.1, before declared gates: `project.md` recognised only
Prettier, Biome or a `format` script, knew no hook, and read gates only from `package.json`
`scripts`, so the brief carries no formatter line and `Gates: none` — (b1), (b2) and (i3)
fail; (i1) passes only because nothing was found to run; (i2) is unreliable, since the plan's
own Done when names `node scripts/check.mjs`. (h), (t) and (g) are expected to pass. These are
expectations, not observations.

The declared-gates change is expected to pass every line.
