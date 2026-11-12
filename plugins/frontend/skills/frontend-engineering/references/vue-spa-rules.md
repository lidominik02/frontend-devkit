# Vue SPA engineering

## Contents
- Rules from the `vue-*` set that do NOT apply here
- Reading
- Symptom router
- What this must NOT do

**This set is a delta.** Everything in the `vue-*` set holds here. This set carries only
what is true of a client-only Vue app, which has no server of its own.

## Rules from the `vue-*` set that do NOT apply here

None.

## Reading

Read the one file that matches what you are touching, not all of them.

| Reading | When |
| --- | --- |
| `vue-spa-env-and-config.md` | `/config.json` at boot, `import.meta.env`, a token held in memory |
| `vue-spa-routing.md` | a `router.beforeEach` guard, typed route meta, lazy routes, the Router 5 imports |
| `vue-spa-data-and-state.md` | the query layer, a query-key factory, a query's reactive input |
| `vue-spa-testing.md` | a component context for composables, mocking HTTP with MSW |
| `vue-spa-versions.md` | Vue Router, the `vue-tsc` gate and TanStack Query on this version |
| `vue-spa-review-checklist.md` | **reviewing a diff** — the findings only a client-only app has |

## Symptom router

**It works in dev and breaks in the deployed build**
- A build option the installed Vite major ignores → the Vite table in `vue-versions.md`

## What this must NOT do

- **Apply Nuxt guidance.** `useFetch`, `useAsyncData`, `useState`, `runtimeConfig`,
  Nitro server routes and Nuxt's built-in auto-imports do not exist here. That guidance
  lives in the `nuxt-*` set; do not import its conclusions into this one.
