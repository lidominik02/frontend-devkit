# Version gates

This file exists because the Vue ecosystem changed several defaults across recent
majors, and stating one version's API as fact makes the guidance wrong in any repo on
the other side of the line. **Read the installed version before applying anything
here.** Where a row and the repo disagree, the repo wins.

Everything below is a fact about a version boundary, not a recommendation to upgrade.

## Vue

| Installed | What holds |
| --- | --- |
| 3.5+ | Reactive props destructure is on by default — reactive on *read*, but the identifier is not a reactive source, so watchers and composables still need `() => prop`. `useTemplateRef`, `useId`, `onWatcherCleanup` available. Deferred teleport. |
| below 3.5 | Destructured props are **not reactive at all**. `useTemplateRef` does not exist; use the name-matched `ref(null)` pattern. |
| 3.6 (RC only) | Vapor Mode lives here. It is pre-release, entirely opt-in, and has no guide page on vuejs.org. Do not write Vapor-specific code, and do not assume a 3.6 install has it enabled. |

3.5.x is the current stable line. Treat anything Vapor-related as a note, never a
default.

## Vue Router

| Installed | What holds |
| --- | --- |
| 5.x | `unplugin-vue-router` is absorbed into core. Typed routes are built in. Imports are `vue-router/vite`, `vue-router/unplugin`, `vue-router/experimental`, `vue-router/volar/*`. Remove `unplugin-vue-router/client` from `tsconfig` types. |
| 4.x | Typed routes need the separate `unplugin-vue-router` dependency and its own import paths. |

## Pinia

| Installed | What holds |
| --- | --- |
| 4.x | Requires `@vue/devtools-api` as a peer dependency — a missing peer shows up as a devtools failure, not a build error. |
| 3.x | No such peer. |

Setup stores are the right style on both.

## Vite

| Installed | What holds |
| --- | --- |
| 8.x | Rolldown-based and ESM-only. The build option is **`rolldownOptions`**, not `rollupOptions`. A config carried over from an older major silently ignores the old key. |
| 5–7 | `rollupOptions`. |

## TypeScript and vue-tsc

`tsc` alone does not type-check anything inside a `.vue` template. `vue-tsc --noEmit`
is the gate.

**All of the template checks default to `false`**, and they live under
`vueCompilerOptions`, not `compilerOptions`:

```jsonc
{
  "vueCompilerOptions": {
    "strictTemplates": true,
    "checkUnknownComponents": true,
    "checkUnknownProps": true,
    "checkUnknownEvents": true,
    "checkUnknownDirectives": true,
    "strictVModel": true
  }
}
```

Without these, a misspelled prop, an unknown component and a nonexistent event all pass.
A green `vue-tsc` on default settings is a much weaker claim than it appears, and
saying "type-check passed" on that basis overstates what was verified.

`vue-tsc` needs TypeScript's stable programmatic compiler API, which the 7.x line does
not ship. A repo pinned to TypeScript 6 has usually done so deliberately — an
"upgrade" to 7 silently removes template type-checking altogether.

## Tailwind

| Installed | What holds |
| --- | --- |
| 4.x | CSS-first. There is no `tailwind.config.js`. Theme lives in CSS via `@theme`, and content scanning is driven by `@source` globs in the stylesheet. In a monorepo an `@source` glob must point at each sibling package whose files use Tailwind classes: without it, every class used only in that package is stripped from the build. |
| 3.x | `tailwind.config.js` with a `content` array. |

## TanStack

- **Vue Table v9** renamed the composable to `useTable` and replaced the
  `getCoreRowModel()`-style setup with `tableFeatures({...})`. v8 code does not run on
  v9 and the error is not obvious.
- **Vue Query v5** is the current line; prefer `queryOptions` factories over inline
  option objects so the key and the fetcher stay together.

## Component libraries

`radix-vue` was renamed **`reka-ui`**. A codebase may contain both during a migration —
check which one an existing component imports before adding a sibling.

## Lint and format

`eslint-plugin-vue` v10 targets flat config. Two things that bite:

- In flat config a later block **replaces** rules like `no-restricted-imports` rather
  than merging them. Hoist shared lists into constants and spread them.
- **oxlint does not lint `<template>` and oxfmt does not support `.vue` at all.** They
  run alongside ESLint and Prettier on a Vue project, not instead of them. `create-vue`
  configures exactly that arrangement.

## Vitest

5.x requires Node ≥ 22.12 and Vite ≥ 6.4. Browser Mode lost its experimental tag in 4.x.
