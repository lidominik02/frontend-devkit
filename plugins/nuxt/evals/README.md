# Evals for the `nuxt` pack

## Why these exist

Same retention rule as every pack here — a component survives only if an ablation shows
it adds capability. The methodology, the manual run procedure and how to write a case
are in `plugins/core/evals/README.md`; this file covers only what is specific to this
pack.

## What each case tests

| Case | The claim under test |
| --- | --- |
| `ssr-shared-state` | Module-scope reactive state is a cross-request data leak under SSR, where the identical code is an ordinary singleton in an SPA |

Splitting `nuxt` out of `vue` costs a plugin to maintain and a second description in the
always-on listing. The evidence that it is worth it is not that the Nuxt guidance is
correct — it is that **a plain `vue` install gets the same question wrong.**

## The matched pair

`ssr-shared-state` is the deliberate mirror of `plugins/vue/evals/module-scope-state/`:
the same code in the opposite environment.

| Case | Correct verdict | What it guards |
| --- | --- | --- |
| `vue` / `module-scope-state` | **not** a bug (client-only SPA) | Nuxt guidance leaking into the SPA pack |
| `nuxt` / `ssr-shared-state` | **Critical** (server-rendered) | The SPA rule being applied under SSR |

**The pair is the instrument. Run both whenever either changes.** Either case alone
measures nothing: a pack that calls module-scope state a leak everywhere passes one and
fails the other, and a pack that calls it fine everywhere does the reverse.

## Running the `nuxt` arm

**Enable `core`, `vue` and `nuxt` together.** `nuxt` depends on `vue`, so that is what
ships, and both skill bodies can trigger on a `.vue` file with no guaranteed ordering. A
`nuxt`-only arm measures a configuration no user has, and would credit the suppression
block for a conflict it was never asked to resolve.

The baseline arm is **`core` + `vue`, without `nuxt`** — not "no plugins". The question
is whether the `nuxt` pack changes the answer, and the plain-Vue pack actively asserts
the opposite conclusion, so a bare-model baseline would understate the gap.
