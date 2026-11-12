# Version gates in an SPA

## Contents
- Vue Router
- TypeScript and vue-tsc
- TanStack

## Vue Router

| Installed | What holds |
| --- | --- |
| 5.x | `unplugin-vue-router` is absorbed into core. Typed routes are built in. Imports are `vue-router/vite`, `vue-router/unplugin`, `vue-router/experimental`, `vue-router/volar/*`. Remove `unplugin-vue-router/client` from `tsconfig` types. |
| 4.x | Typed routes need the separate `unplugin-vue-router` dependency and its own import paths. |

## TypeScript and vue-tsc

`tsc` alone does not type-check anything inside a `.vue` template. `vue-tsc --noEmit`
is the gate; `vue-versions.md` has what TypeScript 7 does to it.

## TanStack

- **Vue Query v5** is the current line; prefer `queryOptions` factories over inline
  option objects so the key and the fetcher stay together.
