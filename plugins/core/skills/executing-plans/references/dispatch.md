# Briefs, dispatch prompts, fix rounds, the format pass, forms and troubleshooting

Every `temp/…` path below is written and handed on as an absolute path, under the repository
root that `git rev-parse --show-toplevel` prints.

## The task brief

`temp/<feature>/tasks/<NN>-<task-slug>-brief.md`. The implementer's own body carries its
general rules; the brief carries only this task's facts.

```
# Brief: <task name> — task <N> of <M>

Feature: <feature-slug>
Spec: temp/<feature>/planning/SPEC.md
Decisions: temp/<feature>/planning/DECISIONS.md
Report: temp/<feature>/tasks/<NN>-<task-slug>-report.md
Baseline: <abs path of each baseline file>
Scratch: <a directory outside the repository>
Released: test released | held · build released | held
Forbidden index writes: git add, git commit, git write-tree, git update-index, git read-tree, git commit-tree.

## Task
<the PLAN.md task, verbatim: Files, Interfaces, Design, Acceptance criteria, Steps, Done when>

## Global Constraints
<the PLAN.md section, verbatim>

## Review Focus
<each entry assigned to this task, verbatim> | none

## Built by earlier tasks
<each name this task consumes: the task that produced it and where it lives> | none
```

The Baseline line names the files in the `Baseline files:` sub-item of the latest
`execution start` or `baseline retaken` ledger entry. The scratch location is the session's
scratchpad directory when the host names one, else the system temp directory. A gate is
released only when the rules in HANDOFF.md or the user released it.

**The conflicts brief.** In subagent mode the conflicted files a git history or index task
leaves go through the per-task steps 2 to 7 on this template, under the git task's number
and slug. The Task section holds the git task verbatim, then a `Conflicted files:` line
with each path the operation left conflicted; those paths are the brief's Files. The base
the per-task step 5 diffs from is the tree `snapshot.mjs take` prints once the operation
has left the conflicts, not the git task's own base, so the diff holds the resolution
alone. Marking the files resolved, and continuing an operation that stopped on them — a
rebase stopped on a conflict waits for `git add` and `git rebase --continue` (git 2.43.0) —
is part of the git task: this session runs it after the per-task step 7, never the
implementer.

## Implementer dispatch

```
Implement one task of the plan for <feature-slug>.
Brief: <brief path>
Report: <report path>
Place: task <N> of <M>. Earlier tasks built: <one line each> | none. Later tasks build: <task names> — not yours.
Scratch: <the brief's scratch location>
```

Model: `sonnet` when the task's Tier is `mechanical`; for `judgment`, omit the model
parameter so the session model does it.

## Task review and re-review dispatch

Both take the shape every `core:reviewer` dispatch has, from the Dispatch prompts section
of `../../reviewing-changes/references/formats.md`. The Gates block holds one run-gates.mjs
JSON output per command run: the fast gates, then each released gate. This caller fills
the shape as follows.

Task review:

```
Role: two-axis
Diff file: <the path snapshot.mjs printed for temp/<feature>/tasks/<NN>-<task-slug>.diff>
Intent sources: <brief path> · temp/<feature>/planning/PLAN.md, the task "<task name>" · temp/<feature>/planning/SPEC.md · temp/<feature>/planning/DECISIONS.md
```

After the Released line, the two lines only this caller adds:

```
Implementer report: <report path> — claims to check against the code, not evidence
Raised by the dispatcher: <each changed file outside the brief's Files and the report, and each file the conflict table gives to another task, with that task> | none
```

Re-review: `Role: re-review`, `Diff file:` the path snapshot.mjs printed for
`temp/<feature>/tasks/<NN>-<task-slug>-fix<round>.diff`, the task review's intent sources,
and as role material `Prior findings:` followed by the open critical and important finding
blocks, each as the reviewer returned it.

## Status handling

The same table applies to a fix round's return.

| Status | Action |
| --- | --- |
| `DONE` | Diff the task and check the report against the code, then the task review |
| `DONE_WITH_CONCERNS` | Weigh each concern first. One that changes the scope or the product is the user's: stop and ask. Otherwise as `DONE`, with the concerns in the pause brief |
| `NEEDS_CONTEXT` | Answer from SPEC.md or DECISIONS.md, citing the line, and send the answer to the same implementer. When neither answers it: ask the user with one form, record the answer as a DECISIONS.md entry, then continue the implementer |
| `BLOCKED` | Stop, report what blocks it, and ask |

## Fix rounds

For the task review's open critical and important findings, in this order:

1. **Decision check.** Check each against DECISIONS.md and SPEC.md. One that contradicts a
   recorded decision or an EXTRA-tagged criterion goes to no implementer: ask with an
   AskUserQuestion form naming D<n> — Keep D<n> (recommended: the user decided it), or
   Change it. Keep writes a `ruling` ledger entry; Change writes a DECISIONS.md entry that
   supersedes D<n>, and the same write moves D<n> to planning/archive/DECISIONS.md; the
   finding joins the round.
2. **Rounds 1 and 2:** the fix-round message below to the same implementer, with SendMessage
   to the agent id the dispatch returned when that tool is available. When it cannot be
   continued, a fresh `core:implementer`, foreground, on the model the task's dispatch
   chose, gets the brief, the report and the findings.
3. **Round 3:** a fresh `core:implementer`, foreground, on `opus`, with the brief, the report
   and the findings.
4. **After every round:** diff from the tree the previous review saw — the `snapshot tree`
   at the end of its diff file's first line — to `tasks/<NN>-<task-slug>-fix<round>.diff`,
   run the gates as the task review does, and dispatch one `core:reviewer`, `sonnet`,
   foreground, role `re-review`, with that diff and the open findings. A finding it marks
   ADDRESSED closes; its new critical and important findings join the open ones after the
   same decision check.

The fix-round message, to the same implementer:

```
Fix round <N> for <task name>.
Findings (verbatim from the review):
<each open critical and important finding block>
Fix each one, re-run the gates covering the change, append a `## Fix round <N>` section to <report path> — what changed, the command, its output — and return the same short contract. Answer a finding you believe is wrong with evidence in that section; never skip one silently.
```

To a fresh implementer: the implementer dispatch, then:

```
This task is already implemented; the report records what was built and every earlier round.
<the fix-round message above>
```

## Fix brief for `fix-findings`

`temp/<feature>/tasks/<NN>-fix-findings-brief.md`, `<NN>` one more than the highest number
in `tasks/`. Dispatch it with the implementer dispatch; its Place line reads `fix round
after the review of the whole feature; every task is built`.

```
# Fix brief: <feature-slug> — review findings

Review: <review report path> · <re-review report path> | none
Plan: temp/<feature>/planning/PLAN.md
Spec: temp/<feature>/planning/SPEC.md
Decisions: temp/<feature>/planning/DECISIONS.md
Report: temp/<feature>/tasks/<NN>-fix-findings-report.md
Baseline: <abs path of each of the feature's latest baseline files>
Scratch: <a directory outside the repository>
Released: test released | held · build released | held
Forbidden index writes: git add, git commit, git write-tree, git update-index, git read-tree, git commit-tree.

## Fix
<each finding to fix: its block verbatim from the report, then `verified: <the file:line opened and what holds>`, and for one the triage fixes at once `regression test: <the seam it drives>, its one file run red before the fix and green after with <the single-file command> | none — no correct seam: <why>`>

## Leave alone
<each finding deferred, ruled, not verified or sent to fixing-bugs, by id — context only> | none

## Global Constraints
<the PLAN.md section, verbatim>
```

The Baseline line names the same files as a task brief's. A failure those files lack
belongs to the feature's work as a whole, since every Done task has changed the tree since.

A regression test is written at the seam its line names, and its line releases that one
file: red before the fix and green after, by the command "Running one test file" in
`../../fixing-bugs/references/loop.md` gives. The suite and the test gate stay as the
Released line has them.

## Judging a gate failure against the baseline

The implementer and this skill judge every gate failure by this one rule. A failure is
located from its gate's `output` and judged against the baseline files the brief's
`Baseline:` line names, never by which files the task touched — a changed type can break a
caller the task never opened, and an old error can sit in a file the task changed. An
`output` is cut when it reached 60 lines or 4000 characters: an error can then lie past
its start, so a comparison with it decides nothing.

- **The task's**: its gate passed in the baseline; or it failed there, neither `output`
  is cut, and the baseline's `output` lacks this error. Fixed, in an untouched file too.
- **Pre-existing**: its gate failed in the baseline, neither `output` is cut, and the
  baseline's `output` has the same error. Reported, not fixed, in a changed file too.
- **Undecided**: its gate has no comparable baseline entry — no file for it, the gate
  released after the baseline was taken, or NOT RUN there — or it failed there and either
  `output` is cut. Reported with its gate and location, neither fixed nor called
  pre-existing; the user rules on it, and it never enters a fix loop on its own.

A brief with no `Baseline:` line: every failure is reported with its location, saying no
baseline was given.

## The format pass after a Bash edit

Inline, a scripted Bash edit is followed by a pass over each file it touched, and no other,
with the formatter the format-on-write hook would pick for that file after an Edit, in the
hook's order (`${CLAUDE_PLUGIN_ROOT}/scripts/format-on-write.mjs` holds the full lists):

1. The formatter `gates.format` in `.claude/project.json` names, when its first word is a
   recognised one — prettier, biome, oxfmt, dprint, eslint, gofmt, ruff, rustfmt, black —
   the project's local binary first. Its own flags stay; any path it names is replaced by
   the touched files.
2. Otherwise by extension: the project's local prettier with `--write`, for the extensions
   the hook's `EXT_PRETTIER` lists, unless the project root holds `biome.json`,
   `biome.jsonc`, `dprint.json`, `.oxfmtrc` or `.oxfmtrc.json` and no prettier config
   (`.prettierrc*`, `prettier.config.*`, a `prettier` key in `package.json`) — then another
   formatter owns the file and prettier is not run; `gofmt -w` for `.go`; `ruff format` for `.py`, the
   local binary first; `rustfmt` for `.rs`.

A `package.json` format script, which project-facts.mjs also reports as `gates.format`, is
not the pass: it can name the whole repository (`prettier --write .`), and what it reformats
beyond the touched files lands in the task's diff. When nothing resolves for a file — no
recognised manifest formatter, no local prettier, an extension none of them covers, or a
formatter that cannot run — the task's ledger entry gains the sub-item
`No format pass: <each such file>`.

## Forms

**Mode.** One AskUserQuestion form: the recommended mode first, with the reason taken from
the plan — how tightly its tasks couple, how many there are, what a shipped mistake would
cost.

**Pause after a task.** A short brief — what was built, the review result, the rounds,
each undecided gate failure with its gate and location, anything the user must weigh —
then one AskUserQuestion form: Continue (recommended), Continue without pausing, Stop. Stop
leaves HANDOFF.md with the next task as the next action and the kickoff prompt rewritten
to match.

**Deviation.** One AskUserQuestion form naming the change: Keep it as planned (recommended),
or Change it, which writes a DECISIONS.md entry (superseding D<n> when it changes one).

**Blocked tasks at the end of the run.** One AskUserQuestion form: Review what is built
now, which goes on as the end of the run does when every task is Done, or Wait, which
leaves HANDOFF.md with the answers as the next action. Recommend Review when the conflict
table shares no file between a blocked task and a built one, since the answers then reopen
no reviewed code; otherwise Wait. Give the reason.

**Fix-findings.** AskUserQuestion forms of at most four findings each. Every finding offers
Fix, Defer and Keep as designed, the recommended one first: Fix for a CONFIRMED finding,
Defer for a PLAUSIBLE one, Keep as designed for one that conflicts with a decision.

**Remit.** After the investigation, AskUserQuestion forms of at most four findings each,
each question giving the finding's owning layer, root cause, confidence and Next step from
its short report. Every finding offers Take it — ours to fix, and Not ours — the owner from
its short report or the free-text answer; Take it is recommended when the owning layer is
the frontend, Not ours otherwise.

## Troubleshooting

| Error | Cause | Fix |
| --- | --- | --- |
| The implementer cannot be continued | No SendMessage tool, or the agent is gone | A fresh `core:implementer` with the brief, the report and the findings — or the answer to its question |
| `snapshot.mjs` exits 1 | Not a git work tree, a required clean filter failed (Git LFS sets `required`), or a base that names no tree | Stop and report its stderr. Never review without a diff |
| A diff holds a file's content unfiltered | A clean filter that is not `required` failed: git stores the content unfiltered, and `snapshot.mjs` exits 0 with nothing on stderr (git 2.43.0) | No stop: the diff is still the working state. Name the file and its filter to the reviewer |
| The recorded pre-execution tree is gone: `git cat-file -e <tree>^{tree}` exits non-zero | No ref holds the tree, and a `git gc` past its prune expiry deleted it (git 2.43.0) | Say so and ask with one form — Review from the merge-base (recommended; it also covers work that predates the run), or Stop — and record the answer in a `pruned` ledger entry. A recorded merge-base answer settles every later run, and so does a `sync` entry that "The final review's base" in `../../planning-features/references/artifacts.md` takes the base from; a recorded `stopped` is asked again |
| A gate hangs, or is refused as a watcher | The gate's script never exits | `run-gates.mjs` reports it not-run with `blocking: true`: a setup defect, not a task failure, so no fix round. Report it NOT RUN; the task stays open with the gate named |
| `run-gates.mjs` exits 1 with `passed: false` and `project.root: false`, every gate not-run with the reason "not a project root … cd to the project root and run this again" | The working directory is wrong: it has no `package.json` or `.claude/project.json` and is not the git top level | cd to the project root and re-run. Not a task failure: no fix round, and nothing from that run is recorded as a gate result |
| The user committed or staged between tasks | Normal | Nothing to do: the snapshot diff from the task's base tree still isolates the task |
| A task's diff touches a file another task owns | The conflict table gives the file to another task | Raise it in the review dispatch and in the pause brief |
