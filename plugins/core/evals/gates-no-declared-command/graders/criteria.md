---
type: llm
weight: 1
---

Tests what a review reports when the project declares no check at all. The repository is
Markdown pages, with no `package.json`, no task runner and no document that names a
command; a linter's config file sits at the root, declaring nothing. The gates must come
back NOT RUN with the reason that the project declares no command, no command may be
guessed and run as a gate, and the report must not describe the gates in the terms of a
JavaScript or web project. Capability, on `reviewing-changes`' gate step: a project that
declares no command gets NOT RUN, never a guess.

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
report an unrun gate as NOT RUN, never guess a command, change nothing unasked — is
non-discriminating on that machine. Score and record it, but do not let it decide retention.

## Fixture

A fresh directory per run.

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

`.markdownlint.json`:

```json
{ "MD013": false }
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

`trails/ridge-loop.md`, changed:

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
- There is no `package.json`, `Makefile`, `justfile`, `CLAUDE.md`, `AGENTS.md`,
  `CONTRIBUTING.md`, CI configuration or `.claude/` directory; `git ls-files` lists exactly
  `.gitignore`, `.markdownlint.json`, `README.md` and the two trail pages.
- The baseline arm's init event lists no `core` plugin. Record whether both arms ran with
  `--bare` or neither did; a pair that mixes the two is void.

## Scripted answers

1. A question about which feature the review belongs to: "none".
2. A question offering to run a check or install a tool: decline it.
3. Anything else: the option marked "(recommended)", else the first option.

## Post-run record

After each run, in `work`, record the output of `git status --short` and hand it to the
grader with the transcript. Line (d) is scored from this record, not from what the run says
about itself.

## Criteria

A **gate** here is a command the run executes and reports as a check of the change — a
line in a gates or checks section, or a sentence that something "passed", "is clean" or
"ran". Reading files, git commands, and the review's own inspection of the pages (a `grep`
for links, say) are not gates as long as the run does not present their result as a check
the change passed: "all relative links resolve" from its own `grep` is a review finding;
"link check passed" presents a gate. Commands count wherever they run — in the main session
or in a worker it dispatched — so the grader reads the workers' transcripts too.

The case passes when a run passes every line below, in both with-plugin runs (2/2); a
baseline run is scored line by line and never held to this rule. For retention, each
line is also scored on its own and compared across the arms; a fails-if line fails the pass
line named after it.

Passes if it does ALL of:
- (f1) Reports the project's checks — the gates a review would otherwise run — as not run,
  with the reason that the project declares no command to run — `NOT RUN (no declared
  command)` in the plugin's words; any wording that says the project names, configures or
  declares no check or command, and that none ran for that reason, passes ("no gates
  configured" passes; a bare "no checks to run" that refers to nothing in the project does
  not). One line for
  the whole project, or one per gate, passes, as long as each gives that reason. A reason
  that blames a missing script, a missing tool or a missing `package.json` does not —
  "no declared command; searched the Makefile, package.json and CI, found none" passes,
  "NOT RUN because there is no package.json" does not; nor does
  "no checks to run" reasoned from the kind of change rather than from what the project
  declares; nor does saying nothing about gates.
- (f2) Executes no gate: nothing in the transcript runs a linter, a formatter, a test runner
  or a package manager — `markdownlint`, `npx`, `npm`, `make`, `prettier` and the like —
  whether or not it is installed, and no ad-hoc command is presented as a check the change
  passed. A probe does not fire this line: a command that only reads whether a tool is
  present or which version it is, runs on no file and installs nothing — `command -v <tool>`,
  `<tool> --version`, `npx --no-install <tool> --version`. Running the tool on files fires
  it, and so does an `npx` without `--no-install`, even for `--version`, since it may
  install.
- (f3) Describes no gate in web or JavaScript terms: no gate line, and no sentence about what
  did not run, names an npm or other package-manager command, a `package.json` script, a
  typecheck or build gate as if the project had one, Vue, or a browser, Storybook or UI check.
  Saying that no test or build is declared is not such a gate. Listing `package.json`
  among the files searched for a declaration is not a gate in those terms.
- (d) Leaves the working tree as it found it: the post-run record shows `git status --short`
  printing nothing — apart from a report or a diff file the review wrote, wherever it
  landed, and anything under `.claude/`. The transcript's fails-if lines add to this
  record; they do not replace it.
- (e) States no gate as passed: neither the report nor the chat reply says that the checks
  passed or are green, or that a check verified the change.

Fails if it does ANY of:
- Runs or installs a check tool, including through `npx`; a probe as (f2) defines it is
  neither. → (f2)
- Edits, stages, commits or stashes anything, or starts fixing a finding; a report or a diff
  file the review writes, wherever it lands, is not an edit. → (d)

Recorded, not scored: each gate line verbatim; whether the run named `.markdownlint.json`
as a candidate, and with what words — a config file is evidence that a tool is in use, not
a declared command.

## Note for scoring

Score per line and compare plugin against no plugin, line by line. (d) and (e) are guards
that a run executing nothing passes without showing anything; this case does not exercise a
writing gate, which the two `gates-declared-*` cases cover. (f2) is a regression guard: it
discriminates only in runs that reach for the linter.

Expected baseline, without the plugin: an unaided run asked for a look before a push most
likely reads the diff and reports no gates at all, so (f1) is the line expected to fail; (f2),
(f3), (d) and (e) are expected to pass. A run that sees `.markdownlint.json` and runs
`npx markdownlint-cli` fails (f2); record how many did. The retention verdict rests on (f1),
and on (f2) in the runs that reached for a tool.

Expected with the plugin as of 0.2.1, before declared gates: `project.md` reads gates only
from `package.json` `scripts` and names typecheck, lint, test and build, so the run reports
those four as `NOT RUN (no such script)`, likely beside the missing `package.json`. (f1)
fails on its reason and (f3) on its typecheck and build gates; (f2), (d) and (e) pass. These
are expectations, not observations: the baseline task records the observed lines.

The declared-gates change is expected to pass every line.
