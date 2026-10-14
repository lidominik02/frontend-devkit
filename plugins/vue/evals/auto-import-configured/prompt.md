---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---

/vue:vue-engineering

Review this component from a Vue 3 single-page app built with Vite. It is a client-only
SPA — there is no server-side rendering. `BaseButton` is `src/components/BaseButton.vue`.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({ imports: ['vue', 'vue-router'], dts: true }),
    Components(),
  ],
})
```

```vue
<!-- src/components/CartSummary.vue -->
<script setup lang="ts">
const props = defineProps<{ prices: number[] }>()

const expanded = ref(false)
const count = computed(() => props.prices.length)
const total = computed(() => props.prices.reduce((sum, price) => sum + price, 0))
</script>

<template>
  <section>
    <p>{{ total }} for {{ count }} items</p>
    <BaseButton @click="expanded = !expanded">{{ expanded ? 'Hide' : 'Show' }} prices</BaseButton>
    <ul v-if="expanded">
      <li v-for="(price, index) in prices" :key="index">{{ price }}</li>
    </ul>
  </section>
</template>
```

Is this ready to merge?
