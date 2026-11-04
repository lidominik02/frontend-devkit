---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---

a növénykatalógus oldalán a keresőmezőbe gépelés semmit nem csinál a találatokkal, pontosan
úgy maradnak, ahogy betöltéskor voltak. mielőtt rendbe tettem a PlantList-et, jó volt. miért?

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
