---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---

since the login change went out, a customer phoned in: right after signing in, her basket
page held items she had never added, a stranger's order she said, and a second later her
own items were there. code below, where is that coming from?

```ts
// composables/useBasket.ts
interface BasketItem {
  id: string
  name: string
  quantity: number
}

const basket = ref<BasketItem[]>([])

export function useBasket() {
  async function load() {
    basket.value = await $fetch<BasketItem[]>('/api/basket')
  }
  return { basket, load }
}
```

```vue
<!-- pages/basket.vue -->
<script setup lang="ts">
const { basket, load } = useBasket()
await load()
</script>

<template>
  <ul>
    <li v-for="item in basket" :key="item.id">{{ item.quantity }} × {{ item.name }}</li>
  </ul>
</template>
```
