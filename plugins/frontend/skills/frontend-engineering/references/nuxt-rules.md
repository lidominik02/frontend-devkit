# Nuxt engineering

## Contents
- Before applying any version-gated rule, check what is installed
- Rules from the `vue-*` set that do NOT apply here
- The rules that prevent most bugs
- Reading
- Symptom router
- Before reporting done
- What this must NOT do

**This set is a delta.** Everything in the `vue-*` set holds here — reactivity,
`computed` over `watch`, the composable getter boundary, never mutating props, typing at
the boundary — *except* the rules listed under "do NOT apply" below. Read that section
before applying anything from the `vue-*` set, because each suppressed rule sounds more
specific than the Nuxt rule that replaces it.

Write code that looks like the rest of the codebase you are in. Read the neighbouring
files first, reuse existing composables and server utilities before writing new ones.

## Before applying any version-gated rule, check what is installed

The Nuxt 3 → 4 boundary moved the source directory and changed data-fetching semantics,
and Nuxt 5 changes the server layer. Read the resolved version of `nuxt`, `nitro`, any
`@nuxt/*` package, `vue`, `pinia`, `@pinia/nuxt`, `typescript` and `vue-tsc` from the
lockfile or `node_modules/<pkg>/package.json`; a `package.json` range is only a range.
Resolved version unknown: claim no exact version, and say so in the answer.

Also read `compatibilityDate` and any `future.compatibilityVersion` in `nuxt.config` —
they change runtime behaviour without changing the installed version.
`nuxt-versions.md` has the table.

## Rules from the `vue-*` set that do NOT apply here

**"Imports are explicit unless `vite.config.*` imports an auto-import plugin." —
does not apply here.** This *is* Nuxt, and its auto-imports are built in. `ref`,
`computed`, `watch`, `useState`, `useFetch`, `useRuntimeConfig`, `navigateTo`, and
everything in `app/composables/`, `app/utils/` and `app/components/` are auto-imported.
Do not add imports for them, and do not strip existing ones in a diff that was not about
imports. Where an explicit import is genuinely needed the specifier is `#imports` — not
`vue` for a Nuxt composable. Importing a component from `#components` opts it out of
lazy hydration, so do not do it to "be explicit".

**"Nothing prefixed `VITE_` is a secret, so one build cannot serve two environments, so
fetch `/config.json` before mounting." — does not apply here.** Nuxt reads
`runtimeConfig` at runtime from `NUXT_*` environment variables, so one artifact does
serve every environment and a boot-time config fetch is a waterfall that buys nothing.
Do not add one. The secret boundary still exists; it moved from a prefix to a key.
Anything under `runtimeConfig.public` (or `NUXT_PUBLIC_*`) is in the browser. Anything
else is server-only, and reading it from a component gets you `undefined`, not a
warning. See `nuxt-runtime-config.md`.

Three more, in one line each, with the detail in the reference file:

- **"Server state belongs in a query layer such as TanStack Vue Query" — does not apply
  here.** `useAsyncData`/`useFetch` *is* the query layer, and the `QueryClient` a second
  one wants at module scope is the cross-request leak below.
  → `nuxt-data-fetching.md`
- **"Write guards with `router.beforeEach`, and make route components dynamic imports" —
  does not apply here.** Access control goes in `app/middleware/`; `app/pages/` is
  already split per file and there is no router file to edit.
  → `nuxt-middleware-and-plugins.md`

## The rules that prevent most bugs

**Module-scope state is a cross-request leak.** `const cache = new Map()` or a bare
`ref()` at the top of a module is created once per *server process*, not once per
request, so it is shared by every user the server handles. In an SPA that line is an
ordinary singleton; here it is a data-leak bug that never appears in development with one
user. Use `useState('key', () => initial)`: per request; key global to the app, initialiser
a function, value in the payload — a `Date` survives it, a class instance throws by default.
See `nuxt-ssr-state.md`. **This is the single most expensive mistake available in a Nuxt app.**

**A secret belongs in `runtimeConfig`, not `runtimeConfig.public`.** The `public` key and
any `NUXT_PUBLIC_*` variable are shipped to the browser. Private keys are readable only
in `server/` and plugins that run server-side. See `nuxt-runtime-config.md`.

**`$fetch` in a component body fetches twice.** Once during SSR and again on hydration,
because a bare `$fetch` is not keyed and its result never enters the payload. Use
`useFetch`/`useAsyncData` for anything rendered; keep `$fetch` for event handlers and
server code. See `nuxt-data-fetching.md`.

**Rendered output must be identical on server and client.** A date formatted in local
time, `Math.random()`, `window`, or a value read from `localStorage` during setup all
produce a hydration mismatch — which Vue patches over silently in production. See
`nuxt-rendering-and-head.md`.

**Middleware runs on the server and again on the client.** So it cannot depend on
anything client-only, and a guard that reads `localStorage` is not a guard. See
`nuxt-middleware-and-plugins.md`.

**The directory layout is a framework contract, not a convention.** Which directories
root at `srcDir` and which at `rootDir` changed between majors — `server/`, `public/`
and `modules/` do not live where `app/` code lives. Check the installed major before
moving a file. See `nuxt-versions.md`.

**Validate at the server boundary too.** A Nitro route handler is a public HTTP endpoint.
Use `readValidatedBody` / `getValidatedQuery` rather than trusting the body's type.
See `nuxt-server-routes.md`.

## Reading

Read the one file that matches what you are touching, not all of them.

| Reading | When |
| --- | --- |
| `nuxt-ssr-state.md` | shared state, `useState`, Pinia under SSR, per-request context, cookies |
| `nuxt-data-fetching.md` | `useFetch`, `useAsyncData`, `$fetch`, keys, double-fetch, caching |
| `nuxt-runtime-config.md` | secrets, env vars, per-environment config, `app.config` vs `runtimeConfig` |
| `nuxt-rendering-and-head.md` | hydration mismatch, `<ClientOnly>`, rendering modes, `useHead`/SEO |
| `nuxt-middleware-and-plugins.md` | route middleware, guards, redirects, `app/plugins/` |
| `nuxt-server-routes.md` | `server/api`, Nitro handlers, validation, errors, caching |
| `nuxt-versions.md` | "which API is correct on this version", directory layout, `nuxt typecheck` |
| `nuxt-review-checklist.md` | **reviewing a diff** — the SSR criticals, by severity |

## Symptom router

**One user sees another user's data, or stale data from a previous request**
- Module-scope state on the server → `nuxt-ssr-state.md`, immediately
- A `$fetch` on the server without forwarding the request's cookies →
  `nuxt-ssr-state.md`

**The page renders, flashes, then changes**
- Hydration mismatch → `nuxt-rendering-and-head.md`
- A second fetch on the client for data already in the payload →
  `nuxt-data-fetching.md`

**"Hydration node mismatch" or "Hydration children mismatch" in the console**
- `nuxt-rendering-and-head.md`

**A config value is `undefined`, but only in the deployed build**
- A private `runtimeConfig` key read from client code → `nuxt-runtime-config.md`
- Relying on `.env`, which is not read by a built server → `nuxt-runtime-config.md`

**The request runs twice, or the data refetches for no reason**
- `$fetch` where `useFetch` was meant, or a key that changes every render →
  `nuxt-data-fetching.md`

**A guard lets someone through, or redirects in a loop**
- Middleware depending on client-only state, or running twice →
  `nuxt-middleware-and-plugins.md`

**`window is not defined` / `document is not defined` at build or start-up**
- Client-only code reached during SSR → `nuxt-rendering-and-head.md`

**Meta tags or title are missing from the page source but present in devtools**
- Set after mount instead of during SSR → `nuxt-rendering-and-head.md`

**Types resolve in the editor but fail in CI, or every auto-import is "not found"**
- `.nuxt/` was never generated → `nuxt-versions.md`

## Before reporting done

Run the project's own gates as `core`'s project.md describes; a gate you did not run is
NOT RUN.

Type-checking has a Nuxt-specific trap worth naming: the generated types live in
`.nuxt/`, so a checkout that has only run `install` has nothing to check against, and a
root `tsconfig.json` that is a solution file (`files: []` plus `references`) makes a bare
`vue-tsc --noEmit` exit 0 having checked **nothing**. `nuxt typecheck` is the gate. If
the project's typecheck script is a bare `vue-tsc`, say that the gate is not verifying
templates rather than reporting it as a pass.

If the repo has no type-check, no lint and no tests, say so explicitly rather than
implying the change is verified. Name the manual steps you relied on instead — and for
anything server-rendered that includes loading the page with JavaScript disabled or
viewing source, because a hydration mismatch and a payload bug are both invisible in a
hydrated DOM.

Do not claim a gate passed that you did not run.

## What this must NOT do

- **Grow past ~200 lines in this body.** Detail belongs in `references/`, one level
  deep — Claude partial-reads anything reached through a second hop.
- **Restate what the `vue-*` set already says.** Reactivity primitives, `computed` vs
  `watch`, the composable getter boundary, Pinia mechanics, prop mutation, query-key
  construction and Vitest basics live there. This set carries only what SSR inverts or
  adds. Two copies of one rule is two rules that drift.
- **Contain facts about any individual repository** — no file paths, helper names or
  conventions from a specific codebase. Those belong in that repo's own `CLAUDE.md`.
  This set must stay true of *any* Nuxt app.
- **State a version-gated API as fact** without checking what is installed. The
  directory layout, the data-fetching defaults and the server layer all move between
  majors.
- **Cover Nuxt layers, `extends`, or module authoring.** Those are a different audience
  and a different pack's problem; say so rather than improvising.
- **Bulk-convert files the task did not ask about** — no drive-by migrations to `app/`,
  no rewriting working `$fetch` calls outside the change.
- **Invent a gate command.** Read `package.json`'s scripts instead.
