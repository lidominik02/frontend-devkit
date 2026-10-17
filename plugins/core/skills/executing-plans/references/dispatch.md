# Briefs, dispatch prompts, fix rounds and troubleshooting

Every `temp/…` path below is handed on as an absolute path under the repository root.

## The task brief

`temp/<feature>/tasks/<NN>-<task-slug>-brief.md`: this task's facts; the implementer carries the rest.

```
# Brief: <task name> — task <N> of <M>

Feature: <feature-slug>
Plan: temp/<feature>/PLAN.md
Packs: <each framework pack project.md found, in order> | none
Gates:
- <workspace directory> · <command> · source <file> · baseline <result>   (one line per fast gate of the workspaces the task touches, from STATUS.md's Verified, and one per held check the user released there, `baseline NOT RUN (held)` when it was released after the baseline; a workspace that declares nothing, its `NOT RUN (no declared command)` line)
Formatter:
- <workspace directory> · <the `## Formatter` command, with <paths> where that workspace's touched files go> | none (<reason>) | the project's hook (<settings file>)   (one line per workspace the task touches)
Scratch: <a directory outside the repository>
Released: <each held check the project declares: released | held> | none declared   (a released one runs from its `Gates:` line)
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

**Model and effort.** `mechanical` task: model: sonnet · effort: not set — measured: on
`executing-pause`, `formatter-from-docs` and `formatter-from-hook`, three runs each, it held
the criterion lines the session's model held, at 15% less per run (`claude-sonnet-5-5` under
a `claude-opus-5-5` session, Claude Code 2.1.299, 2026-10-15).
`judgment` task: model: the session's · effort: not set — not measured; no eval case holds a
`judgment` task. Fix round 3: model: the session's, whatever the Tier — a step up after two
rounds that did not close the findings. A fresh implementer that replaces one which cannot be
continued, in round 1 or 2, takes its task's Tier line. The fix brief for `fix-findings` takes the
`mechanical` line only when every finding to fix lies in a `mechanical` task's Files, else
the session's. The dispatch passes the model named; "the session's" and "not set" leave that
parameter out.

## Task review and re-review dispatch

Both take the shape every `core:reviewer` dispatch has, from
`../../reviewing-changes/references/formats.md`, filled as follows. Task review:

```
Role: two-axis
Diff file: <the path snapshot.mjs printed for temp/<feature>/tasks/<NN>-<task-slug>.diff>
Intent sources: <brief path> · temp/<feature>/PLAN.md, the task "<task name>"
Packs: <the brief's Packs line>
Gates: <each gate line run in step 6 — <workspace> · <command> · <source> · <result> — a FAIL with its quoted error lines>
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
Fix each one, re-run the brief's gates, and return the same short message with a "Fix round <N>" line — what changed, the command, its result. Answer a finding you believe is wrong with evidence; never skip one silently.
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
Gates:
- <workspace directory> · <command> · source <file> · latest <result>, else baseline <result>   (one line per fast gate of the workspaces the fixes touch, and one per held check the user released there; a workspace that declares nothing, its `NOT RUN (no declared command)` line)
Formatter:
- <workspace directory> · <the `## Formatter` command, with <paths> where that workspace's touched files go> | none (<reason>) | the project's hook (<settings file>)   (one line per workspace the fixes touch)
Scratch: <a directory outside the repository>
Released: <each held check the project declares: released | held> | none declared   (a released one runs from its `Gates:` line)
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
