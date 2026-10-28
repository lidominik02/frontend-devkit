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

**Nothing prefixed `VITE_` is a secret.** Vite inlines those values into the bundle at
build time, so they are readable by anyone who opens devtools, and one build cannot
serve two environments. Config that varies per environment is fetched at runtime; see
`vue-env-and-config.md`. This is the single most expensive mistake available in a
Vite app.

**Prefer `computed` over `watch`.** A watcher that only derives a value is a `computed`
written the hard way, and it adds a tick, a stale window and a cleanup obligation. Reach
for `watch` when you need a side effect, not when you need a value.

**Keep state as `ref`.** `ref` is the default. Use `reactive` only for a stable object
you never reassign, and remember destructuring it drops reactivity unless you go through
`toRefs`. `shallowRef` for large structures you replace wholesale.

**Cross a composable boundary with a getter, never a value.** `useThing(props.id)`
receives a number and stops tracking; `useThing(() => props.id)` keeps working. Resolve
it inside with `toValue()`. This is the most common silent-reactivity bug in Vue code.

**Never mutate props.** Data flows down; changes go up through emits or `defineModel`.

**Server state is not client state.** Data that lives on a server belongs in a query
layer with a cache key, not copied into a store where it goes stale. Pinia holds what
the client owns. See `vue-data-and-state.md`.

**Imports are explicit unless `vite.config.*` imports an auto-import plugin.**
Plain Vite auto-imports nothing, so if you write `ref` you import it; explicit is the
default because Nuxt habits leak into a plain Vue app. The signal is the plugin package
imported in `vite.config.*`, whatever its binding is named. The common opt-ins are
`unplugin-auto-import`, which auto-imports APIs and composables, and
`unplugin-vue-components`, which registers components — not a closed list: any Vite
plugin there that auto-imports or auto-registers counts. The exemption holds only for what
its config covers, defaults included (`imports`
presets; `dirs`, which for `unplugin-vue-components` is `src/components` when none is
given; resolvers); there the neighbouring files' convention decides — match it. See
`vue-imports-and-structure.md`.

**Type at the boundary.** Validate anything arriving from outside — API responses, route
params, form input, `postMessage` — with the schema library the repo already uses.
Inside the boundary, trust your types.

## Reading

Read the one file that matches what you are touching, not all of them.

| Reading | When |
| --- | --- |
| `vue-reactivity.md` | refs, computed, watchers, props, `reactive` |
| `vue-env-and-config.md` | env vars, secrets, per-environment config, Vite build |
| `vue-routing.md` | Vue Router, guards, route meta, lazy routes |
| `vue-data-and-state.md` | fetching, caching, Pinia, server vs client state |
| `vue-imports-and-structure.md` | file layout, barrels, package boundaries |
| `vue-testing.md` | Vitest, `@vue/test-utils`, what is worth testing |
| `vue-versions.md` | "which API is correct on this version" |
| `vue-review-checklist.md` | **reviewing a diff** — what to look for, by severity |

## Symptom router

Route by what is actually happening, not by which API you suspect.

**The value stops updating**
- A prop passed into a composable as a value → `vue-reactivity.md`
- Destructured a `reactive` object → `vue-reactivity.md`
- Watching a destructured prop directly → `vue-reactivity.md`
- A store property destructured without `storeToRefs` → `vue-data-and-state.md`

**It renders once and never again, or updates one tick late**
- `watch` used where `computed` was meant → `vue-reactivity.md`
- Reading the DOM before it has been patched (`flush` timing) → `vue-reactivity.md`

**It works in dev and breaks in the deployed build**
- A `VITE_` value baked in at build time → `vue-env-and-config.md`
- A dependency resolved differently by the bundler → `vue-versions.md`

**A secret is visible in the browser**
- `vue-env-and-config.md`, immediately

**The wrong component keeps its state when the list reorders**
- `v-for` keyed by index → `vue-reactivity.md`

**Lifecycle hooks never fire, or a watcher leaks**
- Registered after an `await` in a plain `async setup()` or in a callback → `vue-reactivity.md`

**Navigation does nothing, or a guard loops**
- `vue-routing.md`

**The page flashes empty, or shows stale data after navigating back**
- Cache key does not include the varying input → `vue-data-and-state.md`

**Type errors appear in CI but not locally, or a template error is never caught**
- Template checks are off by default → `vue-versions.md`

## Before reporting done

Run the project's own gates as `core`'s project.md describes; a gate you did not run is
NOT RUN.

If the repo has no type-check, no lint and no tests, say so explicitly rather than
implying the change is verified. A Vue codebase without `vue-tsc` has no compiler
checking its templates at all. And `vue-tsc` alone is weaker than it looks:
`strictTemplates` and the `checkUnknown*` options default to **off**, so an unknown prop
or a misspelled event passes silently. Name the manual steps you relied on instead,
including dark mode wherever anything visual changed.

Do not claim a gate passed that you did not run.

## What this must NOT do

- **Grow past ~200 lines in this body.** Detail belongs in `references/`, one level
  deep — Claude partial-reads anything reached through a second hop.
- **Contain facts about any individual repository** — no file paths, helper names or
  conventions from a specific codebase. Those belong in that repo's own `CLAUDE.md` or
  project-local skills. This set must stay true of *any* Vue app.
- **Apply Nuxt guidance.** `useFetch`, `useAsyncData`, `useState`, `runtimeConfig`,
  Nitro server routes and Nuxt's built-in auto-imports do not exist here, and
  module-scope state is an ordinary singleton in an SPA rather than the cross-request
  leak it is under SSR. That guidance lives in the `nuxt-*` set; do not import its
  conclusions into this one.
- **State a version-gated API as fact** without checking what is installed.
- **Bulk-convert files the task did not ask about** — no drive-by TypeScript migrations
  or refactors of adjacent code.
- **Invent a gate command.** Read `package.json`'s scripts instead.
