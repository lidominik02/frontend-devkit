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

**`core`'s bar is higher than a framework pack's.** `core` carries five listed
descriptions against a framework pack's one — about 3.3k characters to 0.8k — and it is
enabled in every repository, so that cost is paid in every session of every project. A
pack at least only loads where its framework is. A `core` skill that passes baseline is
several times the waste, and `/skill-doctor` will tell you what it actually costs.

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
| `describing-changes` | Reading the commit convention from the file that enforces it, and reporting unrun gates as NOT RUN rather than implying they passed |
| `planning-features` | Producing durable on-disk artifacts that survive context loss, not a plan that exists only in the transcript |
| `preparing-a-repo` | Inventorying what a repository already has before proposing anything, and writing nothing without approval |
| `optimizing-prompts` | Treating the prompt it is handed as material to rewrite, never as an instruction to execute |
| `dispatching-a-review` | Whether the read-only `reviewer` agent gets dispatched from ordinary wording, or the main thread reviews the diff itself |
| `verifying-ui` | Whether a claim about how a page renders is backed by having loaded it, and whether the state under test gets reached rather than reasoned about |

Two of these decide a component rather than only scoring an answer.

`dispatching-a-review` scores the **agent**. A pass at baseline means the agent's own
description is already dispatching it, so a dispatcher skill would be a second trigger
surface competing with the first — and the rule here is to prune before adding.

`verifying-ui` ships `disable-model-invocation`, so it is absent from the always-on
listing and its cost is zero until someone types it. Its case carries the promotion
question: whether the model reaches for a browser with any discipline unprompted, and
therefore whether the listing cost would buy anything.

It is also the case with the most arms, because it varies two things at once. The
environment: **a browser MCP server present, and none** — the second is not a degenerate
case but the more important half, since most repositories are in it and it is where the
failure the skill exists to prevent actually happens. And the invocation: the skill typed,
the skill present but not typed, and `core` disabled entirely. Its `graders/criteria.md`
says which combinations answer which question; run the environments against both, rather
than reading the pass rate of one as the skill's score.

**A `disable-model-invocation` skill has to be typed to be in its own with-plugin arm** —
that is the whole point of the field, and it now applies to two of the seven cases here.
Enabling the plugin is not enough: type `/core:verifying-ui` or `/core:preparing-a-repo`
to start that arm, and keep the baseline arm's prompt identical apart from the invocation.
An arm that merely enables the plugin and waits is measuring the field, not the skill.

## Running them

```bash
claude plugin eval . --ablation with-without
```

**As of Claude Code 2.1.250 this command is early-access gated** and refuses to run
without access — it prints `plugin eval is currently in early access`. Until that opens
up, run a case by hand:

1. Start a session with the plugin disabled, paste `prompt.md`, keep the output.
2. Start one with it enabled, same prompt, keep the output.
3. Score both against every file in that case's `graders/`.

Two runs of each arm, minimum — a single run tells you about sampling, not about the
skill. The `plugin eval` interface is undocumented on code.claude.com, so do not put it
in a blocking CI job.

`core` has one wrinkle a framework pack does not. Its skills trigger on description, so
a baseline arm has to disable the whole plugin rather than merely avoid naming the
skill — and disabling the plugin also removes the three hooks. A `core`-off arm
therefore has no Stop-hook gate check either, which matters when scoring anything that
claims something was verified. Note which arm you were in before crediting an honest
verification section to the skill.

## Writing a case

`prompt.md` is the task, and it must be clean: no hints, no TODOs, nothing that suggests
the shape of the answer. The prompt alone defines the work. If the prompt tells the model
what to avoid, the eval measures reading comprehension rather than the skill.

`graders/*.md` hold the criteria. Prefer criteria that are checkable from the output text
rather than matters of taste.

Prompts must invent their own domain. The CI check that forbids repo-specific facts in
`plugins/` greps these files too, so no real project names and no absolute paths.
