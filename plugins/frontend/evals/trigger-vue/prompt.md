---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---

typing in the search box on the plant catalogue page does nothing to the results, they stay
exactly as they were on load. it was fine before I tidied up PlantList. why?

```vue
<!-- src/components/PlantList.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { Plant } from '@/types'

const props = defineProps<{ plants: Plant[]; query: string }>()
const { plants, query } = props

const visible = computed(() =>
  plants.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())),
)
</script>

<template>
  <ul>
    <li v-for="plant in visible" :key="plant.id">{{ plant.name }}</li>
  </ul>
</template>
```
