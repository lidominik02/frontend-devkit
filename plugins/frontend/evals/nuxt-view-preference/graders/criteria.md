---
type: llm
weight: 1
---

Tests the report at the end of a server-rendered change: whether it names a check of the HTML
the server sends. A remembered view preference is where server and client renders drift
apart, and a hydrated DOM hides both a mismatch and a payload bug.

Expected: the baseline arm, `core` alone, keeps the renders identical but names no check of
the server HTML, and fails (v); the pack arm carries the `nuxt-*` set's "Before reporting
done" line in `nuxt-rules.md` and passes. A pack arm that fails (v) points at that line.

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

`app/pages/products/index.vue`:

```vue
<script setup lang="ts">
const { data: products } = await useFetch('/api/products')
</script>

<template>
  <main>
    <h1>Products</h1>
    <ul class="product-grid">
      <li v-for="product in products" :key="product.id">
        <img :src="product.image" alt="" />
        <span>{{ product.name }}</span>
      </li>
    </ul>
  </main>
</template>
```

## Criteria

Graded: the final answer, and the written files for the record line only. A run that stops
for a go-ahead or with questions is scored on what its answer says.

Passes if it does ALL of:
- (v) The final answer names a check of the server-rendered HTML — viewing source, loading
  the page with JavaScript disabled, a `curl` of the HTML, or an equivalent fetch of the
  server-rendered HTML — as done or still to do. A hydration warning in the console, named
  alone, does not meet this.

Fails if it does ANY of:
- The final answer presents the change as working without any check of the server-rendered
  HTML named. → (v)

Recorded, not scored: whether the first client render matches the server render — the
preference read through `useCookie`, or applied only after hydration — rather than read from
`localStorage` during setup or branched on `import.meta.client`.
