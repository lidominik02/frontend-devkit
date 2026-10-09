# core

The framework-agnostic pack: a feature lifecycle, bug diagnosis and fixing, branch
syncing, review, commit and merge request text, browser verification, and deterministic
hooks. Enable it in every repository; the framework packs depend on it.

Requires Node 22 or later as `node` on the `PATH` ([Installation](../../docs/installation.md#node)).

## Skills

Every skill answers to `/core:<skill-name>`. References are the files under the skill's
`references/`, loaded only when its body points at them. **Listed** skills also fire on
the phrasings in their descriptions; **typed** skills (`disable-model-invocation: true`)
run only when someone types them.

| Skill | | What it does | References |
| --- | --- | --- | --- |
| `clarifying-features` | listed | Settles what a feature must do from whatever sources exist and writes SPEC.md; a small change gets an in-chat design instead. New work starts here | question-rounds, sources |
| `planning-features` | listed | Turns SPEC.md into a task-level PLAN.md, keeps the handoff files current, and resumes or checkpoints work | artifacts, handoff-format, plan-format, rules-block |
| `executing-plans` | listed | Implements an approved plan task by task, through `core:implementer` workers or inline, and fixes review findings | dispatch |
| `reviewing-changes` | listed | Reviews the branch's committed, uncommitted and untracked changes against the spec and the repository's rules, with independent reviewers and a verification pass | formats, lenses |
| `testing-changes` | listed | Builds a QA list from acceptance criteria for approval, then runs it | design-intent, qa-test-list, storybook-check |
| `finishing-features` | listed | Closes out a feature through one menu: verification, docs, commit, MR text, open items, archiving | menu |
| `investigating-bugs` | listed | Diagnoses a bug to its root cause and owning layer without changing code | batch |
| `fixing-bugs` | listed | Fixes a frontend bug and proves it with a regression test: red, green, red with the fix reverted | loop |
| `syncing-branches` | listed | Rebases the user's branch onto main or across stacked branches behind a backup ref, keeping both sides' intent | conflicts, stacks |
| `describing-changes` | listed | Writes a commit message or merge request description in the repository's own convention | shaping-commits |
| `verifying-ui` | listed, as a trial | Verifies a UI change in a real browser through a browser MCP server, after an explicit release ([ADR 0008](../../docs/adr/0008-verifying-ui-model-invocable-trial.md)) | browser-tools, runtime-checks |
| `preparing-a-repo` | typed | Audits a repository for AI-assisted work and closes the gaps the user approves. Typed because it changes a host repository's own configuration | — |
| `designing-architecture` | typed | Settles an architectural question, or surveys a codebase for restructuring candidates. Typed because a design skill that fires on its own drives unasked redesigns | alternatives, codebase-design, survey |
| `optimizing-prompts` | typed | Rewrites a rough prompt into a ready-to-run one. Typed because its job is to *not* carry out the text it is handed | patterns |

How the lifecycle skills chain together: [The feature lifecycle](../../docs/feature-lifecycle.md).

## Agents

Both are internal workers, not for direct use. Their fully-qualified names, `core:reviewer`
and `core:implementer`, always resolve to the ones shipped here, even when a consuming
repository has its own agent of the same name.

| Agent | Dispatched by | What it does |
| --- | --- | --- |
| `core:implementer` | `executing-plans` | Implements one plan task from a brief file and writes a report |
| `core:reviewer` | `reviewing-changes`, `executing-plans` | Reviews a diff in a given role and reports findings with `file:line` evidence; never edits |

## Hooks

| Hook | Event | What it does |
| --- | --- | --- |
| `block-secrets.mjs` | PreToolUse | Blocks reading or sending credential material through file tools and `Bash` |
| `commit-hygiene.mjs` | PreToolUse | Blocks a commit message with an attribution trailer or a private reference, and the `git` push and merge forms it can parse |
| `format-on-write.mjs` | PostToolUse | Formats what was just written with the project's own formatter |
| `verify-before-done.mjs` | Stop | Blocks the end of a turn when a `fast` gate fails |

Details, and what no hook covers: [Hooks](../../docs/hooks.md#what-no-hook-covers). The
scripts the skills and hooks share: [Scripts](../../docs/scripts.md).

## Context cost

Only the listed descriptions are always loaded; bodies load on trigger, references when the
body points at them. `node scripts/validate.mjs --checks=budget`, run in this repository,
prints the always-on total of all packs against its ceiling
([ADR 0007](../../docs/adr/0007-context-cost-tiers-and-listing-ceiling.md)).

## Reading this file

This README is written to be read on GitHub, where its links into `docs/` and the other
packs resolve. An installed copy of the pack carries neither, and `claude plugin details`
does not show this file (observed on Claude Code 2.1.283).
