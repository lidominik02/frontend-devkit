# Evals for the `vue` pack

## Why these exist

Same retention rule as every pack here — a component survives only if an ablation shows
it adds capability. The methodology, the manual run procedure and how to write a case
are in `plugins/core/evals/README.md`; this file covers only what is specific to this
pack.

## What each case tests

| Case | The claim under test |
| --- | --- |
| `composable-reactivity` | Crossing a composable boundary with a getter rather than a value, so the result keeps tracking when the input changes |
| `vite-secret` | Recognising that a static SPA has nowhere to keep a secret, and that a `VITE_`-prefixed value is inlined into the shipped bundle |
| `module-scope-state` | A negative test: module-scope reactive state is an ordinary singleton in a client-only SPA, not a cross-request leak |

`composable-reactivity` and `vite-secret` are capability cases: the pack earns its place
only if the baseline arm gets them wrong. `module-scope-state` is expected to pass at
baseline and is kept for a different reason.

## The matched pair

`module-scope-state` guards against Nuxt guidance leaking into this pack, which is a
different question from whether the pack adds capability. Its mirror is
`plugins/nuxt/evals/ssr-shared-state/`: the same code in the opposite environment.

| Case | Correct verdict | What it guards |
| --- | --- | --- |
| `vue` / `module-scope-state` | **not** a bug (client-only SPA) | Nuxt guidance leaking into the SPA pack |
| `nuxt` / `ssr-shared-state` | **Critical** (server-rendered) | The SPA rule being applied under SSR |

**The pair is the instrument. Run both whenever either changes.** Either case alone
measures nothing: a pack that calls module-scope state a leak everywhere passes one and
fails the other, and a pack that calls it fine everywhere does the reverse.

## Running the `vue` arm

**Enable `core` and `vue`, with `nuxt` disabled.** `nuxt` depends on `vue`, so enabling
it ships both, and both skill bodies can trigger on the same `.vue` or `composables/`
path with no guaranteed ordering. That contaminates `module-scope-state` in particular,
whose correct answer is the exact inverse of the `nuxt` pack's rule.

The baseline arm is **`core` alone**, not "no plugins". `core` is enabled in every
repository anyway, so it is part of the floor this pack is measured against rather than
part of what is being measured.
