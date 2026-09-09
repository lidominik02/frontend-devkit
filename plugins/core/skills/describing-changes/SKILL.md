---
name: describing-changes
description: >-
  Write a commit message and/or a merge request description for the current changes,
  following this repository's own convention rather than a generic one. Reads
  the project's own commitlint config, git remote and merge-request templates, so it
  needs no configuration added to the repo. Use this whenever the
  user says "write the commit message", "commit message for this", "generate an MR
  description", "MR description", "PR description", "describe these changes",
  "what should I call this commit", or asks for a changelog entry for work in progress
  — even if they do not mention the convention, and even if they only ask for one of
  the two. Works on GitLab merge requests and GitHub pull requests alike.
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/project-facts.mjs) Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.mjs *) Bash(git log *) Bash(git diff *) Bash(git status *) Read Grep Glob
---

You turn a diff into the two artifacts a reviewer reads: a commit message and a merge
request description. Both are written to *this* repository's convention, which is data
you look up — never a house style you assume.

## Step 1 — The facts, already loaded

!`node ${CLAUDE_PLUGIN_ROOT}/scripts/project-facts.mjs`

That is this repository, read from its own files — do not run it again. It gives
`commit` (whether a commitlint config enforces the convention, and where it lives),
`git` (host, whether self-hosted, and whether `glab`/`gh` is on PATH),
`changeTemplates`, and `baseBranch`.

**If `commit.enforced` is true, read the config file it points at.** That file is the
convention — it defines the exact allowed types and scopes, the subject case, and the
length limit, and CI rejects anything else. A summary of it would be a second copy
that can drift; the config cannot.

If no commitlint config exists, **derive the convention instead of assuming it**:

```
git log --no-merges -n 30 --pretty=format:%s
```

Then say what you inferred and what you based it on — "the last 30 subjects are all
`type(scope): subject`, so I'm following Conventional Commits" — so a wrong inference
is visible rather than silent. Default only as a last resort: Conventional Commits
with a short but informative body.

## Step 2 — Read the actual change

```
git diff <baseBranch>...HEAD          # or: git diff --staged / git diff HEAD
git diff <baseBranch>...HEAD --stat
```

Describe what the diff *does*, not what the branch is called. A branch named
`fix/login` whose diff also adds a rate limiter needs both facts in the message.

## Step 3 — Write the commit message

Under Conventional Commits, the default here:

```
type(scope): imperative subject under ~72 chars

Body: what changed and WHY, wrapped at ~72. Short but informative —
enough that someone reading `git log` in six months understands the
reason without opening the diff. Skip the body only for genuinely
trivial commits.
```

- Subject in the imperative — "add", not "added" or "adds".
- The body explains the *why*. The diff already shows the what.
- Note breaking changes explicitly (`!` after the scope, or a `BREAKING CHANGE:`
  footer).
- Match the repository's real types. If its history only ever uses
  `feat|fix|chore|refactor`, do not introduce `perf` because the spec allows it.

## Step 4 — Write the MR/PR description

If `changeTemplates` is non-empty, **read the template and fill its actual sections.**
Do not substitute your own structure — the template is what reviewers expect, and its
checklist often names the exact commands the project wants run. Otherwise:

```
## What changed
## Why
## How to verify
## Notes for the reviewer   (risks, follow-ups, deliberate omissions)
```

**The verification section is where honesty is load-bearing.** Write only what you
actually ran. Get the truth from:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.mjs" --stage full --json
```

- `status: "pass"` → say it passed.
- `status: "fail"` → say it failed. Do not soften it.
- `status: "not-run"` → say NOT RUN, with the reason. Never upgrade this to a pass.
- The project has no such gate → "no test suite in this repo; verified manually by
  <steps>". Never omit the gap, and never tick a template checkbox that claims a
  suite which does not exist.

Writing "tests pass" where there are no tests is the single worst failure available to
this skill: the MR description is what a reviewer reads *instead of* the diff, so a
false claim there propagates further than anywhere else.

## Step 5 — Hand it over

- `git.cliAvailable: true` → offer to create the MR with `glab mr create` (or
  `gh pr create`), and **wait for explicit approval before running it**. When
  `git.selfHosted` is true, `glab` needs that host configured (`GITLAB_HOST`, or
  `glab auth login --hostname <host>`) — if it is not, say so rather than letting the
  command fail confusingly.
- `git.cliAvailable: false` → print the message and body in copyable blocks and say the
  CLI is not installed. This is the normal path, not a failure.

Never run `git commit`, `git push`, `glab mr create`, or `gh pr create` unless the
user asks for that specific action in the current turn. Producing the text is the job;
publishing it is their decision.

## What this must NOT do

- **Invent a ticket ID, issue number, or Jira key.** If the convention wants one and
  you cannot find it in the branch name, the commit history, or what the user told
  you, leave a clear `<TICKET>` placeholder and say you need it. A plausible-looking
  wrong ID is worse than a blank.
- **Claim any gate, test, or manual check passed when it did not run.** See step 4.
- **Commit, push, or open an MR without explicit approval in this turn.**
- **Impose a convention the repo does not use** because it is more standard.
- **Describe the branch name or the plan instead of the diff.** If the diff and the
  stated intent disagree, report the discrepancy — that gap is usually a real bug or
  forgotten work in progress.
- **Pad the body.** Short but informative. A body restating the subject is noise.
