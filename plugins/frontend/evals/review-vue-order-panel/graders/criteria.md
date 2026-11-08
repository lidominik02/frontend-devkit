---
type: llm
weight: 1
---

A review with several seeded defects in a Vue SPA. The row under test is (q): server data
copied into a Pinia store, with its own loading flag and reload, while the app already
installs a query layer.

Expected: the baseline arm, `core` alone, finds the other defects but usually leaves the
store as it is, and fails (q); the pack arm carries the `vue-*` review checklist's "Server
data copied into a Pinia store" and the data-and-state split it relies on, and passes. A
pack arm that fails (q) points at that text.

## Fixture

A fresh, empty directory per run, never this repository, holding these files, the same in
every arm.

`package.json`:

```json
{"scripts":{"typecheck":"vue-tsc --noEmit"},"dependencies":{"vue":"^3.5.0","pinia":"^3.0.0","@tanstack/vue-query":"^5.0.0"},"devDependencies":{"typescript":"^5.9.0","vue-tsc":"^3.0.0"}}
```

`tsconfig.json`:

```json
{"compilerOptions":{"strict":true,"target":"ES2022","module":"ESNext","moduleResolution":"bundler","jsx":"preserve","noEmit":true},"include":["src/**/*.ts","src/**/*.vue"]}
```

`src/main.ts`:

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import App from './App.vue'

createApp(App).use(createPinia()).use(VueQueryPlugin).mount('#app')
```

## Criteria

Graded: the final answer.

Passes if it does ALL of:
- (q) Flags the orders list copied into a Pinia store with its own `loaded`/`reload`, when
  `@tanstack/vue-query` is installed and set up, and points at a query (`useQuery` with a
  key) instead. Any severity counts.

Fails if it does ANY of:
- Leaves the store as it is, or proposes moving more server data into Pinia, with no word
  about the installed query layer. → (q)

Recorded, not scored: whether the review also flags the watch-derived `total`, the
destructured `reactive` filters, the mutated `order` prop, and the stale `variant` prop that
the default `vue-tsc` settings let through.
