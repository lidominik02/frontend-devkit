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
| `vite-public-key` | A negative test, the mirror of `vite-secret`: a key its vendor's docs call public is wired into client config, not flagged as a leaked secret or held behind a backend |
| `auto-import-configured` | A negative test: a project whose `vite.config.ts` imports `unplugin-auto-import` and `unplugin-vue-components` has its missing `ref`, `computed` and component imports resolved by those plugins, not flagged as a build error or as imports to add |
| `module-scope-state` | A negative test: module-scope reactive state is an ordinary singleton in a client-only SPA, not a cross-request leak |
| `focus-and-announcement` | Whether accessibility rules get applied on a task that never asks for them — focus after a removal, a live region for a count that changes, names that distinguish one control from another |
| `submit-state` | Whether a form is modelled as state that can be submitted twice and rejected by the server, rather than as values plus a validate function |
| `finding-the-cost` | Whether a performance claim is backed by a measurement, or assembled from plausible causes read off the source |
| `binding-composition-spread` | Extending a shared binding for one consumer via a spread-and-override rather than folding the new condition into the shared source (which leaks it to every other consumer) |
| `vitest-jsdom-import-meta-url` | Under Vitest + jsdom, Vite rewrites the literal `new URL('…', import.meta.url)` into an `http:` URL resolved against jsdom's location while `import.meta.url` itself stays `file://` — and that it is not the well-known jsdom `URL`-shadowing bug |
| `watch-getter-deep` | A regression guard on the pack's own reactivity text: a getter watcher on an object misses nested changes and is fixed with `deep: true` or by watching the `reactive` object directly, which is deep implicitly — never by demanding `deep` on a `reactive` source |
| `per-environment-build` | A negative test: a new environment-specific `VITE_` URL, in a project whose pipeline builds once per environment on purpose, is not rated Critical or held behind runtime config |

`binding-composition-spread` and `vitest-jsdom-import-meta-url` were run by hand with
`claude -p`, not the automated harness — see `plugins/core/evals/README.md` for why.
Every case's latest run is recorded under "The 2026-10-14 run" or "The 2026-10-20
run" below. Five
other candidates from the same research pass — a shared per-instance loading flag
beating a boolean under overlapping requests, `cn()`/tailwind-merge's last-argument-wins
override order, re-subscribing to a DOM mutation made outside Vue's reactivity, a mock
handler's generic losing its connection to the response schema, and a named Tailwind
group requiring its literal marker class on the right ancestor — were tested the same way
and dropped: a bare Sonnet 5 already answered every one of them correctly. A sixth, whether
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
only if the baseline arm gets them wrong. `module-scope-state`, `vite-public-key`,
`auto-import-configured`, `watch-getter-deep` and `per-environment-build` are expected to
pass at baseline and are kept for a different reason, as regression guards: each fails if
the pack applies a rule where it does not hold. `vitest-jsdom-import-meta-url` is a
regression guard too: it fails if the pack says `import.meta.url` itself is an `http:`
URL, as it did before 2026-10-14.

`focus-and-announcement`, `submit-state` and `finding-the-cost` each decide whether a
reference file is worth adding to this pack. **In the earlier run, before the 2026-10-14
one, all three came back with no criterion line missed in any of three runs, so there is
no `accessibility.md`, no `forms.md` and no `performance.md`** — a plain `core` + `vue`
session then did these things unaided.

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

## The 2026-10-14 run

Every case was run twice per arm, `core` + `vue` against `core` alone, with the manual
`claude -p` rig on Claude Code 2.1.299, model `claude-opus-5-5`, graded by hand per criterion
line, on Windows 10 (10.0.19045), with the packs loaded from the working tree through
`--plugin-dir`. The harness was tried first: it raised no `dependency-unsatisfied`, but its
with-plugin arm answered that `/vue:vue-engineering` was not installed, so it measured nothing.
User-level instructions reached both arms; no run used `--bare`.

**The three regression guards held in both arms.** `auto-import-configured`, `vite-public-key`
and `module-scope-state` passed all four runs: no run flagged the plugin-supplied imports, no
run called the public browser key a secret, and no run called the SPA's module-scope ref a
leak. `focus-and-announcement` and `binding-composition-spread` also passed all four runs.
After the `nuxt` skill body's `useState` line was rewritten, the matched pair ran again,
two runs per arm, same rig and CLI: `module-scope-state` again passed all four runs. A final
re-run on the shipped text, same rig and CLI, passed all four runs a third time.

**The two capability cases did not separate the arms.** `composable-reactivity` and
`vite-secret` passed every run, the `core`-only baseline included, so on this model neither
shows the pack adding capability.

**Two cases have FAIL runs.** `submit-state` failed one `core` + `vue` run: the 422 field
messages stay on a field after the user corrects it, until the next submit — the fails-if
line "Validates only on submit and never re-checks". At 1/2 with the pack, this reopens the
question of whether a `forms.md` is worth adding, which the earlier run had settled.
`vitest-jsdom-import-meta-url` passed one `core` + `vue` run and no baseline run. Three of the four runs say `import.meta.url` itself stays `file://`
and only the literal `new URL('…', import.meta.url)` form is rewritten, which contradicts its
first passes-if line, and both baseline runs give a fix other than resolving from
`process.cwd()`, which its third line requires. A scratch project on Vitest 5.0.4 and 3.2.4
with jsdom 30.1.2, Node 22.23.3 and Windows 10 then bore those three runs out, and the case's
criteria and `references/testing.md` were rewritten to the observed behaviour. A final re-run
on the shipped text, two runs per arm with the same rig and CLI, passed all four runs against
the rewritten criteria, the `core`-only baseline included, as they expect: every run named the
rewrite of the literal `new URL('…', import.meta.url)` form and gave a fix that reads the real
fixture.

`finding-the-cost` was not run: it needs the dispatch-board project to build and measure,
and no fixture for it is kept in this repository.

## The 2026-10-20 run

Six cases were run twice per arm after the deep-watch bullet in `references/reactivity.md`
and the one-environment rule in `references/review-checklist.md` changed: the four that
touch those files — `composable-reactivity`, `vite-secret`, `vite-public-key`,
`module-scope-state` — and the two guards added with them, `watch-getter-deep` and
`per-environment-build`, `core` + `vue` against `core` alone. The rig was that of "The
2026-10-14 run": the manual `claude -p` pair on Claude Code 2.1.299, model
`claude-opus-5-5`, graded by hand per criterion line, on Windows 10 (10.0.19045), the packs
loaded from the working tree through `--plugin-dir` with the installed copies disabled,
`--strict-mcp-config` with an empty config, and a fresh, empty directory per run. Every
init event carried the `@inline` packs and no transcript reached `plugins/cache`.
User-level instructions reached both arms; no run used `--bare`.

**Each arm also got its loaded packs' directories through `--add-dir`.** Without it, under
`--permission-prompts none`, a Read of a pack reference is denied — the file is outside the
run's directory and nothing can approve it — and the run carries on without the reference.
The first run of this pass hit that and was voided.

**Every run passed.** `watch-getter-deep` passed all four: every run named the getter's
identity as the cause, gave `deep: true`, and said the teammate's direct watch of the
`reactive` object fires without `deep`. One with-plugin run never read
`references/reactivity.md`, so the guard is credited on one run of two.
`per-environment-build` passed all four: no run rated the new `VITE_` URL Critical or
asked for runtime config, and both with-plugin runs read `references/review-checklist.md`
and named the per-environment pipeline as why the rule does not apply. Their blocking
findings on other grounds — the v2 response shape, the variable missing from a
development env file — score neutral, as the criteria say.

`vite-public-key` and `module-scope-state` held in both arms, and `composable-reactivity`
and `vite-secret` again passed every run, the `core`-only baseline included. One
`vite-secret` run in each arm offered checking for a vendor browser key before the proxy;
it is scored as passing, since that replaces the key rather than hiding this one.

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
