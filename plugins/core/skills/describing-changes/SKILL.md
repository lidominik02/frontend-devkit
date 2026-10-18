---
name: describing-changes
description: >-
  Writes a commit message or a merge request description for the current changes in
  this repository's own convention, not a generic one. Use whenever the user says
  "write the commit message", "commit message for this", "what should I call this
  commit", "MR description", "PR description", "describe these changes", or asks for a
  changelog entry — even without naming the convention, on GitLab or GitHub. For
  "review this" or "is this safe to merge", use reviewing-changes.
allowed-tools: Bash(git log *) Bash(git diff *) Bash(git status *) Bash(git remote *) Read Grep Glob
effort: low
---

You turn a diff into the two artifacts a reviewer reads: a commit message and a merge
request description. Both are written to *this* repository's convention, which is data
you look up — never a house style you assume.

## Step 1 — Read the repository's convention

- **Commit convention**: Glob for `commitlint.config.*` and `.commitlintrc*`, and read
  `package.json` for a `commitlint` key. A config that exists *is* the convention: read it
  — it defines the allowed types and scopes, the subject case and the length limit. A
  summary of it would be a second copy that can drift; the config cannot.
- **Git host**: `git remote -v` — GitLab or GitHub, which names the MR or PR.
- **Templates**: Glob for `.gitlab/merge_request_templates/*.md`,
  `.github/PULL_REQUEST_TEMPLATE*` and `.github/pull_request_template*`.
- **Base branch**: by "Base branch" in `../planning-features/references/project.md`.

With no commitlint config, **derive the convention instead of assuming it**:

```
git log --no-merges -n 30 --pretty=format:%s
```

Then say what you inferred and from what — "the last 30 subjects are all
`type(scope): subject`, so I'm following Conventional Commits" — so a wrong inference is
visible. Default only as a last resort: Conventional Commits with a short body.

## Step 2 — Read the actual change

```
git diff <base>...HEAD          # or: git diff --staged / git diff HEAD
git diff <base>...HEAD --stat
```

Describe what the diff *does*, not what the branch is called: a `fix/login` branch whose
diff also adds a rate limiter needs both facts. Where the diff and the stated intent or plan
disagree, report it alongside the message — usually a real bug or forgotten work.

## Step 3 — Write the commit message

Under Conventional Commits, the default here:

```
type(scope): imperative subject under ~72 chars

Body: what changed and WHY, wrapped at ~72. Short but informative —
enough that someone reading `git log` in six months understands the
reason without opening the diff.
```

- Subject in the imperative — "add", not "added". The body explains the *why*.
- **Omit the body for a genuinely trivial commit**; one restating the subject is worse.
- Note breaking changes explicitly (`!` after the scope, or a `BREAKING CHANGE:` footer).
- Match the repository's real types. If its history only ever uses
  `feat|fix|chore|refactor`, do not introduce `perf` because the spec allows it.

**Asked for alternatives, or the diff could plausibly be one commit or several?**
Read `references/shaping-commits.md` before writing anything — it has the default shape
for alternatives and the questions that settle the split.

## Step 4 — Write the MR/PR description

If a template exists, **read it and fill its actual sections.** Do not substitute your
own structure — the template is what reviewers expect, and its checklist often names the
exact commands the project wants run. Otherwise:

```
## What changed
## Why
## How to verify
## Notes for the reviewer   (risks, follow-ups, deliberate omissions)
```

**The verification section is where honesty is load-bearing.** Write only what you
actually ran. When the skill that called this one supplies gate results, they are the
truth: use them as given, run no gate, and report a gate they leave out as NOT RUN.
Otherwise run the gates as "Gates" in `../planning-features/references/project.md`
describes: the fast gates, and a held check (`## Held checks` there) only once the user has
released it.

- `pass` → say it passed.
- `FAIL` → say it failed. Do not soften it.
- `NOT RUN (<reason>)` → say NOT RUN, with the reason — a held check reads "held until the
  user releases it". Never upgrade this to a pass.
- The project has no such gate → "no test suite in this repo; verified manually by
  <steps>". Never omit the gap, and never tick a template checkbox that claims a
  suite which does not exist.

Writing "tests pass" where there are no tests is the single worst failure available to
this skill: the MR description is what a reviewer reads *instead of* the diff, so a
false claim there propagates further than anywhere else.

## Step 5 — Hand it over

Print the message and the description in copyable blocks, then stop. **Commit only once
this exact message has been accepted** — not a paraphrase of it, not "looks fine" applied
to an earlier draft. If the user asks for a change, apply it and show the result again.

Never run `git commit` or `git push`, or open the MR or PR, unless the user asks for that
action in the current turn. Producing the text is the job; publishing it is theirs.

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
