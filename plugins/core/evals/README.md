# Evals for the `core` pack

## Why these exist

A skill costs context in every session whether or not it changes an outcome. The only
way to know which rules earn that cost is to run the same task twice — once with the
plugin, once without — and compare. The retention rule, borrowed from `vuejs-ai/skills`:

| Baseline (no plugin) | With plugin | Verdict |
| --- | --- | --- |
| fails | passes | **keep** — the rule adds capability |
| passes | passes | **remove** — the model already knew |
| fails | fails | rewrite, or accept it is out of reach |

**`core`'s bar is higher than a framework pack's.** `core` carries most of the listed
descriptions — a framework pack carries one — and it is enabled in every repository, so
that cost is paid in every session of every project. A pack at least only loads where its
framework is. A `core` skill that passes baseline is several times the waste, and
`/skill-doctor` will tell you what it actually costs.

Cases fall into two kinds. **Capability**: the model cannot solve it unaided — a
distinction it does not draw, an ordering it does not follow, a guardrail it does not
hold under pressure; in a framework pack, version-specific behaviour or anything past
the training cutoff. **Efficiency**: it can, but not well. Only capability rules are
worth paying for at this altitude.

The rest of this file is the methodology for every pack in this repo. The framework
packs' eval READMEs cover only what is specific to them and point back here.

## What each case tests

| Case | The claim under test |
| --- | --- |
| `investigating-bugs` | Diagnosing to a root cause without editing, and checking the layer that owns the data before the component that renders it |
| `fixing-bugs` | Whether a fix from a diagnosis is proven — the test red before it, green after, red with the fix taken out and green once it is back, only that test file run, the fix left in place — and whether a root cause in the API leaves the API's code and the frontend untouched and hands the owner a report |
| `syncing-branches` | Whether bringing a branch up to date loses nothing from either side — both changes to a function kept, the lockfile regenerated rather than merged, a duplicate helper raised with the user before it is touched, the branch rewritten only with a way back, nothing pushed |
| `describing-changes` | Reading the commit convention from the file that enforces it, and reporting unrun gates as NOT RUN rather than implying they passed |
| `shaping-commits` | Offering genuine alternatives on request, and basing the one-commit-or-several call on whether an intermediate commit would still build rather than splitting mechanically by file |
| `commit-message-audience` | Whether the message describes the change for a colleague, or leaks the planning-artifact context (a session, a handoff, a phase, a roadmap) it was drafted alongside — even when paraphrased around the literal banned words |
| `describing-changes-trigger` | Whether the `Skill` tool actually fires on the user's own informal register, not only whether the description matches it in isolation |
| `planning-from-spec` | Whether `PLAN.md` is built from `SPEC.md` — named vertical-slice tasks, the Global Constraints verbatim, every success criterion and Review Focus entry owned by a task, decisions not code, no commit step, only the fast gates in Done when — and whether an owned open question blocks only its task instead of the plan |
| `planning-default-rules` | Whether planning records the default rules on disk — in `HANDOFF.md` — when the user sets none, and whether the rules it states are the current set rather than a retired one |
| `checkpoint-kickoff` | Whether `checkpoint` mode has somewhere durable to put ad-hoc work with no plan, stays honest about what is verified, and ends with a paste-ready kickoff prompt |
| `designing-architecture` | Whether `designing-architecture` with no decision to make stops after a short list of what is worth restructuring, changes no code, and recommends no abstraction with a single consumer — while still naming a rule copied into three files that change together |
| `clarifying-rule-rationale` | Whether `clarifying-features` keeps a business rule's reason beside it in `SPEC.md`, and asks for the reason of a rule given without one instead of inventing it |
| `clarifying-conflicting-sources` | Whether conflicting sources become a question whose recommendation follows authority — a confirmed rule over the story over the design, a derived document never over its source — recorded as a decision naming the losing source |
| `clarifying-frontier` | Whether work with no story is clarified facts first — the classification with its reasons, a user's claim about the code checked, a rule's reason asked, forms with the recommended option first, no question the repository answers, nothing built — and whether a small change takes the in-chat design route instead |
| `executing-pause` | Whether subagent-per-task execution builds task 1 through an implementer, reviews it, and stops at the pause before task 2, without touching the git index |
| `preparing-a-repo` | Inventorying what a repository already has before proposing anything, and writing nothing without approval |
| `optimizing-prompts` | Treating the prompt it is handed as material to rewrite, never as an instruction to execute, and specifying the rewrite enough to act on |
| `anchoring-a-rewrite` | Whether an agentic rewrite points at a file that already does the thing, or paraphrases the convention — and whether it invents the path when it has none |
| `reviewing-changes-trigger` | Whether ordinary pre-merge wording starts `reviewing-changes`, and whether the review stays in `core:reviewer` workers — the right base, a verify pass, gates reported or NOT RUN, a report file, nothing edited — rather than in the main thread |
| `review-uncommitted-scope` | Whether the reviewed diff covers the branch's commits, the uncommitted edit and the untracked file, and leaves out commits already on the remote base and `temp/` |
| `review-spec-axis` | Whether the spec axis reports a named state the code lacks, leaves an EXTRA criterion alone and flags a behaviour no source asks for — and says it is NOT RUN when there is no spec, rather than inventing intent |
| `verifying-ui` | Whether a claim about how a page renders is backed by having loaded it, and whether the state under test gets reached rather than reasoned about |
| `qa-test-list` | Whether `plan` mode produces acceptance criteria mapped to positive/negative/edge cases naming a verifying check, or a flat list of things to click |
| `qa-list-without-a-spec` | Whether, with no spec and no written requirement, `plan` derives criteria from the plan's task and the diff and discloses the weaker source, rather than inventing a story to look ordinary |
| `design-intent-skip` | Whether `run` reports the design-intent cases as skipped, by name, with the reason, when no design reference is reachable — never a silent pass |
| `storybook-skip` | The same skip discipline for the Storybook cases, when no Storybook script exists |
| `finishing-features` | Whether closing out a feature surfaces what is left and asks whether the user is done before acting, commits only an accepted message, warns that the branch is behind before the MR text, reminds every open item including a backup branch, moves the feature's files aside rather than deleting them, recommends archiving now when only the push and the merge request are left, and pushes nothing |
| `finishing-held-archive` | Whether closing out a feature whose hand-over still lists work past the push — a task blocked on an open question, a check that can run only after the merge — recommends archiving later, leaves the folder under `temp/`, tells the user what is left, records the held archive in the ledger with each item left, and points the handoff at that work |
| `resume-reopen` | Whether resuming a feature by name that a close-out archived finds it under `temp/archive/`, asks before moving anything, moves it back under `temp/` rather than copying it, records the return in the ledger with where it came from, and leaves the handoff as it was |

Two of these decide a component rather than only scoring an answer.

`reviewing-changes-trigger` decides the **`reviewing-changes` description and the chain behind
it**. `reviewing-changes` is what dispatches the reviewer — the `reviewer` agent's own
description says it is not for direct use — so the untyped prompt asks two things: whether
the description fires on the words a user types before a merge request, and whether the
review then stays in `core:reviewer` workers. A with-plugin run that reviews in the main
thread says which half to change, depending on whether the skill fired.

`verifying-ui` is listed, as a trial: its description is in the always-on listing and it
can fire unprompted, so its hold on verification is the body's first instruction. Its case
carries the trial's question — in the arm where the skill is present but not typed, whether
it fires on the wording, holds until released, and looks with more discipline than the arm
with `core` disabled — and therefore whether the listing cost buys anything, or
`disable-model-invocation` goes back.

It is also the case with the most arms, because it varies two things at once. The
environment: **a browser MCP server present, and none** — the second is not a degenerate
case but the more important half, since most repositories are in it and it is where the
failure the skill exists to prevent actually happens. And the invocation: the skill typed,
the skill present but not typed, and `core` disabled entirely. Its `graders/criteria.md`
says which combinations answer which question; run the environments against both, rather
than reading the pass rate of one as the skill's score.

**A `disable-model-invocation` skill has to be typed to be in its own with-plugin arm** —
that is the whole point of the field, and it applies to the cases of the typed skills
here. Enabling the plugin is not enough: type `/core:preparing-a-repo`,
`/core:designing-architecture` or `/core:optimizing-prompts` — the last covers two cases —
to start that arm, and keep the baseline arm's prompt identical apart from the invocation.
An arm that merely enables the plugin and waits is measuring the field, not the skill.

## Running them

```bash
claude plugin eval . --ablation with-without
```

**The harness runs, and every case in every pack needs frontmatter before it will load.**
Checked against 2.1.278: both files take a YAML header, and without one the case is rejected
with `invalid case.yaml: graders: Required`. `claude plugin eval init --bare <name>` prints
the canonical shape — `max_turns` and `allowed_tools` on `prompt.md`, `type` and `weight` on
each grader. Every case in `core`, `vue` and `nuxt` carries it; a new case needs it too, and
the harness is the fastest way to find out that it does not.

**The harness writes into the plugin it evaluated.** Each run leaves a timestamped directory
and an HTML report under `<plugin>/evals/results/`. That path is gitignored — it is a run
record, not a marketplace file — so do not add one to a commit.

**The harness cannot resolve a marketplace dependency inside its own sandbox, checked
against 2.1.278.** Running `claude plugin eval vue@frontend-devkit` or
`nuxt@frontend-devkit` fails with `dependency-unsatisfied: Dependency "core" is not
installed`, even with `core` installed and enabled — the sandbox's dependency check
cannot see it, and the with-plugin arm silently loads no plugin at all, so the
comparison measures nothing. `vue` and `nuxt` cases cannot be run through the automated
harness until this is fixed upstream. The fallback is a manual `claude -p` pair: once
bare, once with `--plugin-dir` pointing at `core`, `vue` and (for a `nuxt` case) `nuxt`
directly from the working tree, disabling the persistently-installed copies for the
run so nothing loads twice. Grade each pair against the case's own `graders/criteria.md`
by hand.

**A typed skill needs its invocation inside `prompt.md`.** The harness runs one prompt in
both arms, so a skill carrying `disable-model-invocation` — which cannot fire on
description — would otherwise have no with-plugin arm at all. Putting
`/core:optimizing-prompts` in the prompt resolves it in the with-plugin arm and leaves it as
inert text in the baseline, which is the comparison the case wants.

**What the harness cannot do is score per criterion line.** It treats each grader file as
one weighted verdict, and several cases here end by telling the scorer which lines
discriminate and which are expected to pass at baseline. Splitting a criteria file into one
grader per line buys that back; until a case is split, score it by hand and say so. A number
from a collapsed grader is a number about the whole file, not about the rule under test.

**A skill that asks before it answers cannot be scored by this harness at all.**
`optimizing-prompts` opens by asking clarifying questions, and a harness run has nobody to
answer them: the with-plugin arm ends at the questions and fails for want of a deliverable,
while the baseline skips the asking and fails on something the collapsed grader does not
name. Both arms score zero and the delta is an artifact. Those two cases stay hand-run until
their criteria score the questions rather than the rewrite.

Two runs of each arm, minimum — a single run tells you about sampling, not about the skill.
The interface is undocumented on code.claude.com, so do not put it in a blocking CI job.

**Assert the rig before reading any behaviour out of a run.** Running an arm by hand with
`claude -p` rather than through the harness is the way to score per criterion line, and it
has three ways to look healthy while measuring the wrong thing:

- **Load the working tree with `--plugin-dir`, then check it took.** The init event must
  carry `core@inline` for a with-plugin arm. An installed copy of this marketplace can be
  months stale, and a run that reaches it reports the old skill's behaviour as the new one's.
  Grep each transcript for `plugins/cache` and treat a hit as a void run.
- **Put the slash invocation on line 1, and grant `Skill`.** A case's `prompt.md` opens with
  YAML frontmatter, so a runner has to strip it *and* the blank lines behind it — anything
  ahead of `/core:<skill>` leaves it as inert text. Under `--permission-prompts none` an
  ungranted `Skill` call is denied outright, and a model that cannot invoke a skill carries
  on without it: check the `Skill` tool result before reading anything else out of the run,
  because a denial there voids it without looking like a failure.
- **Give both arms the same MCP configuration.** Pass `--strict-mcp-config` in every arm,
  with an empty `{"mcpServers":{}}` where the server under test is absent. Otherwise the
  arms differ by every connector configured on the machine, not only by the variable.

**A hand-run case carries its own environment and its own answers.** A case that needs a
real repository, or whose component asks through forms — `clarifying-features`' rounds,
`planning-features`' approval, `executing-plans`' pause — is hand-run, or scored only up to
and including its first form. Its `criteria.md` holds a **Fixture** section, which the
runner builds in a fresh directory before each run and checks with the rig commands it
lists, and a **Scripted answers** section: the option to pick for each form, in order, and
where to end the session. Run a case with scripted answers interactively (`claude`, not
`-p`) so each form can be answered; `claude --help` on 2.1.283 marks neither `--plugin-dir`
nor `--strict-mcp-config` as print-only. Pass the prompt's `allowed_tools` as
`--allowedTools` and approve no other tool mid-run. A hand-run is graded per criterion line
against those two sections, and a run whose rig check failed is void, not a fail.

**User-level instructions reach both arms unless the run keeps them out.**
`~/.claude/CLAUDE.md` and `~/.claude/rules/` load with or without the plugin, so a
baseline can pass a line because the runner's own instructions state it. Observed on
2.1.283: `--bare` skips CLAUDE.md auto-discovery and hooks but still loads every installed
plugin — it is not a no-plugin arm, so the installed copies are still disabled for the run
— and under a subscription login a `--bare` run fails with `api_error`, `apiKeySource` none.
`claude --help` on 2.1.283 names `ANTHROPIC_API_KEY`, or an `apiKeyHelper` passed with
`--settings`, as the only Anthropic auth under `--bare`; the second route is unobserved.
"An API key", here and in each case's criteria, means either. A hand-run therefore isolates
user-level instructions only by running every arm with `--bare` and an API key, which also
turns the `core` hooks off in every arm: score a line that depends on a hook N/A. Where
that is unavailable, a case that user-level instructions could contaminate names the lines
whose content a runner's instructions may already state, and on such a machine those lines
are non-discriminating rather than evidence for retention. The rig check records which
applied.

**A case that has the model write or diagnose a project gets a fresh, empty directory per
run, and never this repository.** Anything a previous run left behind is a worked answer to
the same task lying in the workspace, and the next run reads it instead of solving it;
running inside `frontend-devkit` is the same problem with the pack's own prose as the
answer. `node_modules` is the only thing safe to share between runs. Give the scratch
project an explicit `target` and `lib` in `tsconfig.json` and a test runner, so a run spends
its attention on the task rather than on a broken toolchain, and so "did not verify" is a
choice the criteria can score rather than something the environment decided.

`core` has one wrinkle a framework pack does not. Its skills trigger on description, so
a baseline arm has to disable the whole plugin rather than merely avoid naming the
skill — and disabling the plugin also removes the four hooks. A `core`-off arm
therefore has no Stop-hook gate check either, which matters when scoring anything that
claims something was verified. Note which arm you were in before crediting an honest
verification section to the skill.

## Writing a case

`prompt.md` is the task, and it must be clean: no hints, no TODOs, nothing that suggests
the shape of the answer. The prompt alone defines the work. If the prompt tells the model
what to avoid, the eval measures reading comprehension rather than the skill.

`graders/*.md` hold the criteria. Prefer criteria that are checkable from the output text
rather than matters of taste.

**Write each criterion as an outcome, not as an implementation.** A line naming the
mechanism it expects fails a solution that reaches the same outcome by another, and the
tally then argues for guidance the model did not need.

**Score per criterion line, not per run**, when a case is deciding whether to write
something rather than grading one answer. The unit of retention is the rule: a topic whose
baseline misses one line every time and gets the rest right earns guidance covering that
line and nothing else.

Prompts must invent their own domain. A prompt written in the skill's own vocabulary
tests whether the model can pattern-match, not whether the skill changed an outcome.
