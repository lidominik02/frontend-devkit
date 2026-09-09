# Evals for the `vue` pack

## Why these exist

A skill costs context in every session whether or not it changes an outcome. To know
which rules earn that cost, run the same task twice — once with the plugin, once without
— and compare:

| Baseline (no plugin) | With plugin | Verdict |
| --- | --- | --- |
| fails | passes | **keep** — the rule adds capability |
| passes | passes | **remove** — the model already knew |
| fails | fails | rewrite, or accept it is out of reach |

A rule survives only if it lets the model do something it could not do without it.
Anything that passes baseline is documentation the model already carries. This retention
rule and the taxonomy below follow `vuejs-ai/skills`.

Cases fall into two kinds. **Capability**: the model cannot solve it unaided —
version-specific behaviour, undocumented traps, anything past the training cutoff.
**Efficiency**: it can, but not well. Capability rules are the ones worth paying for;
keep efficiency rules few and short.

## Running them

```bash
claude plugin eval . --ablation with-without
```

As of Claude Code 2.1.250 this command is early-access gated and prints
`plugin eval is currently in early access` without access. Until then, run a case by
hand:

1. Start a session with the plugin disabled, paste `prompt.md`, keep the output.
2. Start one with it enabled, same prompt, keep the output.
3. Score both against every file in that case's `graders/`.

Use at least two runs per arm — a single run measures sampling, not the skill. The
`plugin eval` interface is undocumented on code.claude.com, so do not put it in a
blocking CI job.

## Writing a case

`prompt.md` is the task, and it must be clean: no hints, no TODOs, nothing that suggests
the shape of the answer. A prompt that tells the model what to avoid measures reading
comprehension rather than the skill.

`graders/*.md` hold the criteria. Prefer criteria checkable from the output text over
matters of taste.
