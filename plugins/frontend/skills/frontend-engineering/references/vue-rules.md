# Vue 3 engineering

## Contents
- Before applying any version-gated rule, check what is installed
- The rules that prevent most bugs
- Reading
- Symptom router
- Before reporting done
- What this must NOT do

Write code that looks like the rest of the codebase you are in. Read the neighbouring
files first, reuse existing composables and components before writing new ones, and keep
changes surgical.

## Before applying any version-gated rule, check what is installed

Vue's ecosystem broke several defaults across recent majors, and the wrong half of a
version-gated rule is worse than no rule. Read the resolved version of `vue`,
`vue-router`, `pinia`, `vite`, `typescript`, `tailwindcss`, `vue-tsc` and any
`@tanstack/vue-*` package from the lockfile or `node_modules/<pkg>/package.json`; a
`package.json` range is only a range. Resolved version unknown: claim no exact version,
and say so in the answer.

In a monorepo the framework lives in a workspace package, not the root — read what the
lockfile resolved for that package, or the `node_modules/<pkg>/package.json` nearest to
it. `vue-versions.md` has the table of what changes between majors; read it
whenever the answer to "which API is correct here" depends on a number.

## The rules that prevent most bugs

**Type at the boundary.** Validate anything arriving from outside — API responses, route
params, form input, `postMessage` — with the schema library the repo already uses.
Inside the boundary, trust your types.

## Reading

Read the one file that matches what you are touching, not all of them.

| Reading | When |
| --- | --- |
| `vue-reactivity.md` | watchers, destructured props, cleanup, shared bindings, template refs |
| `vue-env-and-config.md` | secrets, tokens in the browser, build-time facts |
| `vue-routing.md` | Vue Router, guards, route meta |
| `vue-data-and-state.md` | fetching, caching, Pinia, server vs client state |
| `vue-forms.md` | forms: submit status, touched fields, server field errors |
| `vue-imports-and-structure.md` | file layout, barrels, package boundaries |
| `vue-testing.md` | Vitest, `@vue/test-utils`, what is worth testing |
| `vue-versions.md` | "which API is correct on this version" |
| `vue-review-checklist.md` | **reviewing a diff** — what to look for, by severity |

## Symptom router

Route by what is actually happening, not by which API you suspect.

**The value stops updating**
- Watching a destructured prop directly → `vue-reactivity.md`
- A store property destructured without `storeToRefs` → `vue-data-and-state.md`

**It renders once and never again, or updates one tick late**
- Reading the DOM before it has been patched (`flush` timing) → `vue-reactivity.md`

**The wrong component keeps its state when the list reorders**
- `v-for` keyed by index → `vue-reactivity.md`

**Lifecycle hooks never fire, or a watcher leaks**
- Registered after an `await` in a plain `async setup()` or in a callback → `vue-reactivity.md`

**Navigation does nothing, or a guard loops**
- `vue-routing.md`

**The page flashes empty, or shows stale data after navigating back**
- Cache key does not include the varying input → `vue-data-and-state.md`

**A form submits twice, stays on "Saving…", or keeps an error the user already fixed**
- `vue-forms.md`

## Before reporting done

Name the manual steps you relied on, including dark mode wherever anything visual
changed.

## What this must NOT do

- **State a version-gated API as fact** without checking what is installed.
- **Bulk-convert files the task did not ask about** — no drive-by TypeScript migrations
  or refactors of adjacent code.
- **Invent a gate command.** Read `package.json`'s scripts instead.
