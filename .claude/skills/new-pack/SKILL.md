---
name: new-pack
description: >-
  Scaffold a new framework pack in this marketplace and wire it into every place
  that must know about it — plugin.json with its dependencies, marketplace.json, the
  pack README and the root README's packs table, project-facts.mjs stack mapping,
  and a first eval case. Use when adding support for a framework the devkit does not
  cover yet, such as React or Next, or when splitting an existing pack. Establishes
  first whether the new guidance inverts an existing pack's rules, because a pack
  that only adds is a reference file in the wrong place.
disable-model-invocation: true
argument-hint: "[pack-name]"
allowed-tools: Read, Grep, Glob, Write, Edit, Bash(node scripts/validate.mjs:*), PowerShell(node scripts/validate.mjs:*), Bash(claude plugin validate:*), PowerShell(claude plugin validate:*)
---

# Add a framework pack

`project-facts.mjs` already returns `react-spa` and `next` as stacks with empty
pack arrays: detected stacks with nothing behind them. That is the slot this fills.

## First, establish that it should be a pack

The devkit splits packs on **inversion, not on subject matter**. `vue` and `nuxt`
are separate because roughly half the guidance inverts between them, and a rule
correct for one and wrong for the other manufactures confident, wrong output —
worse than no rule. Hedging every rule into "if SSR then… else…" is precisely the
wording that makes a model pick the wrong branch.

So answer this before scaffolding anything:

- **Does the new framework invert rules an existing pack states?** If yes, it is a
  pack, and it layers on that one as `nuxt` layers on `vue`.
- **Does it only add?** Then it is a reference file in the existing pack, not a
  pack. Say so and stop.
- **Is it a peer with no overlap?** A pack depending on `core` alone.

Write the answer down in the new pack's `plugins/<name>/README.md` before writing the
pack. If a later reader cannot tell why the split exists, it will be merged back.

## What must be touched

Miss one of these and the pack loads wrong, or silently not at all.

| Place | What |
| --- | --- |
| `plugins/<name>/.claude-plugin/plugin.json` | `name`, `version` (the one the other packs share), `description`, `author`, `repository`, `keywords`, and `dependencies` naming **every** pack it needs, not just the nearest |
| `.claude-plugin/marketplace.json` | A `plugins[]` entry with `source: ./plugins/<name>` |
| `plugins/<name>/skills/<name>-engineering/SKILL.md` | The pack's one skill, plus `references/` |
| `plugins/<name>/README.md` | What the pack covers, what it depends on, why it is a separate pack, and its skill table — modelled on `plugins/nuxt/README.md` |
| `plugins/<name>/evals/` | A README pointing back at `plugins/core/evals/README.md`, and at least one case |
| `plugins/core/scripts/project-facts.mjs` | The `packsFor` mapping — the stack must resolve to its packs, general first |
| *(nothing)* | The layering itself. `scripts/pack-graph.mjs` derives it from `dependencies`, and `/pack-parity` reads it from there — declare the dependency correctly and both follow |
| `README.md` | The packs table and the install block |
| `docs/installation.md` | The install block and "Choosing packs" |

Declare dependencies **directly and transitively**. `nuxt` names both `core` and
`vue` rather than relying on `vue` to pull `core` in, because transitive resolution
is not observable from `claude plugin validate` — only at enable time.

CI derives its validation targets from `marketplace.json`, so the workflow needs no
edit. Confirm that by reading the `Validate marketplace and plugins` step rather
than assuming it.

## The version gate

Both existing packs carry a `references/versions.md`. A pack whose guidance is not
tied to versions rots silently and states framework behaviour as timeless fact.
Write the version table before the guidance, not after.

## Before you finish

- `node scripts/validate.mjs` — a new listed description always adds to the always-on
  total; the `budget` check fails past `budget.ceiling` in `devkit.config.json`. Raise the
  ceiling only with the user's approval. `docs-links` catches a link the new README gets
  wrong.
- `node scripts/pack-graph.mjs` — confirm the new pack appears with the base you intended.
  A pack that reports no base when it should have one has its dependency wrong, and
  `/pack-parity` will silently never check it.
- `claude plugin validate ./plugins/<name> --strict` — expect a clean exit. Give the
  new pack's `plugin.json` the same `version` the other packs carry; the `versions`
  check fails otherwise.
- Report the new always-on cost as a number and say what it was before. A pack adds
  a listed description to every session of every repository that enables it.
