# core

The domain-neutral pack, for any repository: a feature lifecycle, bug diagnosis and fixing
in any layer, branch syncing, review, commit and merge request text, browser verification
for UI work. Enable it in every repository; the framework packs depend on it.

Requires Node 22 or later as `node` on the `PATH` ([Installation](../../docs/installation.md#node)).

## Skills

Every skill answers to `/core:<skill-name>`. References are the files under the skill's
`references/`, loaded only when its body points at them. **Listed** skills also fire on
the phrasings in their descriptions; **typed** skills (`disable-model-invocation: true`)
run only when someone types them.

| Skill | | What it does | References |
| --- | --- | --- | --- |
| `clarifying-features` | listed | Settles what a feature must do from whatever sources exist and writes PLAN.md's spec sections; a small change gets an in-chat design instead. New work starts here | question-rounds, sources |
| `planning-features` | listed | Turns the spec into PLAN.md's tasks, keeps STATUS.md current, and resumes or checkpoints work | artifacts, project, rules-block |
| `executing-plans` | listed | Implements an approved plan task by task, through `core:implementer` workers or inline, and fixes review findings | dispatch |
| `reviewing-changes` | listed | Reviews the branch's committed, uncommitted and untracked changes against the spec and the repository's rules, with one two-axis reviewer and a verification pass | formats |
| `testing-changes` | listed | Builds a QA list from acceptance criteria for approval, then runs it | design-intent, qa-test-list, storybook-check |
| `finishing-features` | listed | Closes out a feature: the commit, the MR text, the open items, archiving | — |
| `investigating-bugs` | listed | Diagnoses a bug to its root cause, its owning layer and whether this repository owns that code, without changing code | — |
| `fixing-bugs` | listed | Fixes a bug in this repository's own code, in any layer, and proves it with a regression test: red, green, red with the fix reverted | loop |
| `syncing-branches` | listed | Rebases the user's branch onto main or across stacked branches behind a backup ref, keeping both sides' intent | conflicts, stacks |
| `describing-changes` | listed | Writes a commit message or merge request description in the repository's own convention | shaping-commits |
| `verifying-ui` | listed, as a trial | Verifies a UI change in a real browser through a browser MCP server, after an explicit release ([ADR 0008](../../docs/adr/0008-verifying-ui-model-invocable-trial.md)) | browser-tools, runtime-checks |
| `preparing-a-repo` | typed | Audits a repository for AI-assisted work and closes the gaps the user approves. Typed because it changes a host repository's own configuration | — |
| `designing-architecture` | typed | The senior architect: settles a hard decision — architecture, a library or approach, where something belongs — or critically evaluates the user's own design. Typed because a design skill that fires on its own drives unasked redesigns | codebase-design |

How the lifecycle skills chain together: [The feature lifecycle](../../docs/feature-lifecycle.md).

## Agents

Both are internal workers, not for direct use. Their fully-qualified names, `core:reviewer`
and `core:implementer`, always resolve to the ones shipped here, even when a consuming
repository has its own agent of the same name.

| Agent | Dispatched by | What it does |
| --- | --- | --- |
| `core:implementer` | `executing-plans` | Implements one plan task from a brief file and returns a short report |
| `core:reviewer` | `reviewing-changes`, `executing-plans` | Reviews a diff in a given role and reports findings with `file:line` evidence; never edits |

## Context cost

Only the listed descriptions are always loaded; bodies load on trigger, references when the
body points at them. `node scripts/validate.mjs --checks=budget`, run in this repository,
prints the always-on total of all packs against its ceiling
([ADR 0007](../../docs/adr/0007-context-cost-tiers-and-listing-ceiling.md)).

## Reading this file

This README is written to be read on GitHub, where its links into `docs/` and the other
packs resolve. An installed copy of the pack carries neither, and `claude plugin details`
does not show this file.
