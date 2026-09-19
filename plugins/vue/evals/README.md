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
| `focus-and-announcement` | Whether accessibility rules get applied on a task that never asks for them — focus after a removal, a live region for a count that changes, names that distinguish one control from another |
| `submit-state` | Whether a form is modelled as state that can be submitted twice and rejected by the server, rather than as values plus a validate function |
| `finding-the-cost` | Whether a performance claim is backed by a measurement, or assembled from plausible causes read off the source |

`composable-reactivity` and `vite-secret` are capability cases: the pack earns its place
only if the baseline arm gets them wrong. `module-scope-state` is expected to pass at
baseline and is kept for a different reason.

`focus-and-announcement`, `submit-state` and `finding-the-cost` each decide whether a
reference file is worth adding to this pack. **All three came back with no criterion line
missed in any of three runs, so there is no `accessibility.md`, no `forms.md` and no
`performance.md`** — a plain `core` + `vue` session already does these things unaided.

They are kept for the reason `module-scope-state` is kept, as a regression instrument. A
case is cheaper to run than its question is to re-argue, so a proposal to add one of these
files is answered by running the case rather than by debating the file.

`finding-the-cost` needs a second baseline arm, `core` alone. `references/routing.md` in
this pack supplies the lazy-route and entry-chunk answers in prose, so a `core` + `vue`
baseline can produce them without knowing anything. If `core` alone passes where the pair
fails, the pack is manufacturing the failure and the finding is a wording fix there rather
than a new reference file.

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
