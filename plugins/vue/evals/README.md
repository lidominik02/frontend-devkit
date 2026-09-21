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
| `binding-composition-spread` | Extending a shared binding for one consumer via a spread-and-override rather than folding the new condition into the shared source (which leaks it to every other consumer) |
| `vitest-jsdom-import-meta-url` | `import.meta.url` under Vitest + jsdom resolves to a virtual dev-server URL, not a `file://` path — and that it is not the well-known jsdom `URL`-shadowing bug |

Both were run by hand with `claude -p`, not the automated harness — see
`plugins/core/evals/README.md` for why. Five other candidates from the same research
pass — a shared per-instance loading flag beating a boolean under overlapping requests,
`cn()`/tailwind-merge's last-argument-wins override order, re-subscribing to a
DOM mutation made outside Vue's reactivity, a mock handler's generic losing its
connection to the response schema, and a named Tailwind group requiring its literal
marker class on the right ancestor — were tested the same way and dropped: a bare
Sonnet 5 already answered every one of them correctly. A sixth, whether
`@storybook/vue3`'s `render` needs to return a function or a bare VNode to dodge
`vue/one-component-per-file`, was dropped because both arms converged on the same
(bare-VNode) fix, which resolves the reported lint error either way. A seventh — that
TanStack Query v5's `MutationFunction` type requires a `context` second parameter —
is real (verified against `@tanstack/query-core`'s own shipped `.d.ts`, checked at
5.90.19) but was dropped anyway: both a plain reference note and a version citing the
exact verified type still lost to the model's own confident, wrong prior in every run,
so the content was not earning its cost. Recorded here rather than silently forgotten,
in case a future run — or a differently-worded note — closes it.

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

`finding-the-cost`'s second baseline arm has now been run, and it clears the pack of the
suspicion it was written to test. The worry was that `references/routing.md` supplies the
lazy-route and entry-chunk answers in prose, so a `core` + `vue` baseline could produce them
without knowing anything. **`core` alone does it too** — three runs, each of which ran the
project's own build unprompted, read the 372 kB entry chunk against the 0.2 kB lazy routes
off the chunk table, and named `chart.js/auto` and `luxon` at the entry. The pack is not
manufacturing the failure, because there is no failure to manufacture: measuring before
ranking is already the floor behaviour.

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
