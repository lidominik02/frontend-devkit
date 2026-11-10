# Evals for the `frontend` plugin

## Why these exist

Same retention rule as `core` — a component, or a reference set, survives only if an
ablation shows it adds capability. The methodology, the manual run procedure and how to
write a case are in `plugins/core/evals/README.md`; this file covers only what is specific
to the `frontend` plugin and its `vue-*`, `vue-spa-*`, `nuxt-*`, `react-*`, `react-spa-*` and
`next-*` sets.

## What each case tests

The Workspace column names the row of the router's selection table that the case's
`package.json` meets; the sets each row loads are read in that table, in
`plugins/frontend/skills/frontend-engineering/SKILL.md`, not here. The isolation cases and
`ui-package-nuxt-consumer` test which sets the router reads, the trigger cases whether the
router fires without a slash invocation, and the web cases `verifying-ui` and its hand-off
from `testing-changes`.

| Case | Workspace | The claim under test |
| --- | --- | --- |
| `module-scope-state` | Vue SPA | A negative test: module-scope reactive state is an ordinary singleton in a client-only SPA, not a cross-request leak |
| `focus-and-announcement` | Vue SPA | Whether accessibility rules get applied on a task that never asks for them — focus after a removal, a live region for a count that changes, names that distinguish one control from another |
| `submit-state` | Vue SPA | Whether a form is modelled as state that can be submitted twice and rejected by the server, rather than as values plus a validate function |
| `finding-the-cost` | Vue SPA | Whether a performance claim is backed by a measurement, or assembled from plausible causes read off the source |
| `binding-composition-spread` | Vue SPA | Extending a shared binding for one consumer via a spread-and-override rather than folding the new condition into the shared source (which leaks it to every other consumer) |
| `invoice-response-boundary` | Vue SPA | A new API response is validated with the schema library the repo already uses, not typed like the neighbouring module that only casts its JSON |
| `badge-done-report` | Vue SPA | The report after a visual change in a component that styles dark mode separately names looking at it in dark mode as a check |
| `review-vue-order-panel` | Vue SPA | In a review with several seeded defects, server data copied into a Pinia store is flagged when the app already installs a query layer |
| `ssr-shared-state` | Nuxt | Module-scope reactive state is a cross-request data leak under SSR, where the identical code is an ordinary singleton in an SPA |
| `hydration-fix-pins-clock` | Nuxt | Moving a hydration-mismatched time value into `useState` silences the warning by freezing it to the server's clock, not by fixing it, unless the label means server time and the format is fixed |
| `payload-rich-types` (regression guard) | Nuxt | A `Date` and a `Set` in `useState` reach the client as themselves (devalue, every Nuxt 3+ version), so the review comment that they arrive as a string and `{}` and need converting is wrong |
| `nuxt-reviews-fetch` | Nuxt | Rendered data added next to a page's bare `$fetch` is fetched with `useFetch`/`useAsyncData`, not by copying the neighbour into a double fetch |
| `nuxt-view-preference` | Nuxt | The report after a server-rendered change names a check of the server HTML — view source, or the page with JavaScript disabled |
| `review-nuxt-payouts` | Nuxt | In a review with several seeded defects, a second query layer next to `useFetch`/`useAsyncData` is questioned, and a green `vue-tsc --noEmit` against a solution-file `tsconfig.json` is called a check of nothing |
| `isolation-vue-spa` (regression guard) | Vue SPA | With `vue` and no `nuxt` in `package.json`, the router says its selection in one line and reads `vue-spa-rules.md` on top of `vue-rules.md`, after it, never a `nuxt-*` file |
| `isolation-nuxt` (regression guard) | Nuxt | The same prompt with `nuxt` in `package.json`: the router reads `nuxt-rules.md` on top of `vue-rules.md`, after it, never a `vue-spa-*` file |
| `module-scope-state-react` | React SPA | The `module-scope-state` negative test in a client-only React app: module-scope state set after `/api/me` is one value per tab, not a leak |
| `react-spa-token-storage` | React SPA | Persisting a browser session keeps the refresh token out of `localStorage` and every other place a script can read, in an `HttpOnly` cookie the API server sets, and names that server change |
| `ssr-shared-state-next` | Next.js | The same module and prompt as `module-scope-state-react`, written by a Server Component layout and read by a page: a cross-request data leak on the server |
| `next-token-storage` | Next.js | The token-storage claim in the client components of a Next.js app that logs in against an external API |
| `isolation-react` (regression guard) | React SPA | With `react` and no `next` in `package.json`, the router reads `react-spa-rules.md` on top of `react-rules.md`, after it, never a `vue-*`, `nuxt-*` or `next-*` file |
| `isolation-next` (regression guard) | Next.js | With `next` in `package.json`, the router reads `next-rules.md` on top of `react-rules.md`, after it, never a `react-spa-*`, `vue-*` or `nuxt-*` file |
| `ui-package-nuxt-consumer` | peer dependency, Nuxt consumer | A UI package with `vue` only as a peer dependency and a Nuxt consumer gets the consumer's set, and its module-scope state is rated Critical |
| `trigger-vue` | Vue SPA | A Vue question with no slash invocation, in English and in Hungarian, fires the router through a `Skill` call |
| `trigger-nuxt` | Nuxt | The same for a Nuxt question |
| `trigger-next` | Next.js | The same for a Next.js question |
| `trigger-react` | React SPA | The same for a React question |
| `trigger-nuxt-repo` | Nuxt | The `trigger-nuxt` question with its code in the project's files instead of the prompt |
| `verifying-ui` | web | Whether a claim about how a page renders is backed by having loaded it, and whether the state under test gets reached rather than reasoned about |
| `verifying-ui-stall` | web | Whether the fix loop of a direct call, on a page served from a prebuilt bundle no source edit reaches, stops at once at the unreachable source, at no progress, or after the third fix round, never writes into the served files, and hands back what does not match, what it tried and the cause it suspects; a stop at the unreachable source, at no progress or at the ceiling counts as the rule observed |
| `design-intent-skip` | web | Whether the design-intent mode reports its cases as skipped, by name, with the reason, when no design reference is reachable — never a silent pass |
| `storybook-skip` | web | The same skip discipline for the Storybook cases, when no Storybook script exists |
| `delegation-testing-changes` | web | `testing-changes run` without `frontend` skips every `web:` case by name; with it, hands them to `verifying-ui` with `report`, checks the Storybook story and `argTypes` statically without a browser, and fixes nothing |

## The Vue cases

The latest run of every Vue case but `finding-the-cost` is recorded under "The 0.9.0
measurement" below. `binding-composition-spread` was run by hand with `claude -p`, not the
automated harness — see `plugins/core/evals/README.md` for why. Five other candidates from
the same research pass — a shared per-instance loading flag beating a boolean under
overlapping requests, `cn()`/tailwind-merge's last-argument-wins override order,
re-subscribing to a DOM mutation made outside Vue's reactivity, a mock handler's generic
losing its connection to the response schema, and a named Tailwind group requiring its
literal marker class on the right ancestor — were tested the same way and dropped: a bare
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

`module-scope-state` is expected to pass at baseline and is kept for a different reason,
as a regression guard: it fails if the set applies a rule where it does not hold.

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

## The Nuxt cases

The latest run of every Nuxt case is recorded under "The 0.9.0 measurement" below.
`hydration-fix-pins-clock` was run by hand with `claude -p`, not the automated harness —
see `plugins/core/evals/README.md` for why. `payload-rich-types` is a regression guard,
expected to pass at baseline and to fail only if the set teaches the conversion. Four other
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
whose skill bodies are now `vue-rules.md` and `nuxt-rules.md`. The runs of cases removed
since are left out; why each was removed is under "The 0.8.0 measurement".

**The Vue cases.** Every case was run twice per arm, `core` + `vue` against `core`
alone, with the manual `claude -p` rig on Claude Code 2.1.299, model `claude-opus-5-5`,
graded by hand per criterion line, on Windows 10 (10.0.19045), with the packs loaded from
the working tree through `--plugin-dir`. The harness was tried first: it raised no
`dependency-unsatisfied`, but its with-plugin arm answered that the pack's skill was not
installed, so it measured nothing. User-level instructions reached both arms; no run used
`--bare`.

**The regression guard held in both arms.** `module-scope-state` passed all four runs: no
run called the SPA's module-scope ref a leak. `focus-and-announcement` and
`binding-composition-spread` also passed all four runs. After the `nuxt` skill body's
`useState` line was rewritten, the matched pair ran again, two runs per arm, same rig and
CLI: `module-scope-state` again passed all four runs. A final re-run on the shipped text,
same rig and CLI, passed all four runs a third time.

**One case has a FAIL run.** `submit-state` failed one `core` + `vue` run: the 422 field
messages stay on a field after the user corrects it, until the next submit — the fails-if
line "Validates only on submit and never re-checks". At 1/2 with the pack, this reopened the
question of whether a forms reference is worth adding, which the earlier run had settled. The
later measurement above answered it: the row failed in both arms, so `vue-forms.md` was added.

`finding-the-cost` was not run: it needs the dispatch-board project to build and measure,
and no fixture for it is kept in this repository.

**The Nuxt cases.** Every case was run twice per arm, `core` + `vue` + `nuxt` against
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

Only `ssr-shared-state` separated the arms on this run, and narrowly — one run of two with
the pack against none without; `payload-rich-types` differed by one baseline FAIL on a
regression guard, and every other case scored the same in both arms.

## The 2026-10-20 run

The runs of cases removed since are left out here too.

**The Vue cases.** `module-scope-state` was run twice per arm, `core` + `vue` against
`core` alone, after the deep-watch bullet of the Vue reactivity reference and the
one-environment rule of its review checklist changed. The rig was that of "The 2026-10-14
run": the manual `claude -p` pair on Claude Code 2.1.299, model `claude-opus-5-5`, graded by
hand per criterion line, on Windows 10 (10.0.19045), the packs loaded from the working tree
through `--plugin-dir` with the installed copies disabled, `--strict-mcp-config` with an
empty config, and a fresh, empty directory per run.
Every init event carried the `@inline` packs and no transcript reached `plugins/cache`.
User-level instructions reached both arms; no run used `--bare`.

**Each arm also got its loaded packs' directories through `--add-dir`.** Without it, under
`--permission-prompts none`, a Read of a pack reference is denied — the file is outside the
run's directory and nothing can approve it — and the run carries on without the reference.
The first run of this pass hit that and was voided.

`module-scope-state` held in both arms.

**The Nuxt cases.** `ssr-shared-state` was run again after the Vue reactivity
reference and review checklist changed, two runs per arm, `core` + `vue` + `nuxt` against
`core` + `vue`, on the rig above. **It passed both runs with the pack and neither
without**, as on the final 2026-10-14 re-run. Both pack runs said the initialiser must be a
function. Both baseline runs found the leak and reached for `useState`, but neither met the
mechanism line: one named the payload only as how the value reaches the client, the other
only hydration. `module-scope-state`, its mirror, passed all four runs in the same pass.

## The 0.8.0 measurement

Three passes: a three-arm baseline of the 0.7.0 sets, a revision of the `vue-*`,
`vue-spa-*` and `nuxt-*` sets against that baseline, and the release gates on the revised
tree.

**The rig was the same in every pass.** The manual `claude -p` rig of "Running the arms",
driven by a throwaway script: Claude Code 2.1.317 called by its full path with
`DISABLE_AUTOUPDATER=1`, model `claude-opus-5-5` (the `model` field of every init event),
Linux 6.8.0-147-generic, subscription auth without `--bare`, `--max-budget-usd 1` per run,
at most four runs at once. Each run had a fresh directory outside the repository holding
only the case's fixture, the installed plugins and all hooks disabled, `--strict-mcp-config`
with an empty config, `--permission-prompts none`, and the prompt's `max_turns` and
`allowed_tools`. The packs were loaded from the working tree through `--plugin-dir` and
`--add-dir`: `core` in every arm, `frontend` in the with-plugin arm only; the docs-only arm
added its `AGENTS.md` and `WebFetch`. No arm was isolated from user-level instructions and
settings, which reached every run the same way; effort was `xhigh`, set there, since the
init event does not carry it. Every run was graded by hand per criterion line, from its
answer, the files it wrote and its tool calls, by one grader, `claude-opus-5-5`; there is no
independent second grade. A run that failed a rig check or hit the account's usage limit
was run again; no run hit the budget ceiling.

**The baseline ran on the 0.7.0 plugin tree**, identical to the `v0.7.0` tag's
`plugins/`: every content case twice per arm in all three arms, the isolation cases and
`ui-package-nuxt-consumer` twice with the plugin, and each trigger prompt five times with
the plugin. `finding-the-cost` was not run, for want of its fixture, nor were the web cases,
which do not measure a rule set. The with-plugin arm beat
the baseline arm on `submit-state`, `ssr-shared-state` and `payload-rich-types`, two runs to
none each, and lost on `hydration-fix-pins-clock`, none to one. Every other content case
passed every run in all three arms, with the with-plugin arm spending more turns and tokens
than the baseline. The docs-only arm reached the with-plugin arm on none of the three: none,
one and one run of two.

**The revision measured every rule of the three rules files**, on its baseline case where
one covered it and otherwise on a probe written for it. A rule left the set when the
baseline arm failed at most one run of four; it stayed when the baseline arm failed two and
the with-plugin arm did better. Five of the 27 rule items stayed. The copies of the 18
rules dropped on a probe, in topic files and review checklists, were then measured the same
way in review form, and three were kept. The probes the baseline arm failed and the
with-plugin arm passed became cases:

| Case | Baseline arm | With plugin | Docs only |
| --- | --- | --- | --- |
| `invoice-response-boundary` | 0 of 2 | 2 of 2 | 0 of 2 |
| `badge-done-report` | 1 of 4 | 2 of 2 | 0 of 2 |
| `nuxt-reviews-fetch` | 0 of 2 | 2 of 2 | 2 of 2 |
| `nuxt-view-preference` | 0 of 4 | 2 of 2 | 0 of 2 |
| `review-vue-order-panel` | 1 of 4 | 2 of 2 | 2 of 2 |
| `review-nuxt-payouts` (c) | 0 of 4 | 2 of 2 | 0 of 2 |
| `review-nuxt-payouts` (q) | 0 of 4 | 2 of 2, after a checklist line (1 of 4 before) | 0 of 2 |

Nine cases were removed, each with the rule it guarded, because the baseline arm passed all
four of its runs: `composable-reactivity`, `vite-secret`, `vite-public-key`,
`auto-import-configured`, `watch-getter-deep`, `per-environment-build`,
`promoted-artifact-env-url`, `cookie-independent-ref` and `vitest-jsdom-import-meta-url`
(the last on a fixture that gives the router a `package.json` for its workspace).
`hydration-fix-pins-clock` was a text defect: the reference recommended `<NuxtTime>` and
described the `useState` trap without saying that the value `useState` hands to
`<NuxtTime>` is still the server's instant. With that said, the with-plugin arm passed every
run since, against none of two before. The other kept cases passed both with-plugin runs on
the revised tree.

**The release gates ran with the plugin on the revised tree**, two runs per case and five
per trigger prompt, and the matched pair also in the baseline arm. "Before" is the
with-plugin result on the 0.7.0 tree, or on the revised tree for a case the revision added.
A gate passes when the with-plugin arm passes no fewer runs than before, a trigger prompt
counting a run that both fired and gave the selection line. Where it passes fewer, four
more runs on the revised tree and four on a copy of the 0.7.0 plugin tree decide: the gate
fails if the revised tree fails at least two more of them.

| Case | With plugin | Baseline arm | Before | Result |
| --- | --- | --- | --- | --- |
| `isolation-vue-spa` | 2 of 2 | — | 1 of 2 | pass |
| `isolation-nuxt` | 2 of 2 | — | 2 of 2 | pass |
| `isolation-next` | 2 of 2 | — | 2 of 2 | pass |
| `ui-package-nuxt-consumer` | 2 of 2 | — | 2 of 2 | pass |
| `module-scope-state` | 2 of 2 | 2 of 2 | 2 of 2 | pass |
| `ssr-shared-state` | 2 of 2 | 0 of 2 | 2 of 2 | pass |
| `focus-and-announcement` | 2 of 2 | — | 2 of 2 | pass |
| `submit-state` | 1 of 2, then 3 of 4 | — | 2 of 2, then 4 of 4 | FAIL, then pass on the paired runs |
| `binding-composition-spread` | 2 of 2 | — | 2 of 2 | pass |
| `hydration-fix-pins-clock` | 2 of 2 | — | 0 of 2 | pass |
| `payload-rich-types` | 2 of 2 | — | 2 of 2 | pass |
| `invoice-response-boundary` | 2 of 2 | — | 2 of 2 | pass |
| `badge-done-report` | 2 of 2 | — | 2 of 2 | pass |
| `nuxt-reviews-fetch` | 2 of 2 | — | 2 of 2 | pass |
| `nuxt-view-preference` | 2 of 2 | — | 2 of 2 | pass |
| `review-vue-order-panel` | 2 of 2 | — | 2 of 2 | pass |
| `review-nuxt-payouts` | 2 of 2 | — | 2 of 2 | pass |
| `trigger-vue`, English | fired 5 of 5, selection 4 of 5 | — | fired 5 of 5, selection 3 of 5 | pass |
| `trigger-vue`, Hungarian | fired 5 of 5, selection 5 of 5 | — | fired 5 of 5, selection 2 of 5 | pass |
| `trigger-nuxt`, English | fired 4 of 5, selection 4 of 5 | — | fired 5 of 5, selection 3 of 5 | pass |
| `trigger-nuxt`, Hungarian | fired 4 of 5, selection 4 of 5 | — | fired 5 of 5, selection 4 of 5 | pass |
| `trigger-next`, English | fired 5 of 5, selection 4 of 5 | — | fired 5 of 5, selection 4 of 5 | pass |
| `trigger-next`, Hungarian | fired 5 of 5, selection 4 of 5 | — | fired 5 of 5, selection 2 of 5 | pass |
| `trigger-nuxt-repo`, English | fired 5 of 5, selection 5 of 5 | — | fired 5 of 5, selection 5 of 5 | pass |
| `trigger-nuxt-repo`, Hungarian | fired 5 of 5, selection 5 of 5 | — | fired 5 of 5, selection 5 of 5 | pass |

NOT RUN: `finding-the-cost`, which has no fixture in this repository, and the five web
cases — `verifying-ui`, `verifying-ui-stall`, `storybook-skip`, `design-intent-skip`,
`delegation-testing-changes` — which measure `verifying-ui` and its hand-off rather than a
rule set, have no baseline from this measurement, and whose skill this release did not
change.

Isolation held on all three fixtures: every run said its selection before it read a set
file, the Vue SPA runs read `vue-spa-rules.md` after `vue-rules.md` and no `nuxt-*` file,
the Nuxt runs read no `vue-spa-*` file, and the Next.js runs read no set file. The matched
pair separated with the plugin, and the baseline arm again named the leak on
`ssr-shared-state` without the `useState` mechanism. No trigger prompt passed fewer runs
than on the 0.7.0 tree. `trigger-nuxt` fired four times of five in each language, where it
had fired five: both misses called `core:investigating-bugs` alone and diagnosed without the
router. Whether the router fires is decided by the skill listing, which has not changed
since 0.7.0.

`submit-state` failed its gate first: one run of two passed, and the other stopped at four
questions about the API without writing the form, which its criteria score as a miss on
every row. The paired runs then passed three of four on the revised tree and four of four
on the 0.7.0 tree, one failure more, below the two that make a regression. Pooled, the
revised tree passed four runs of six and the 0.7.0 tree six of six; both misses stopped at
questions in the same way, and every other run wrote the form with an in-flight guard in
the handler, touched fields and server messages cleared on edit. Why two runs stopped is
open; `vue-forms.md` is the same file in both trees, which rules out only the forms
reference.

## The 0.9.0 measurement

Three passes: candidate rules for React and Next.js tried against the baseline arm, the
`react-*`, `react-spa-*` and `next-*` sets built from the survivors, and the release gates
on the 0.9.0 tree.

**The rig was the 0.8.0 measurement's**, with the same CLI, model, OS, auth, limits,
isolation and grading. The Next.js fixtures linked one shared `next` 16.4.5 install into
each run's directory, and the external arm ran as "Running the arms" describes.

**Fifteen React candidates produced one case.** The baseline arm passed all four runs of
fourteen of them, so they carry no rule. The fifteenth became `react-spa-token-storage`:
all four baseline runs wrote the tokens to `localStorage`. **Twenty Next.js candidates in two
rounds produced none of their own**: the documentation the installed `next` package ships
states fourteen of them, and the baseline arm failed none or one run of four on the other
six, where a case needs two. The token-storage question asked in a Next.js app failed three
baseline runs of four and became `next-token-storage`. Its rule lives in `react-*`, so both
frameworks read it. The `react-*` and `next-*` sets otherwise carry structure only: the
selection, the documentation source for Next.js and its review checklist.

| Case | Baseline arm | With plugin | Docs only | External |
| --- | --- | --- | --- | --- |
| `react-spa-token-storage` | 0 of 4 | 2 of 2 (0 of 2 before the rule) | 0 of 2 | — |
| `next-token-storage` | 1 of 4 | 2 of 2 | 2 of 2 | 2 of 2 |
| `module-scope-state-react` | 2 of 2 | 2 of 2 | — | — |
| `ssr-shared-state-next` | 2 of 2 | 2 of 2 | — | 2 of 2 |

The external skill was listed in every external run and called in none, so that column
measures `core` plus the listing, not the skill's text. The new pair separates with the
plugin: not a bug on the React SPA, Critical on Next.js. The baseline arm gets both right,
so the pair guards the selection rather than adding capability.

**The release gates ran with the plugin on the 0.9.0 tree**, two runs per case and the
matched pairs also in the baseline arm, against the same rule as in 0.8.0. These runs used
an earlier, longer description. The content and router cases open with the slash
invocation, so the description does not decide whether they fire, but the shipped
description was not run on them.

| Case | With plugin | Baseline arm | Before | Result |
| --- | --- | --- | --- | --- |
| `isolation-vue-spa` | 2 of 2 | — | 2 of 2 | pass |
| `isolation-nuxt` | 2 of 2 | — | 2 of 2 | pass |
| `isolation-react` | 2 of 2 | — | 2 of 2 | pass |
| `isolation-next` | 2 of 2 | — | 2 of 2 | pass |
| `ui-package-nuxt-consumer` | 2 of 2 | — | 2 of 2 | pass |
| `module-scope-state` | 2 of 2 | 2 of 2 | 2 of 2 | pass |
| `ssr-shared-state` | 2 of 2 | 0 of 2 | 2 of 2 | pass |
| `module-scope-state-react` | 2 of 2 | 2 of 2 | 2 of 2 | pass |
| `ssr-shared-state-next` | 2 of 2 | 2 of 2 | 2 of 2 | pass |
| `focus-and-announcement` | 2 of 2 | — | 2 of 2 | pass |
| `submit-state` | 2 of 2 | — | 1 of 2, then 3 of 4 | pass |
| `binding-composition-spread` | 2 of 2 | — | 2 of 2 | pass |
| `hydration-fix-pins-clock` | 2 of 2 | — | 2 of 2 | pass |
| `payload-rich-types` | 2 of 2 | — | 2 of 2 | pass |
| `invoice-response-boundary` | 2 of 2 | — | 2 of 2 | pass |
| `badge-done-report` | 2 of 2 | — | 2 of 2 | pass |
| `nuxt-reviews-fetch` | 2 of 2 | — | 2 of 2 | pass |
| `nuxt-view-preference` | 2 of 2 | — | 2 of 2 | pass |
| `review-vue-order-panel` | 2 of 2 | — | 2 of 2 | pass |
| `review-nuxt-payouts` | 2 of 2 | — | 2 of 2 | pass |
| `react-spa-token-storage` | 2 of 2 | — | 2 of 2 | pass |
| `next-token-storage` | 2 of 2 | — | 2 of 2 | pass |

NOT RUN: `finding-the-cost` and the five web cases, for the reasons given under "The 0.8.0
measurement".

**The trigger prompts decided the description.** During this measurement the 0.8.0 tree
itself fired well below its 0.8.0 measurement, so each wording was measured in pairs, with
runs on a copy of the 0.8.0 plugin tree as the control. A wording counts as a regression on
a prompt when it fails at least two more runs of four than the control, or four more of
eight. Naming React in the
description's first sentence, then naming "React SPA" and "hooks" in its second, both
regressed `trigger-vue` in English: none of eight fired against five, and none of four
against three. The 0.8.0 description on the 0.9.0 tree matched the 0.8.0 tree, three of
eight each, run side by side. That placed the cause in the description and not in the
sets. The shipped description is the 0.8.0 text with one word added, "React", in its "Use
whenever" sentence. Measured side by side, eight runs on each tree:

| Prompt | 0.9.0 tree: fired, passed | 0.8.0 tree: fired, passed | Result |
| --- | --- | --- | --- |
| `trigger-vue`, English | 2 of 8, 2 of 8 | 1 of 8, 1 of 8 | no regression |
| `trigger-nuxt`, Hungarian | 0 of 8, 0 of 8 | 0 of 8, 0 of 8 | no regression |
| `trigger-react`, English | 2 of 8, 2 of 8 | 0 of 8, 0 of 8 | no regression |
| `trigger-react`, Hungarian | 0 of 8, 0 of 8 | 0 of 8, 0 of 8 | no regression, **never fired** |

**The router does not fire on the Hungarian React prompt.** All eight runs on each tree
answered at once, in one turn, with no `Skill` call. It fired in English on two runs of
eight. 0.9.0 ships with this gap open. The other trigger prompts were not run on the shipped
description.

## The matched pair

`module-scope-state` and `ssr-shared-state` are the same code in the opposite environment,
and so are `module-scope-state-react` and `ssr-shared-state-next`. Each pair guards against
either set's rule reaching the other's framework, which is a different question from
whether a set adds capability.

| Case | Correct verdict | What it guards |
| --- | --- | --- |
| `module-scope-state` | **not** a bug (client-only SPA) | Nuxt guidance leaking into the `vue-*` or `vue-spa-*` set |
| `ssr-shared-state` | **Critical** (server-rendered) | The SPA rule being applied under SSR |
| `module-scope-state-react` | **not** a bug (client-only SPA) | Next.js guidance leaking into the `react-*` or `react-spa-*` set |
| `ssr-shared-state-next` | **Critical** (server-rendered) | A Next.js workspace getting the SPA reading of module scope |

**A pair is the instrument. Run both of its cases whenever either changes.** Either case alone
measures nothing: rules that call module-scope state a leak everywhere pass one and fail
the other, and rules that call it fine everywhere do the reverse.

## Running the arms

The with-plugin arm enables **`core` and `frontend`**, and the prompt of every content and
router case opens with `/frontend:frontend-engineering`; the trigger cases' prompts carry
no slash invocation, as below. The router chooses the sets from the
workspace's `package.json`, so each run's directory carries one that names the framework:
the fixture in the case's `graders/criteria.md` when it has one, otherwise
`{"dependencies":{"vue":"^3.5.0"}}` for a Vue case and
`{"dependencies":{"nuxt":"^4.0.0","vue":"^3.5.0"}}` for a Nuxt case. Without it the
router selects no set and the run measures nothing. The fixtures of `next-token-storage` and
`ssr-shared-state-next` have `next` 16.2.0 or later installed by
`npm install --ignore-scripts`, so the documentation the package ships is in the run's
directory.

The baseline arm is **`core` alone**, not "no plugins", for every set. `core` is enabled in
every repository anyway, so it is part of the floor this plugin is measured against rather
than part of what is being measured. Its prompt drops the slash line and the blank line
after it, and is otherwise the same.

The docs-only arm is `core` alone, with an `AGENTS.md` beside the fixture that points at
the framework's `llms.txt` indexes, and `WebFetch` added to the prompt's `allowed_tools`;
its prompt is the baseline arm's. A Vue case's file lists the Vue, Vue Router, Pinia and
Vite indexes, a React case's the React and Vite indexes, and a Nuxt case's lists Nuxt's
first:

```
# Documentation

The documentation of this project's frameworks is indexed in these `llms.txt` files; each
lists its documentation pages as Markdown links. Read the relevant pages before writing code
against a framework's API or answering a question about how it behaves.

- Nuxt: https://nuxt.com/llms.txt
- Vue: https://vuejs.org/llms.txt
- Vue Router: https://router.vuejs.org/llms.txt
- Pinia: https://pinia.vuejs.org/llms.txt
- Vite: https://vite.dev/llms.txt
```

A Next.js case's `AGENTS.md` points at the documentation its installed package ships
instead, and the arm needs no `WebFetch` for it:

```
# Documentation

This project's Next.js documentation, matched to the installed version, is in
`node_modules/next/dist/docs/`. Read the relevant pages before writing code against a
Next.js API or answering a question about how it behaves.
```

It shows where a pointer to the documentation would do a rule's work, and it is not the
measure: a rule stays when the with-plugin arm beats the baseline arm, whatever the
docs-only arm scores.

The external arm runs on the Next.js cases, twice each: `core` and the `wshobson` skill
`nextjs-app-router-patterns` in place of `frontend`. The skill is read in full before its
first run, placed in a plugin directory of its own outside the repository, with a
`.claude-plugin/plugin.json`, and loaded only into the run through `--plugin-dir` and
`--add-dir`, never installed; the run's init event lists that plugin and `core`, both
`@inline`. It compares the with-plugin arm with a widely used community skill on the same
case, and decides nothing about a rule.

The isolation cases — `isolation-vue-spa`, `isolation-nuxt`, `isolation-react`,
`isolation-next` — run the with-plugin arm only: without `frontend` there is no set to read,
so a baseline arm measures nothing. Each is expected to pass in every run, and its result is
a score, not a verdict on keeping a set. They are hand-run, since on CLI 2.1.310 the harness
loaded `frontend` but ran the case in a directory with no `package.json`, where the router
selects no set.

The trigger cases — `trigger-vue`, `trigger-nuxt`, `trigger-next`, `trigger-react`,
`trigger-nuxt-repo` — are with-plugin-only and hand-run on the same rig, and their prompts
carry no slash invocation: the measure is the model's own `Skill` call, as a fire rate over
repeated runs. Each case has two arms in one directory, `prompt.md` in English and `prompt.hu.md` in Hungarian, with the
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
