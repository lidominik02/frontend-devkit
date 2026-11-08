# Nuxt engineering

## Contents
- Before applying any version-gated rule, check what is installed
- Rules from the `vue-*` set that do NOT apply here
- The rules that prevent most bugs
- Reading
- Symptom router
- Before reporting done
- What this must NOT do

**This set is a delta.** Everything in the `vue-*` set holds here. The "do NOT apply"
section below names no rule of it.

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

None.

## The rules that prevent most bugs

**Module-scope state is a cross-request leak.** `const cache = new Map()` or a bare
`ref()` at the top of a module is created once per *server process*, not once per
request, so it is shared by every user the server handles. In an SPA that line is an
ordinary singleton; here it is a data-leak bug that never appears in development with one
user. Use `useState('key', () => initial)`: per request; key global to the app, initialiser
a function, value in the payload — a `Date` survives it, a class instance throws by default.
See `nuxt-ssr-state.md`. **This is the single most expensive mistake available in a Nuxt app.**

**`$fetch` in a component body fetches twice.** Once during SSR and again on hydration,
because a bare `$fetch` is not keyed and its result never enters the payload. Use
`useFetch`/`useAsyncData` for anything rendered; keep `$fetch` for event handlers and
server code. See `nuxt-data-fetching.md`.

## Reading

Read the one file that matches what you are touching, not all of them.

| Reading | When |
| --- | --- |
| `nuxt-ssr-state.md` | shared state, `useState`, Pinia under SSR, per-request context, cookies |
| `nuxt-data-fetching.md` | `useFetch`, `useAsyncData`, `$fetch`, keys, double-fetch, caching |
| `nuxt-runtime-config.md` | declaring env-overridable keys, `.env`, `app.config` vs `runtimeConfig` |
| `nuxt-rendering-and-head.md` | hydration mismatch, `<ClientOnly>`, rendering modes, `useHead`/SEO |
| `nuxt-middleware-and-plugins.md` | route middleware, guards, redirects, `app/plugins/` |
| `nuxt-server-routes.md` | `server/api`, Nitro handlers, authorisation, errors, caching |
| `nuxt-versions.md` | "which API is correct on this version", `nuxt typecheck` |
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
- Relying on `.env`, which is not read by a built server → `nuxt-runtime-config.md`

**The request runs twice, or the data refetches for no reason**
- `$fetch` where `useFetch` was meant, or a key that changes every render →
  `nuxt-data-fetching.md`

**A guard lets someone through, or redirects in a loop**
- Middleware running twice, or an error branch that returns nothing →
  `nuxt-middleware-and-plugins.md`

**Meta tags or title are missing from the page source but present in devtools**
- Set after mount instead of during SSR → `nuxt-rendering-and-head.md`

**Types resolve in the editor but fail in CI, or every auto-import is "not found"**
- `.nuxt/` was never generated → `nuxt-versions.md`

## Before reporting done

For anything server-rendered, the manual steps you name include loading the page with
JavaScript disabled or viewing source, because a hydration mismatch and a payload bug are
both invisible in a hydrated DOM.

## What this must NOT do

- **Grow past ~200 lines in this body.** Detail belongs in `references/`, one level
  deep — Claude partial-reads anything reached through a second hop.
- **Restate what the `vue-*` set already says.** Reactivity, Pinia mechanics, query-key
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
