---
type: llm
weight: 1
---

Tests whether a review's gates run per workspace. The repository holds three places that
declare checks: the root `package.json`, whose `lint` script lints every workspace; `web/`,
with its own `package.json` scripts; and `api/`, with its own `CLAUDE.md` and `Makefile`.
The change touches `api/` only. The `api` gates must run from `api/`, each line must name
`api` as its workspace and `api/CLAUDE.md` as its source, the declared test must wait for the
user, and no gate of the root or of `web` may run. Capability, on `reviewing-changes`' gate
step. The per-workspace baseline of `executing-plans` is not exercised here; this case
observes the gates.

## Run

Hand-run from the fixture below, in two arms: with the plugin and without it. Use the
README's hand-run rig. The with-plugin runs load `plugins/core` only: the fixture holds no
framework, so no pack applies. Stop when the review is written, or at `max_turns`. Run each
arm at least twice; the case passes when every line passes in both with-plugin runs.

Line 1 of the prompt is the typed invocation. Before the first baseline run, check whether
the CLI passes an unknown `/core:reviewing-changes` through to the model as text; when it
rejects it instead, the baseline prompt is the same without line 1. Record which, with the
CLI version.

**User-level instructions.** A runner's `~/.claude/CLAUDE.md` and `~/.claude/rules/` load in
both arms unless the run isolates them. Where an API key is available, run both arms with
`--bare`, as the README's hand-run rig describes; no line here depends on a hook. Where
`--bare` is unavailable, read the runner's files: a line whose content one of them states —
run checks from the package they belong to, run no tests unasked — is non-discriminating on
that machine. Score and record it, but do not let it decide retention.

## Fixture

A fresh directory per run. Every recipe line in the `Makefile` starts with a tab.

1. `git init -b main seed`; in `seed`, write the files below, with `api/routes/harvests.route`
   at its initial version, and commit everything as "Orchard app".
2. Next to `seed`: `git clone --bare seed remote.git`, `git clone remote.git work`.
3. In `work`: `git remote set-head origin main`, `git switch -c api-pickers-route`, change
   `api/routes/harvests.route` to its changed version, create `api/routes/pickers.route`,
   and commit both as "Add the pickers route".

The run starts in `work`.

`.gitignore`:

```
node_modules/
temp/
```

`package.json`:

```json
{
  "name": "orchard",
  "private": true,
  "workspaces": ["web"],
  "scripts": { "lint": "node tools/lint-all.mjs" }
}
```

`tools/lint-all.mjs`:

```js
import { execSync } from 'node:child_process'

execSync('npm run lint --workspace web', { stdio: 'inherit' })
execSync('make -C api lint', { stdio: 'inherit' })
```

`web/package.json`:

```json
{
  "name": "orchard-web",
  "private": true,
  "type": "module",
  "scripts": { "lint": "node scripts/lint.mjs", "test": "node --test" }
}
```

`web/scripts/lint.mjs`:

```js
import { readdirSync, readFileSync } from 'node:fs'

let failed = false
for (const file of readdirSync('src')) {
  if (readFileSync(`src/${file}`, 'utf8').includes('console.log')) {
    console.log(`src/${file}: console.log left in`)
    failed = true
  }
}
process.exit(failed ? 1 : 0)
```

`web/src/harvestTotals.js`:

```js
export function harvestTotal(crates) {
  return crates.reduce((sum, crate) => sum + crate.kg, 0)
}
```

`api/CLAUDE.md`:

```markdown
# Orchard API

Routes live in `routes/`, one file per resource.

## Checks

- `make lint` — every route file declares a method and a path on its first line
- `make test` — the route table resolves without duplicates
```

`api/Makefile`:

```make
.PHONY: lint test

lint:
	sh scripts/lint.sh

test:
	sh tests/run.sh
```

`api/scripts/lint.sh`:

```sh
#!/bin/sh
status=0
for route in routes/*.route; do
  head -n 1 "$route" | grep -Eq '^(GET|POST|PUT|DELETE) /' || { echo "$route: no method and path"; status=1; }
done
exit $status
```

`api/tests/run.sh`:

```sh
#!/bin/sh
dups=$(head -q -n 1 routes/*.route | sort | uniq -d)
[ -z "$dups" ] || { echo "duplicate routes: $dups"; exit 1; }
```

`api/routes/harvests.route`, initial:

```
GET /harvests
Lists the harvests of the current season.
```

`api/routes/harvests.route`, changed:

```
GET /harvests
Lists the harvests of the current season, newest first.
```

`api/routes/pickers.route`, changed — a new file:

```
GET /pickers
Lists the pickers on today's rota.
```

Rig check in `work`, before each run:

- `git branch --show-current` prints `api-pickers-route`; `git status --short` prints
  nothing; `git symbolic-ref --short refs/remotes/origin/HEAD` prints `origin/main`;
  `git diff --stat origin/main...HEAD` lists only the two files under `api/routes/`.
- `make --version` and `node --version` print versions — a machine without either cannot
  run this case, and a run on one is void.
- `make -C api -n lint` prints `sh scripts/lint.sh`; `(cd api && make lint)` and
  `(cd web && npm run lint)` exit 0; `make lint` at the root fails, since the root has no
  `Makefile`, so the directory a gate runs from is visible.
- There is no `AGENTS.md`, no `CONTRIBUTING.md`, no root `CLAUDE.md` and no `.claude/`
  directory.
- The baseline arm's init event lists no `core` plugin. Record whether both arms ran with
  `--bare` or neither did; a pair that mixes the two is void.

## Scripted answers

1. A question about which feature the review belongs to: "none".
2. A question offering to run the test, or any check the run held back: decline it.
3. Anything else: the option marked "(recommended)", else the first option.

## Post-run record

After each run, in `work`, record the output of `git status --short` and hand it to the
grader with the transcript. Line (d) is scored from this record, not from what the run says
about itself.

## Criteria

A **gate** here is a command the run executes and reports as a check of the change. Reading
files, git commands and a dry run (`make -n`) are not gates. Commands count wherever they
run — in the main session or in a worker it dispatched — so the grader reads the workers'
transcripts too.

The case passes when a run passes every line below, in both with-plugin runs (2/2); a
baseline run is scored line by line and never held to this rule. For retention, each line is
also scored on its own and compared across the arms; a fails-if line fails the pass line
named after it.

Passes if it does ALL of:
- (w1) Runs `make lint` from `api/` — `cd api && make lint` or `make -C api lint` — itself,
  as its own command, and reports its result as its exit code gives it, `pass` here. The
  `make -C api lint` that `tools/lint-all.mjs` runs inside the root script does not count, and
  neither does the recipe run directly (`sh scripts/lint.sh`).
- (w2) The lint's line names `api` as its workspace and `api/CLAUDE.md` as its source, in
  whatever words: "api · make lint · api/CLAUDE.md · pass", "api: `make lint` (from
  api/CLAUDE.md) passed".
- (w3) Reports `make test` as not run, with the reason that it waits for the user's go-ahead
  — `NOT RUN (held)` in the plugin's words; a reason that leaves running it to the user —
  "not asked for; say if you want it run" — passes. A bare "not run", silence, or a reason of
  time or a missing tool does not.
- (w4) Runs no gate of another workspace: not the root's `npm run lint` or
  `node tools/lint-all.mjs`, and neither `web`'s lint nor its test. Naming them as not run
  because the change does not touch them passes.
- (w5) Executes no check from the wrong directory: no `make lint` or `make test` at the root.
  Unlike the gate definition above, this line counts an attempt the run never reports — one
  that fails and is retried from `api/` fails it.
- (d) Leaves the working tree as it found it: the post-run record shows `git status --short`
  printing nothing, apart from a report or a diff file the review wrote, wherever it
  landed, and anything under `.claude/`. The transcript's fails-if lines add to this
  record; they do not replace it.
- (e) States no gate as passed that did not run: neither the report nor the chat reply says
  that the test or the checks as a whole passed or are green, or that the change is
  verified, unless the same sentence or gate line says the test did not run. A verdict on the
  code ("fine to push") is not a claim about the checks.

Fails if it does ANY of:
- Executes `make test` or `sh tests/run.sh`. → (w3)
- Executes the root `lint` script, `node tools/lint-all.mjs`, or any `web` script. → (w4)
- Edits, stages, commits or stashes anything, or starts fixing a finding; a report or a diff
  file the review writes, wherever it lands, is not an edit. → (d)

Recorded, not scored: each gate line verbatim; whether the run named the root and `web` gates
at all, and how; the directory each command ran from.

## Note for scoring

Score per line and compare plugin against no plugin, line by line. (d) and (e) are guards.

Expected baseline, without the plugin: (w2) and (w3) are expected to fail — an unaided
review rarely names where a check comes from, and the baselines of the `gates-declared-*`
cases ran the declared test unasked in every run. (w1) and (w4) depend on which file the run
reads first: from the root `package.json` it runs `npm run lint`, which lints `web` too and so
fails (w4); from `api/CLAUDE.md` it runs `make lint` in `api/` and passes (w1). Record which.

Expected with the plugin as of 0.2.1, before declared gates: `project.md` reads the root
`package.json` `scripts`, so the run is expected to run the root `lint` — failing (w1), (w2)
and (w4) — and, since the root declares no test, never to name `make test`, failing (w3).
These are expectations, not observations.

The declared-gates change is expected to pass every line.
