---
name: describing-changes
description: >-
  Writes a commit message or a merge request description for the current changes in
  this repository's own convention, not a generic one. Use whenever the user says
  "write the commit message", "commit message for this", "what should I call this
  commit", "MR description", "PR description", "describe these changes", or asks for a
  changelog entry — even without naming the convention, on GitLab or GitHub. For
  "review this" or "is this safe to merge", use reviewing-changes.
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/project-facts.mjs) Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.mjs *) Bash(git log *) Bash(git diff *) Bash(git status *) Read Grep Glob
---

You turn a diff into the two artifacts a reviewer reads: a commit message and a merge
request description. Both are written to *this* repository's convention, which is data
you look up — never a house style you assume.

**Both are written for another developer, not for the person who asked for them.** Never
name anything that exists only between the two of you — a session, a handoff file, a
roadmap artifact, a phase, a decision id. A colleague reading `git log` or the merge
request has no access to any of that, so it reads as noise at best and as a private
detail leaked at worst. Every name in either one resolves from the repository alone, and
a decision's reason is stated in its own words rather than by pointing at the note that
recorded it. Say what the change does and why; that is the whole job.

## Step 1 — The facts, already loaded

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/project-facts.mjs"`

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
`fix/login` whose diff also adds a rate limiter needs both facts in the message. Where
the diff and the stated intent or plan disagree, report the discrepancy alongside the
message — that gap is usually a real bug or forgotten work in progress.

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
- **Omit the body for a genuinely trivial commit.** Short but informative means the body
  earns its place; a body that restates the subject is worse than no body.
- Note breaking changes explicitly (`!` after the scope, or a `BREAKING CHANGE:`
  footer).
- Match the repository's real types. If its history only ever uses
  `feat|fix|chore|refactor`, do not introduce `perf` because the spec allows it.

**Asked for alternatives, or the diff could plausibly be one commit or several?**
Read `references/shaping-commits.md` before writing anything — it has the default shape
for alternatives and the questions that settle the split.

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
actually ran. When the skill that called this one supplies gate results, they are the
truth: use them as given, run no gate, and report a gate they leave out as NOT RUN.
Otherwise get the truth from:

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

Produce the message, then stop. **Commit only once this exact message has been
accepted** — not a paraphrase of it, not "looks fine" applied to an earlier draft.
If the user asks for a change, apply it and show the result again before committing.

When the skill that called this one asks for the text only, print the message and body
in copyable blocks and stop: the offer below and every command in it are skipped.

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
- **Rewrite history — amend, squash, or fold a change into an earlier commit —
  unasked.** This skill describes the current diff; it does not restructure past
  commits. `references/shaping-commits.md`'s "one commit or several" question is about
  how to slice *uncommitted* work going forward, never about rewriting what already
  landed.
