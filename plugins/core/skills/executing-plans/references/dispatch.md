# Briefs, dispatch prompts, fix rounds and troubleshooting

Every `temp/…` path below is handed on as an absolute path under the repository root.

## The task brief

`temp/<feature>/tasks/<NN>-<task-slug>-brief.md`: this task's facts; the implementer carries the rest.

```
# Brief: <task name> — task <N> of <M>

Feature: <feature-slug>
Plan: temp/<feature>/PLAN.md
Packs: <each framework pack project.md found, in order> | none
Gates: <each fast gate with its baseline result from STATUS.md's Verified>
Scratch: <a directory outside the repository>
Released: test released | held · build released | held
Forbidden index writes: git add, git commit, git write-tree, git update-index, git read-tree, git commit-tree.

## Task
<the PLAN.md task, verbatim: Files, Interfaces, Design, Acceptance criteria, Steps, Done when>

## Decisions
<each D<n> entry the task names, verbatim> | none

## Global constraints
<the PLAN.md section, verbatim>

## Review focus
<each entry assigned to this task, verbatim> | none

## Built by earlier tasks
<each name this task consumes: the task that produced it and where it lives> | none
```

The scratch location is the session's scratchpad directory when the host names one, else
the system temp directory. A gate is released only when the rules in STATUS.md or the user
released it.

## Implementer dispatch

```
Implement one task of the plan for <feature-slug>.
Brief: <brief path>
Place: task <N> of <M>. Earlier tasks built: <one line each> | none. Later tasks build: <task names> — not yours.
Scratch: <the brief's scratch location>
```

## Task review and re-review dispatch

Both take the shape every `core:reviewer` dispatch has, from
`../../reviewing-changes/references/formats.md`, filled as follows. Task review:

```
Role: two-axis
Diff file: <the path snapshot.mjs printed for temp/<feature>/tasks/<NN>-<task-slug>.diff>
Intent sources: <brief path> · temp/<feature>/PLAN.md, the task "<task name>"
Packs: <the brief's Packs line>
Gates: <each gate run in step 6, with its result and the quoted error lines of a FAIL>
Released: <the brief's Released line>
Implementer message: <the implementer's returned message> — claims to check against the code, not evidence
Raised by the dispatcher: <each changed file outside the brief's Files and the message> | none
```

Re-review: `Role: re-review`, `Diff file:` the path snapshot.mjs printed for
`temp/<feature>/tasks/<NN>-<task-slug>-fix<round>.diff`, diffed from the tree the previous
review saw — the `snapshot tree` at the end of its diff file's first line — the task
review's intent sources, packs and the new gate block, and `Prior findings:` followed by the
open critical and important finding blocks, each as the reviewer returned it.

## Fix rounds

The fix-round message, to the same implementer (rounds 1 and 2, with SendMessage to the agent
id the dispatch returned):

```
Fix round <N> for <task name>.
Findings (verbatim from the review):
<each open critical and important finding block>
Fix each one, re-run the fast gates, and return the same short message with a "Fix round <N>" line — what changed, the command, its result. Answer a finding you believe is wrong with evidence; never skip one silently.
```

To a fresh implementer — round 3, or when the first cannot be continued: the implementer
dispatch, then "This task is already implemented; the diff at <the latest task diff path>
shows what was built." and the fix-round message.

## Fix brief for `fix-findings`

`temp/<feature>/tasks/<NN>-fix-findings-brief.md`, `<NN>` one more than the highest number
in `tasks/`. Dispatch it with the implementer dispatch; its Place line reads `fix round
after the review of the whole feature; every task is built`.

```
# Fix brief: <feature-slug> — review findings

Review: <review report path> · <re-review report path> | none
Plan: temp/<feature>/PLAN.md
Packs: <each pack, in order> | none
Gates: <each fast gate with its `latest:` result from STATUS.md's Verified, else its `baseline:`>
Scratch: <a directory outside the repository>
Released: test released | held · build released | held
Forbidden index writes: git add, git commit, git write-tree, git update-index, git read-tree, git commit-tree.

## Fix
<each finding to fix: its block verbatim from the report, then `verified: <the file:line opened and what holds>`>

## Leave alone
<each finding deferred, kept or not verified, by id — context only> | none

## Global constraints
<the PLAN.md section, verbatim>
```

## Troubleshooting

| Error | Cause | Fix |
| --- | --- | --- |
| `snapshot.mjs` exits 1 | Not a git work tree, a required clean filter failed (Git LFS sets `required`), or a base that names no tree | Stop and report its stderr. Never review without a diff |
| The recorded pre-execution tree is gone: `git cat-file -e <tree>^{tree}` exits non-zero | No ref holds the tree, and a `git gc` past its prune expiry deleted it (git 2.43.0) | Ask with one form — Review from the merge-base (recommended; it also covers work that predates the run), or Stop — and write the answer as a Log line |
| The user committed or staged between tasks | Normal | Nothing to do: the snapshot diff from the task's base tree still isolates the task |
