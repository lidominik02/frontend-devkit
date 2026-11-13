# Evals for the `frontend` plugin

## Why these exist

Same retention rule as `core` — a component, or a reference set, survives only if an
ablation shows it adds capability. The methodology, the manual run procedure and how to
write a case are in `plugins/core/evals/README.md`; this file covers only what is specific
to the `frontend` plugin and its `vue-*`, `vue-spa-*`, `nuxt-*`, `react-*`, `react-spa-*` and
`next-*` sets.

A rule of a set is measured on its case, or on a probe written for it: it leaves the set
when the baseline arm fails at most one run of four, and stays when the baseline arm fails
two and the with-plugin arm does better. A case leaves with the rule it guards when the
baseline arm passes all four of its runs.

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

`binding-composition-spread` was run by hand with `claude -p`, not the
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
reference file is worth adding to the `vue-*` set. **There is no accessibility or
performance reference**: a session with `core` and the Vue rules met every criterion line of
`focus-and-announcement` and `finding-the-cost` unaided. **Forms have one, `vue-forms.md`**:
without it, `submit-state` failed its (c) row — a field message about a value the field no
longer holds is gone by the time the user leaves the field — in both arms, and with it the
`core` + `frontend` arm met (c).

They are kept for the reason `module-scope-state` is kept, as a regression instrument. A
case is cheaper to run than its question is to re-argue, so a proposal to add one of these
files is answered by running the case rather than by debating the file.

`finding-the-cost`'s second baseline arm, `core` alone, clears the set of the suspicion it
was written to test. The worry was that the routing reference supplies the
lazy-route and entry-chunk answers in prose, so a baseline with the Vue rules could produce
them without knowing anything. **`core` alone does it too** — three runs, each of which ran
the project's own build unprompted, read the 372 kB entry chunk against the 0.2 kB lazy
routes off the chunk table, and named `chart.js/auto` and `luxon` at the entry. The set is
not manufacturing the failure, because there is no failure to manufacture: measuring before
ranking is already the floor behaviour.

## The Nuxt cases

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

## The React and Next.js cases

The `react-*`, `react-spa-*` and `next-*` sets carry structure — the selection, the
documentation source for Next.js and its review checklist — and one rule, token storage,
which lives in `react-*` so both frameworks read it. A candidate rule the baseline arm
already gets right, or that the documentation the installed `next` package ships states, is
not added. `module-scope-state-react` and `ssr-shared-state-next` guard the selection rather
than add capability.

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

## The release gates

A release gate compares the with-plugin arm on the new tree with its result on the previous
release's tree. It passes when the with-plugin arm passes no fewer runs than before, a
trigger prompt counting a run that both fired and gave the selection line. Where it passes
fewer, four more runs on the new tree and four on a copy of the previous plugin tree decide:
the gate fails if the new tree fails at least two more of them. A case the release added has
no result on the previous tree; its with-plugin result on the new tree, from when it was
added, stands in for one.

A change to the router's description is measured on the trigger prompts in pairs, with runs
on a copy of the previous plugin tree as the control, because the fire rate drifts between
measurements. A wording regresses a prompt when it fails at least two more runs of four than
the control, or four more of eight. Naming React in the description's first sentence, or
"React SPA" and "hooks" in its second, regressed `trigger-vue` in English; the description
names React once, in its "Use whenever" sentence.

The same sentence says "in whatever language the request is written", for requests not in
English; a wording that drops it is measured on `trigger-react` in Hungarian.

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
router selects no set and the run measures nothing. Every arm loads its packs from the
working tree through `--plugin-dir` and gets their directories through `--add-dir`: under
`--permission-prompts none` a Read of a pack reference outside the run's directory is
denied, and the run carries on without the reference. The fixtures of `next-token-storage` and
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
a score, not a verdict on keeping a set. They are hand-run, since the harness runs a case
without its fixture's `package.json`, where the router selects no set.

The trigger cases — `trigger-vue`, `trigger-nuxt`, `trigger-next`, `trigger-react`,
`trigger-nuxt-repo` — are with-plugin-only and hand-run on the same rig, and their prompts
carry no slash invocation: the measure is the model's own `Skill` call, as a fire rate over
repeated runs. Each case has two arms in one directory, `prompt.md` in English and
`prompt.hu.md` in Hungarian, with the same request and code, graded by the one
`graders/criteria.md`. `trigger-nuxt-repo` is `trigger-nuxt` with the code in fixture files
rather than pasted into the prompt. The Hungarian arm is hand-run only: the harness help
names `prompt.md` as a case's prompt, and whether it ignores `prompt.hu.md` is unobserved. A
whole-pack harness run measures nothing for these cases, for the reason the isolation cases
give.

`ui-package-nuxt-consumer` runs like the isolation cases: with-plugin only, hand-run, from a
fixture of four files, a root `package.json` with `workspaces` and the two workspaces' own.

`delegation-testing-changes` has two arms, and both load `core`: `core` alone, and `core` +
`frontend`. Each arm has its own expected shape, and the case passes only when both hold
it. It is hand-run interactively, from a git fixture on a feature branch, with no MCP server
in either arm, and its findings form is answered by the script in its `graders/criteria.md`.

`verifying-ui-stall` runs with the plugin only, with a browser MCP server, hand-run from its
fixture; a whole-pack harness run measures nothing for it.
