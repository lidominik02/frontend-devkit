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

**`core`'s bar is higher than a framework pack's.** `core` is enabled in every
repository, so its listing cost is paid in every session of every project — roughly
1,300 tokens against a framework pack's ~260. A pack at least only loads where its
framework is. A `core` skill that passes baseline is five times the waste.

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
