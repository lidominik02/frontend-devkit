# 0004. Framework packs layer as deltas

Status: Accepted

## Context

Roughly half the guidance inverts between Vue and Nuxt. Module-scope reactive state is an
ordinary singleton in a client-only SPA and a cross-request data leak under SSR. Imports
are mandatory in one and auto-imported in the other. "There is no server, so nothing is
secret" is replaced by `runtimeConfig`'s public/private boundary.

Serving both from one pack means hedging every one of those into an "if SSR then… else…"
sentence, which is precisely the wording that makes the model pick the wrong branch. A rule
that is correct for Vue and wrong for Nuxt is worse than no rule — it manufactures
confident, wrong output. Duplicated text drifts.

Each pack installs into its own directory, so no relative path reaches another pack.
Transitive dependency resolution is not observable from `claude plugin validate`, only at
enable time.

## Decision

- A specialised pack is a delta on its base: it carries only what its layer inverts or
  adds, names the base rules that do not apply there, and the base points back at it.
  Nothing is duplicated.
- A pack's base is its non-`core` dependency; `core` is the framework-agnostic floor and
  forms no family. Today that is `nuxt` → `vue` → `core`. `scripts/pack-graph.mjs` derives
  the shape from the manifests, so no pair is written down by hand.
- Every dependency is declared directly: `nuxt` names both `core` and `vue`.
- One pack refers to another by skill invocation (`/vue:vue-engineering`), never by path.
- `project-facts.mjs` reports the packs that serve a project as `stack.packs`, ordered
  general to specific; the later pack wins a conflict.

## Consequences

- A plain-Vue repository pays nothing for `nuxt`; enabling `nuxt` brings `vue` with it.
- The split is tested by a matched pair of ablation cases:
  `plugins/vue/evals/module-scope-state/` must call the code fine, and
  `plugins/nuxt/evals/ssr-shared-state/` must call the same code Critical.
- `/pack-parity` checks the contract for drift for every family the manifests declare.
- A new framework that only adds to an existing one is a reference file in that pack, not a
  new pack.
