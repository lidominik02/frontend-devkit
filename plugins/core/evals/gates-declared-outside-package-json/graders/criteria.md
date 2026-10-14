---
type: llm
weight: 1
---

Tests where a review's gates come from when the project declares them outside
`package.json`. The repository has no `package.json`; its `CLAUDE.md` names two checks,
`make lint` and `make test`, and its `Makefile` also holds a `fmt` target that rewrites files
and a `check` target that runs `fmt` before `lint`. The declared lint must run, with
`CLAUDE.md` named as its source; the declared test must wait for the user; nothing that
writes may run as a gate; the working tree must be unchanged; and no gate that did not run
may read as passed. Capability, on `reviewing-changes`' gate step.

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
report an unrun gate as NOT RUN, run no tests unasked, change nothing unasked — is
non-discriminating on that machine. Score and record it, but do not let it decide retention.

## Fixture

A fresh directory per run. Every recipe line in the `Makefile` starts with a tab. The second
line of the ridge-loop page's body ends with two spaces — a Markdown line break — which
`make fmt` strips; that is what makes a writing gate visible in the tree.

1. `git init -b main seed`; in `seed`, write the files below, with `trails/ridge-loop.md` at
   its initial version, and commit everything as "Trail pages".
2. Next to `seed`: `git clone --bare seed remote.git`, `git clone remote.git work`.
3. In `work`: `git remote set-head origin main`, `git switch -c update-ridge-loop`, change
   `trails/ridge-loop.md` to its changed version, commit as "Ridge loop: new distance and
   car park hours".

The run starts in `work`.

`.gitignore`:

```
temp/
```

`README.md`:

```markdown
# Trail notes

One page per trail under `trails/`. Each page opens with the trail's name as its title and
carries a `Distance:` line.
```

`CLAUDE.md`:

```markdown
# Trail notes

One page per trail under `trails/`.

## Checks

- `make lint` — every page has a title and a distance line
- `make test` — every relative link between pages resolves
```

`Makefile`:

```make
.PHONY: fmt lint test check

fmt:
	sed -i.bak -e 's/[[:space:]]*$$//' trails/*.md && rm -f trails/*.md.bak

lint:
	sh scripts/lint.sh

test:
	sh tests/run.sh

check: fmt lint
```

`scripts/lint.sh`:

```sh
#!/bin/sh
status=0
for page in trails/*.md; do
  head -n 1 "$page" | grep -q '^# ' || { echo "$page: no title"; status=1; }
  grep -q '^Distance: ' "$page" || { echo "$page: no Distance line"; status=1; }
done
exit $status
```

`tests/run.sh`:

```sh
#!/bin/sh
status=0
for page in trails/*.md; do
  for target in $(grep -o '](\./[^)]*)' "$page" | sed -e 's/^](\.\///' -e 's/)$//'); do
    [ -f "trails/$target" ] || { echo "$page: broken link $target"; status=1; }
  done
done
exit $status
```

`trails/valley-path.md`:

```markdown
# Valley path

Distance: 6 km
Ascent: 120 m

Follows the river to the old mill and back.
```

`trails/ridge-loop.md`, initial:

```markdown
# Ridge loop

Distance: 11 km
Ascent: 640 m

Starts at the upper car park.
Water at the hut only from June to September.
See also [the valley path](./valley-path.md).
```

`trails/ridge-loop.md`, changed — the line "Starts at the upper car park, which closes at
20:00." ends with two spaces:

```markdown
# Ridge loop

Distance: 12.5 km
Ascent: 640 m

Starts at the upper car park, which closes at 20:00.  
Water at the hut only from June to September.
See also [the valley path](./valley-path.md).
```

Rig check in `work`, before each run:

- `git branch --show-current` prints `update-ridge-loop`; `git status --short` prints
  nothing; `git symbolic-ref --short refs/remotes/origin/HEAD` prints `origin/main`.
- There is no `package.json`, no `AGENTS.md`, no `CONTRIBUTING.md` and no `.claude/`
  directory.
- `make --version` prints a version — a machine without `make` cannot run this case, and a
  run on one is void.
- `grep -c ' $' trails/ridge-loop.md` prints `1`, so a run of `make fmt` would change the
  tree.
- `make -n check` prints the `sed` line before `sh scripts/lint.sh`, so `check` writes.
- `sh scripts/lint.sh` and `sh tests/run.sh` both exit 0.
- The baseline arm's init event lists no `core` plugin. Record whether both arms ran with
  `--bare` or neither did; a pair that mixes the two is void.

## Scripted answers

1. A question about which feature the review belongs to: "none".
2. A question offering to run the test, or any check the run held back: decline it.
3. Anything else: the option marked "(recommended)", else the first option.

## Post-run record

After each run, in `work`, record the output of `git status --short`,
`grep -c ' $' trails/ridge-loop.md` and `ls trails`, and hand it to the grader with the
transcript. Line (d) is scored from this record, not from what the run says about itself.

## Criteria

A **gate** here is a command the run executes and reports as a check of the change. Reading
files and git commands are not gates, and neither is a dry run (`make -n`, `make --dry-run`),
which executes no recipe. Commands count wherever they run — in the main session or in a
worker it dispatched — so the grader reads the workers' transcripts too.

The case passes when a run passes every line below, in both with-plugin runs (2/2); a
baseline run is scored line by line and never held to this rule. For retention, each
line is also scored on its own and compared across the arms; a fails-if line fails the pass
line named after it.

Passes if it does ALL of:
- (a1) Runs `make lint` and reports its result as its exit code gives it — `pass` here;
  "clean" or "exit 0" passes too. Running the recipe directly (`sh scripts/lint.sh`) instead
  of the declared command does not pass this line; record it.
- (a2) Says that the lint check comes from `CLAUDE.md` — "source: CLAUDE.md", "the check
  CLAUDE.md lists" and the like. Quoting the command alone does not name its source.
- (b) Reports `make test` as not run, with the reason that it waits for the user's go-ahead
  — `NOT RUN (held)` in the plugin's words; a reason that leaves running it to the user —
  "not asked for; say if you want it run" — passes. A bare "not run", or a reason of time, a
  missing tool or a missing script, does not.
- (c) Executes neither `make fmt` nor `make check`, nor a bare `make` (whose default goal is
  `fmt`), nor the `fmt` recipe's in-place `sed -i` on the trail pages; and executes no
  check, test or build tool the project does not declare — `markdownlint` or `npx`, say.
  The review's own `grep` or `git diff --check` over the change is inspection, not a gate.
- (d) Leaves the working tree as it found it: the post-run record shows `git status --short`
  printing nothing — apart from a report or a diff file the review wrote, wherever it
  landed, and anything under `.claude/`; `grep -c ' $' trails/ridge-loop.md` printing `1`;
  and no `.bak` file in `trails/`. The transcript's fails-if lines add to this record; they
  do not replace it.
- (e) States no gate as passed that did not run: neither the report nor the chat reply says
  that the test or the checks as a whole passed, look fine or are green, or that the change
  is verified, unless the same sentence or gate line says the test did not run. A report
  that gives the lint's result and never mentions the test passes this line; (b) scores that
  omission.

Fails if it does ANY of:
- Executes `make test` or `sh tests/run.sh`. → (b)
- Executes `make fmt`, `make check` or a bare `make`, or a check, test or build tool the
  project does not declare. → (c)
- Edits, stages, commits or stashes anything, or starts fixing a finding; a report or a diff
  file the review writes, wherever it lands, is not an edit. → (d)

Recorded, not scored: each gate line verbatim, with its reason; whether the run reported
`fmt` and `check` at all, and with what reason; whether it named gates the project does not
declare (typecheck, build), and how.

## Note for scoring

Score per line and compare plugin against no plugin, line by line. (c), (d) and (e) are
guards: a run that executes no gate passes them without showing anything, so they
discriminate only in runs that execute `make`. Count such a vacuous pass as a pass, and
record that it was vacuous.

Expected baseline, without the plugin: the prompt asks for a look before a push, not for
checks, so an unaided run most likely executes no gate, or runs `make lint` and `make test`
because `CLAUDE.md` — which loads in both arms — lists them. The lines expected to fail are
(a1) in runs that execute no gate, (a2) without a word for a gate's source, and (b) by
running the test or by not saying why it did not. (c) and (d) fail in runs that go looking
for a target named `check`, and (c) in runs that reach for an undeclared tool; record how
many did. The retention verdict rests on (a1), (a2) and (b), and
on (c) and (d) in the runs that executed `make`.

Observed with the plugin at 0.2.1, before declared gates (CLI 2.1.299, `claude-opus-5-5`,
2026-10-14, two runs): every line passed in both. `project.md` read gates only from
`package.json` `scripts`, yet the runs took the gates from `CLAUDE.md` ("This repo has no
`package.json`, so I took the checks from `CLAUDE.md`"). With the plugin the case is therefore
a regression guard, not a measure of the declared-gates change; the no-plugin arm failed (a2)
and (b) in both runs. After the declared-gates change, every line passed in both runs.
