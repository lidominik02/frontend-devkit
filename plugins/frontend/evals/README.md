# Evals for the `frontend` plugin

## Why these exist

Same retention rule as `core` — a component, or a reference set, survives only if an
ablation shows it adds capability. The methodology, the manual run procedure and how to
write a case are in `plugins/core/evals/README.md`; this file covers only what is specific
to the `frontend` plugin and its `vue-*` and `nuxt-*` sets.

## What each case tests

The `vue-*` cases measure the `vue-*` reference set, the `nuxt-*` cases the `nuxt-*` set
on top of it, the isolation cases and `ui-package-nuxt-consumer` which set the router reads,
the trigger cases whether the router fires without a slash invocation, and the web cases
`verifying-ui` and its hand-off from `testing-changes`.

| Case | Set | The claim under test |
| --- | --- | --- |
| `composable-reactivity` | `vue-*` | Crossing a composable boundary with a getter rather than a value, so the result keeps tracking when the input changes |
| `vite-secret` | `vue-*` | Recognising that a static SPA has nowhere to keep a secret, and that a `VITE_`-prefixed value is inlined into the shipped bundle |
| `vite-public-key` | `vue-*` | A negative test, the mirror of `vite-secret`: a key its vendor's docs call public is wired into client config, not flagged as a leaked secret or held behind a backend |
| `auto-import-configured` | `vue-*` | A negative test: a project whose `vite.config.ts` imports `unplugin-auto-import` and `unplugin-vue-components` has its missing `ref`, `computed` and component imports resolved by those plugins, not flagged as a build error or as imports to add |
| `module-scope-state` | `vue-*` | A negative test: module-scope reactive state is an ordinary singleton in a client-only SPA, not a cross-request leak |
| `focus-and-announcement` | `vue-*` | Whether accessibility rules get applied on a task that never asks for them — focus after a removal, a live region for a count that changes, names that distinguish one control from another |
| `submit-state` | `vue-*` | Whether a form is modelled as state that can be submitted twice and rejected by the server, rather than as values plus a validate function |
| `finding-the-cost` | `vue-*` | Whether a performance claim is backed by a measurement, or assembled from plausible causes read off the source |
| `binding-composition-spread` | `vue-*` | Extending a shared binding for one consumer via a spread-and-override rather than folding the new condition into the shared source (which leaks it to every other consumer) |
| `vitest-jsdom-import-meta-url` | `vue-*` | Under Vitest + jsdom, Vite rewrites the literal `new URL('…', import.meta.url)` into an `http:` URL resolved against jsdom's location while `import.meta.url` itself stays `file://` — and that it is not the well-known jsdom `URL`-shadowing bug |
| `watch-getter-deep` | `vue-*` | A regression guard on the set's own reactivity text: a getter watcher on an object misses nested changes and is fixed with `deep: true` or by watching the `reactive` object directly, which is deep implicitly — never by demanding `deep` on a `reactive` source |
| `per-environment-build` | `vue-*` | A negative test: a new environment-specific `VITE_` URL, in a project whose pipeline builds once per environment on purpose, is not rated Critical or held behind runtime config |
| `promoted-artifact-env-url` | `vue-*` | The mirror of `per-environment-build`: a new environment-specific `VITE_` URL, in a project that builds once and promotes that artifact, is rated Critical and moved to the runtime config the project already has |
| `ssr-shared-state` | `nuxt-*` | Module-scope reactive state is a cross-request data leak under SSR, where the identical code is an ordinary singleton in an SPA |
| `cookie-independent-ref` | `nuxt-*` | Each `useCookie` call returns its own ref, and cross-instance sync is asynchronous, not immediate |
| `hydration-fix-pins-clock` | `nuxt-*` | Moving a hydration-mismatched time value into `useState` silences the warning by freezing it to the server's clock, not by fixing it, unless the label means server time and the format is fixed |
| `payload-rich-types` (regression guard) | `nuxt-*` | A `Date` and a `Set` in `useState` reach the client as themselves (devalue, every Nuxt 3+ version), so the review comment that they arrive as a string and `{}` and need converting is wrong |
| `isolation-vue-spa` (regression guard) | `vue-*` | With `vue` and no `nuxt` in `package.json`, the router says its selection in one line and reads `vue-*` files only, never a `nuxt-*` one |
| `isolation-nuxt` (regression guard) | `vue-*` + `nuxt-*` | The same prompt with `nuxt` in `package.json`: the router reads `nuxt-rules.md` on top of `vue-rules.md`, after it |
| `isolation-next` (regression guard) | none | With `next` in `package.json`, the router selects no set and reads no `vue-*` or `nuxt-*` file |
| `ui-package-nuxt-consumer` | `vue-*` + `nuxt-*` | A UI package with `vue` only as a peer dependency and a Nuxt consumer gets the consumer's set, and its module-scope state is rated Critical |
| `trigger-vue` | `vue-*` | A Vue question with no slash invocation, in English and in Hungarian, fires the router through a `Skill` call |
| `trigger-nuxt` | `vue-*` + `nuxt-*` | The same for a Nuxt question |
| `trigger-next` | none | The same for a Next.js question, after which the router selects no set |
| `trigger-nuxt-repo` | `vue-*` + `nuxt-*` | The `trigger-nuxt` question with its code in the project's files instead of the prompt |
| `verifying-ui` | web | Whether a claim about how a page renders is backed by having loaded it, and whether the state under test gets reached rather than reasoned about |
| `verifying-ui-stall` | web | Whether the fix loop of a direct call, on a page served from a prebuilt bundle no source edit reaches, stops at once at the unreachable source, at no progress, or after the third fix round, never writes into the served files, and hands back what does not match, what it tried and the cause it suspects; a stop at the unreachable source, at no progress or at the ceiling counts as the rule observed |
| `design-intent-skip` | web | Whether the design-intent mode reports its cases as skipped, by name, with the reason, when no design reference is reachable — never a silent pass |
| `storybook-skip` | web | The same skip discipline for the Storybook cases, when no Storybook script exists |
| `delegation-testing-changes` | web | `testing-changes run` without `frontend` skips every `web:` case by name; with it, hands them to `verifying-ui` with `report`, checks the Storybook story and `argTypes` statically without a browser, and fixes nothing |

## The `vue-*` cases

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

`composable-reactivity` and `vite-secret` are capability cases: the set earns its place
only if the baseline arm gets them wrong. `module-scope-state`, `vite-public-key`,
`auto-import-configured`, `watch-getter-deep` and `per-environment-build` are expected to
pass at baseline and are kept for a different reason, as regression guards: each fails if
the set applies a rule where it does not hold. `vitest-jsdom-import-meta-url` is a
regression guard too: it fails if the set says `import.meta.url` itself is an `http:`
URL, as it did before 2026-10-14. `promoted-artifact-env-url` is expected to pass at
baseline too and guards the other direction: it fails if the narrowed one-environment rule
stops firing in the project it still covers, one that builds once and promotes the
artifact.

`focus-and-announcement`, `submit-state` and `finding-the-cost` each decide whether a
reference file is worth adding to the `vue-*` set. **In the earlier run, before the
2026-10-14 one, all three came back with no criterion line missed in any of three runs, so
there is no accessibility or performance reference** — a session with `core` and the Vue
rules then did these things unaided. **Forms now have one, `vue-forms.md`.** A later
measurement of `submit-state`, five runs per arm, failed its (c) row — a field message about
a value the field no longer holds is gone by the time the user leaves the field — in all
five `core` + `frontend` runs and all five `core`-only runs. With `vue-forms.md` in the set,
the `core` + `frontend` arm met (c) in all five runs.

They are kept for the reason `module-scope-state` is kept, as a regression instrument. A
case is cheaper to run than its question is to re-argue, so a proposal to add one of these
files is answered by running the case rather than by debating the file.

`finding-the-cost`'s second baseline arm has now been run, and it clears the set of the
suspicion it was written to test. The worry was that the routing reference supplies the
lazy-route and entry-chunk answers in prose, so a baseline with the Vue rules could produce
them without knowing anything. **`core` alone does it too** — three runs, each of which ran
the project's own build unprompted, read the 372 kB entry chunk against the 0.2 kB lazy
routes off the chunk table, and named `chart.js/auto` and `luxon` at the entry. The set is
not manufacturing the failure, because there is no failure to manufacture: measuring before
ranking is already the floor behaviour.

## The `nuxt-*` cases

`cookie-independent-ref` and `hydration-fix-pins-clock` were run by hand with `claude -p`,
not the automated harness — see `plugins/core/evals/README.md` for why.
`payload-rich-types` is a regression guard, expected to pass at baseline and to fail only
if the set teaches the conversion. Every case's latest run is recorded under "The
2026-10-14 run" or "The 2026-10-20 run" below. Four other
candidates from the same research pass — a plain async function losing Nuxt's request
context after an `await`, a missing `runtimeConfig.public` key, `setup` running twice
under hydration, and an un-awaited `navigateTo` outside middleware — were tested the same
way and dropped: a bare Sonnet 5, with no plugin at all, already answered every one of
them correctly.

The `nuxt-*` set costs references to maintain and reads on every Nuxt workspace. The
evidence that it is worth it is not that the Nuxt guidance is correct — it is that **a run
without the set gets the same question wrong.**

## The web cases

`verifying-ui` is listed, as a trial: its description is in the always-on listing and it
can fire unprompted, so its hold on verification is the body's first instruction. Its case
carries the trial's question — in the arm where the skill is present but not typed, whether
it fires on the wording, holds until released, and looks with more discipline than the arm
with `core` disabled — and therefore whether the listing cost buys anything, or
`disable-model-invocation` goes back.

It is also the case with the most arms, because it varies two things at once. The
environment: **a browser MCP server present, and none** — the second is not a degenerate
case but the more important half, since most repositories are in it and it is where the
failure the skill exists to prevent actually happens. And the invocation: the skill typed,
the skill present but not typed, and `core` disabled entirely. Its `graders/criteria.md`
says which combinations answer which question; run the environments against both, rather
than reading the pass rate of one as the skill's score.

## The 2026-10-14 run

These runs predate the `frontend` plugin: they loaded the 0.5.x `vue` and `nuxt` plugins,
whose skill bodies are now `vue-rules.md` and `nuxt-rules.md`, and whose reference files
now carry the `vue-` or `nuxt-` prefix. The file names below are the ones read then.

**The `vue-*` cases.** Every case was run twice per arm, `core` + `vue` against `core`
alone, with the manual `claude -p` rig on Claude Code 2.1.299, model `claude-opus-5-5`,
graded by hand per criterion line, on Windows 10 (10.0.19045), with the packs loaded from
the working tree through `--plugin-dir`. The harness was tried first: it raised no
`dependency-unsatisfied`, but its with-plugin arm answered that the pack's skill was not
installed, so it measured nothing. User-level instructions reached both arms; no run used
`--bare`.

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
line "Validates only on submit and never re-checks". At 1/2 with the pack, this reopened the
question of whether a forms reference is worth adding, which the earlier run had settled. The
later measurement above answered it: the row failed in both arms, so `vue-forms.md` was added.
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

**The `nuxt-*` cases.** Every case was run twice per arm, `core` + `vue` + `nuxt` against
`core` + `vue`, with the same rig, CLI, model and OS.

**`payload-rich-types` held with the pack: both runs pass.** The baseline passed one run and
failed the other on the version fails-if line: it said `Date` and `Set` survive the payload
only "since Nuxt 3.4".

**`ssr-shared-state` passed one run of two with the pack, and none without**, so the matched
pair's SSR half did not hold on this run; the FAIL stands as recorded. Every run in
both arms named the cross-request leak and reached for `useState`; the FAILs are its fourth
passes-if line — no mention that the initialiser must be a function, that the value must be
serialisable for the payload, or that the key is global. With the pack, one run said "The
initial value must be a function" and that the key "must be unique across the app"; the
other said only that `useState` carries the state "to the client in the payload".

The skill body's `useState` line was then rewritten to name all three — the key is global
to the app, the initialiser is a function, the value goes into the payload — and the pair
ran again, two runs per arm, same rig and CLI. **`ssr-shared-state` came back the same: one
run of two with the pack, none without; the FAIL stands.** The passing run said "The
initialiser has to be a function" and "The key has to be unique across the app"; the
failing one said only that Nuxt "puts the value in the payload", and every baseline run
named the payload only as how the value reaches the client. `module-scope-state` passed all
four runs. Those runs used that wording before the payload type note was restored.

A final re-run on the shipped text, with the note, two runs per arm with the same rig and CLI,
**passed `ssr-shared-state` in both runs with the pack and in neither without.** Both pack
runs said the initialiser must be a function and the key must be unique across the app; one
baseline run made `useCookie` the fix, and both named the payload only as how the value
reaches the client. `module-scope-state` passed all four runs. Two runs per arm is a small
sample: the two earlier runs were one of two each with the pack.

**`hydration-fix-pins-clock` passed one run of two in each arm**, so this run does not
separate them. Both FAILs miss the third passes-if line: the fix offered for the visitor's
local time reads back the `useState` value, so it still shows the server's instant — the
pack run passed that value to `<NuxtTime>`, the baseline run formatted it in `onMounted`. The
pack run also misses the second passes-if line: it never says the value is not the time the
page loaded for that visitor.

**`cookie-independent-ref` passed all four runs**, the `core` + `vue` baseline included.

Only `ssr-shared-state` separated the arms on this run, and narrowly — one run of two with
the pack against none without; `payload-rich-types` differed by one baseline FAIL on a
regression guard, and every other case scored the same in both arms.

## The 2026-10-20 run

The note on file names under "The 2026-10-14 run" holds here too.

**The `vue-*` cases.** Six cases were run twice per arm after the deep-watch bullet in
`references/reactivity.md` and the one-environment rule in `references/review-checklist.md`
changed: the four that touch those files — `composable-reactivity`, `vite-secret`,
`vite-public-key`, `module-scope-state` — and the two guards added with them,
`watch-getter-deep` and `per-environment-build`, `core` + `vue` against `core` alone. The
rig was that of "The 2026-10-14 run": the manual `claude -p` pair on Claude Code 2.1.299,
model `claude-opus-5-5`, graded by hand per criterion line, on Windows 10 (10.0.19045), the
packs loaded from the working tree through `--plugin-dir` with the installed copies
disabled, `--strict-mcp-config` with an empty config, and a fresh, empty directory per run.
Every init event carried the `@inline` packs and no transcript reached `plugins/cache`.
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

**`promoted-artifact-env-url` was added after this pass and run twice per arm on Claude
Code 2.1.304, with the same rig otherwise.** It passed all four: every run blocked on the
build-time `VITE_SEARCH_URL` because the one promoted bundle carries the production search
URL into staging, and moved it into the per-environment `config.json` beside `apiUrl` and
`cdnUrl`. Both with-plugin runs read `references/review-checklist.md` and
`references/env-and-config.md`, so the guard is credited on both; the `core`-only baseline
reached the same verdict unaided, as the case expects. The prompt's two hunk headers were
corrected after these runs; no line of the diff changed, and no clause reads the counts.

**The `nuxt-*` cases.** `ssr-shared-state` was run again after the Vue reactivity
reference and review checklist changed, two runs per arm, `core` + `vue` + `nuxt` against
`core` + `vue`, on the rig above. **It passed both runs with the pack and neither
without**, as on the final 2026-10-14 re-run. Both pack runs said the initialiser must be a
function. Both baseline runs found the leak and reached for `useState`, but neither met the
mechanism line: one named the payload only as how the value reaches the client, the other
only hydration. `module-scope-state`, its mirror, passed all four runs in the same pass.

## The matched pair

`module-scope-state` and `ssr-shared-state` are the same code in the opposite environment.
Together they guard against either set's rule reaching the other's framework, which is a
different question from whether a set adds capability.

| Case | Correct verdict | What it guards |
| --- | --- | --- |
| `module-scope-state` | **not** a bug (client-only SPA) | Nuxt guidance leaking into the `vue-*` set |
| `ssr-shared-state` | **Critical** (server-rendered) | The SPA rule being applied under SSR |

**The pair is the instrument. Run both whenever either changes.** Either case alone
measures nothing: rules that call module-scope state a leak everywhere pass one and fail
the other, and rules that call it fine everywhere do the reverse.

## Running the arms

The with-plugin arm enables **`core` and `frontend`**, and every `vue-*` and `nuxt-*`
case's prompt opens with `/frontend:frontend-engineering`. The router chooses the set from the
workspace's `package.json`, so each run's directory carries one that names the framework:
`{"dependencies":{"vue":"^3.5.0"}}` for a `vue-*` case, and
`{"dependencies":{"nuxt":"^4.0.0","vue":"^3.5.0"}}` for a `nuxt-*` case. Without it the
router selects no set and the run measures nothing.

The baseline arm is **`core` alone**, not "no plugins", for both sets. `core` is enabled in
every repository anyway, so it is part of the floor this plugin is measured against rather
than part of what is being measured.

The isolation cases — `isolation-vue-spa`, `isolation-nuxt`, `isolation-next` — run the
with-plugin arm only: without `frontend` there is no set to read, so a baseline arm measures
nothing. Each is expected to pass in every run, and its result is a score, not a verdict on
keeping a set. They are hand-run, since on CLI 2.1.310 the harness loaded `frontend` but ran
the case in a directory with no `package.json`, where the router selects no set.

The trigger cases — `trigger-vue`, `trigger-nuxt`, `trigger-next`, `trigger-nuxt-repo` — are
with-plugin-only and hand-run on the same rig, and their prompts carry no slash invocation:
the measure is the model's own `Skill` call, as a fire rate over repeated runs. Each case has
two arms in one directory, `prompt.md` in English and `prompt.hu.md` in Hungarian, with the
same request and code, graded by the one `graders/criteria.md`. `trigger-nuxt-repo` is
`trigger-nuxt` with the code in fixture files rather than pasted into the prompt. The Hungarian arm is hand-run only: the
harness help names `prompt.md` as a case's prompt, and whether it ignores `prompt.hu.md` is
unobserved. A whole-pack harness run measures nothing for these cases, for the reason the
isolation cases give.

`ui-package-nuxt-consumer` runs like the isolation cases: with-plugin only, hand-run, from a
fixture of four files, a root `package.json` with `workspaces` and the two workspaces' own.

`delegation-testing-changes` has two arms, and both load `core`: `core` alone, and `core` +
`frontend`. Each arm has its own expected shape, and the case passes only when both hold
it. It is hand-run interactively, from a git fixture on a feature branch, with no MCP server
in either arm, and its findings form is answered by the script in its `graders/criteria.md`.

`verifying-ui-stall` runs with the plugin only, with a browser MCP server, hand-run from its
fixture; a whole-pack harness run measures nothing for it.
