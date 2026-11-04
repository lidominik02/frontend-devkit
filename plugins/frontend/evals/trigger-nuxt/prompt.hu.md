---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---

mióta kiment a bejelentkezés módosítása, telefonált egy vásárló: belépés után a kosároldalán
olyan tételek voltak, amiket sosem tett be, egy idegen rendelése, mondta, és egy másodperccel
később ott voltak a saját tételei. lent a kód, honnan jön ez?

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
