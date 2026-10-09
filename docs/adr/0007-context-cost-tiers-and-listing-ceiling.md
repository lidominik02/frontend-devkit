# 0007. Three tiers of context cost, and a ceiling on the always-on listing

Status: Accepted

## Context

A component's description is loaded in every session of every repository that enables its
pack, whether or not the component is used. Its body loads only when it is triggered, and a
reference file only when the body points at it. `core` is enabled everywhere, so its listed
descriptions cost the most.

A skill marked `disable-model-invocation` leaves the always-on listing — and with it, the
model's view of the skill: it can then only run when someone types it.

## Decision

- Each kind of content goes in the cheapest tier that still works: the trigger in the
  description, guardrails and ordering in the body, lookup material in a reference.
- The always-on descriptions of all shipped packs together stay under a ceiling, set in
  `devkit.config.json` ([0012](0012-tooling-values-in-config-not-prose.md)) and checked by
  the `budget` check and a write hook.
- A skill is typed-only (`disable-model-invocation: true`) when firing on its own would do
  harm or collide with another component: `preparing-a-repo` changes a host repository's
  configuration; `optimizing-prompts` must never act on the text it is handed, and a
  repository with its own prompt-rewriting skill would otherwise have two matching the same
  wording; `designing-architecture` would drive unasked redesigns — noticing a candidate
  during ordinary work belongs to its `codebase-design.md` reference, which flags and never
  restructures. Otherwise it is listed, and its description earns its share of the ceiling.

## Consequences

- Adding a listed component, or lengthening a description, competes for a fixed budget;
  raising the ceiling is a deliberate decision, not a side effect.
- A repository that enables only the pack for its framework pays only for that pack.
- Which components earn auto-triggering is decided by measurement: `/skill-doctor` for the
  listing cost, and the ablation cases in `plugins/*/evals/` for the effect.
