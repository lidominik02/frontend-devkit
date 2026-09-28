---
name: vue-engineering
description: >-
  Vue 3 engineering and review knowledge for plain Vue single-page apps on Vite:
  reactivity that silently stops updating, composables, Vue Router guards, client versus
  server state, build-time config and secrets that reach the browser bundle, explicit
  imports, testing. Use whenever writing, refactoring, reviewing or debugging anything in
  a Vue codebase — components, composables, stores, routes, config — even for a small
  change, and for symptoms like "the list stops updating", "the value is stale", "it
  works until I reload". For a server-rendered Nuxt app, use nuxt-engineering instead.
paths:
  - "**/*.vue"
  - "**/vite.config.*"
  - "**/composables/**"
  - "**/stores/**"
  - "**/router/**"
---

# Vue 3 engineering

**First, if this project depends on `nuxt`: stop and call the Skill tool with
"nuxt:nuxt-engineering" instead.**
This pack is for plain Vue on Vite, and roughly half of what follows inverts under
server rendering — module-scope state, auto-imports, secrets, and where server data
belongs. The `nuxt` pack is a delta on this one and names every rule here that does not
apply there. Applying this file to a Nuxt app produces confidently wrong code, because
each rule below is correct and more specific-sounding than the one that replaces it.

Write code that looks like the rest of the codebase you are in. Read the neighbouring
files first, reuse existing composables and components before writing new ones, and keep
changes surgical.

## Before applying any version-gated rule, check what is installed

Vue's ecosystem broke several defaults across recent majors, and the wrong half of a
version-gated rule is worse than no rule. One command:

```
node -p "Object.entries({...require('./package.json').dependencies,...require('./package.json').devDependencies}).filter(([k])=>/^(vue|vue-router|pinia|vite|typescript|tailwindcss|vue-tsc|@tanstack\/vue-)/.test(k)).map(e=>e.join('@')).join('\n')"
```

In a monorepo the framework lives in a workspace package, not the root — read that
package's `package.json` instead. `references/versions.md` has the table of what changes
between majors; read it whenever the answer to "which API is correct here" depends on a
number.

## The rules that prevent most bugs

**Nothing prefixed `VITE_` is a secret.** Vite inlines those values into the bundle at
build time, so they are readable by anyone who opens devtools, and one build cannot
serve two environments. Config that varies per environment is fetched at runtime; see
`references/env-and-config.md`. This is the single most expensive mistake available in a
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
the client owns. See `references/data-and-state.md`.

**Imports are explicit.** There are no auto-imports outside Nuxt. If you write `ref` you
import it. Code that relies on auto-import compiles nowhere.

**Type at the boundary.** Validate anything arriving from outside — API responses, route
params, form input, `postMessage` — with the schema library the repo already uses.
Inside the boundary, trust your types.

## Reading

Read the one file that matches what you are touching, not all of them.

| Reading | When |
| --- | --- |
| `references/reactivity.md` | refs, computed, watchers, props, `reactive` |
| `references/env-and-config.md` | env vars, secrets, per-environment config, Vite build |
| `references/routing.md` | Vue Router, guards, route meta, lazy routes |
| `references/data-and-state.md` | fetching, caching, Pinia, server vs client state |
| `references/imports-and-structure.md` | file layout, barrels, package boundaries |
| `references/testing.md` | Vitest, `@vue/test-utils`, what is worth testing |
| `references/versions.md` | "which API is correct on this version" |
| `references/review-checklist.md` | **reviewing a diff** — what to look for, by severity |

## Symptom router

Route by what is actually happening, not by which API you suspect.

**The value stops updating**
- A prop passed into a composable as a value → `references/reactivity.md`
- Destructured a `reactive` object → `references/reactivity.md`
- Watching a destructured prop directly → `references/reactivity.md`
- A store property destructured without `storeToRefs` → `references/data-and-state.md`

**It renders once and never again, or updates one tick late**
- `watch` used where `computed` was meant → `references/reactivity.md`
- Reading the DOM before it has been patched (`flush` timing) → `references/reactivity.md`

**It works in dev and breaks in the deployed build**
- A `VITE_` value baked in at build time → `references/env-and-config.md`
- A dependency resolved differently by the bundler → `references/versions.md`

**A secret is visible in the browser**
- `references/env-and-config.md`, immediately

**The wrong component keeps its state when the list reorders**
- `v-for` keyed by index → `references/reactivity.md`

**Lifecycle hooks never fire, or a watcher leaks**
- Registered after an `await` in `<script setup>` → `references/reactivity.md`

**Navigation does nothing, or a guard loops**
- `references/routing.md`

**The page flashes empty, or shows stale data after navigating back**
- Cache key does not include the varying input → `references/data-and-state.md`

**Type errors appear in CI but not locally, or a template error is never caught**
- Template checks are off by default → `references/versions.md`

## Before reporting done

Run this project's own gates. The `core` plugin — a hard dependency of this one — ships
`run-gates.mjs`, which discovers them from `package.json` and reports anything absent as
NOT RUN. The script belongs to `core`, so its path is never guessed: core's `implementer`
agent and its `reviewing-changes` and `describing-changes` skills run it at their own
steps. Failing that, read the `scripts` block yourself and run what is actually there.
**A gate reported `not-run` with `blocking: true` did not run — the tool is missing or
the script hangs. That is a setup defect, not a passing gate.**

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
  project-local skills. This pack must stay true of *any* Vue app.
- **Apply Nuxt guidance.** `useFetch`, `useAsyncData`, `useState`, `runtimeConfig`,
  Nitro server routes and auto-imports do not exist here, and module-scope state is an
  ordinary singleton in an SPA rather than the cross-request leak it is under SSR. That
  guidance lives in the `nuxt` pack; call the Skill tool with "nuxt:nuxt-engineering"
  rather than importing its conclusions into this one.
- **State a version-gated API as fact** without checking what is installed.
- **Bulk-convert files the task did not ask about** — no drive-by TypeScript migrations
  or refactors of adjacent code.
- **Invent a gate command.** Ask `run-gates.mjs --list` what this project has.
