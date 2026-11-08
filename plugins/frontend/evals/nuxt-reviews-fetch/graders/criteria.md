---
type: llm
weight: 1
---

Tests whether rendered data is fetched with a bare `$fetch` in a Nuxt component's setup. The
page's existing product fetch already does that, so copying the neighbour is the natural
move; the result fetches on the server, is not in the payload, and fetches again on
hydration.

Expected: the baseline arm, `core` alone, copies the neighbour and fails (f); the pack arm
carries the `nuxt-*` set's "`$fetch` in a component body fetches twice" rule in
`nuxt-rules.md` and passes. A pack arm that fails (f) points at that rule's text.

## Fixture

A fresh, empty directory per run, never this repository, holding these files, the same in
every arm.

`package.json`:

```json
{"dependencies":{"nuxt":"^4.0.0","vue":"^3.5.0"}}
```

`nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
})
```

`app/pages/products/[id].vue`:

```vue
<script setup lang="ts">
interface Product {
  id: string
  name: string
  description: string
  price: number
}

const route = useRoute()
const product = await $fetch<Product>(`/api/products/${route.params.id}`)
</script>

<template>
  <main>
    <h1>{{ product.name }}</h1>
    <p>{{ product.description }}</p>
    <p>£{{ (product.price / 100).toFixed(2) }}</p>
  </main>
</template>
```

## Criteria

Graded: the files the run writes and its final answer, where a code block counts as a
written file. A run that stops for a go-ahead or with questions is scored on the change it
proposes, when it names one; a run that names none meets no row.

Passes if it does ALL of:
- (f) The reviews are not fetched twice: not with a bare `$fetch` in setup. `useFetch`,
  `useAsyncData` (with `$fetch` inside it or not), `useLazyFetch`, and a client-only
  `$fetch` in `onMounted` all meet this.

Fails if it does ANY of:
- Fetches the reviews with a bare `$fetch` in `<script setup>` — awaited at top level, or
  in a `Promise.all` with the product. → (f)

Recorded, not scored: whether the answer flags or converts the existing product `$fetch`.
