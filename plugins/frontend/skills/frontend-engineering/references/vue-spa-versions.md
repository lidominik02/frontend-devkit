# Version gates in an SPA

## Contents
- Vue Router
- Vite
- TypeScript and vue-tsc
- TanStack

## Vue Router

| Installed | What holds |
| --- | --- |
| 5.x | `unplugin-vue-router` is absorbed into core. Typed routes are built in. Imports are `vue-router/vite`, `vue-router/unplugin`, `vue-router/experimental`, `vue-router/volar/*`. Remove `unplugin-vue-router/client` from `tsconfig` types. |
| 4.x | Typed routes need the separate `unplugin-vue-router` dependency and its own import paths. |

## Vite

| Installed | What holds |
| --- | --- |
| 8.x | Rolldown-based and ESM-only. The build option is **`rolldownOptions`**, not `rollupOptions`. A config carried over from an older major silently ignores the old key. |
| 5–7 | `rollupOptions`. |

## TypeScript and vue-tsc

`tsc` alone does not type-check anything inside a `.vue` template. `vue-tsc --noEmit`
is the gate.

`vue-tsc` needs TypeScript's stable programmatic compiler API, which the 7.x line does
not ship. A repo pinned to TypeScript 6 has usually done so deliberately — an
"upgrade" to 7 silently removes template type-checking altogether.

## TanStack

- **Vue Query v5** is the current line; prefer `queryOptions` factories over inline
  option objects so the key and the fetcher stay together.
