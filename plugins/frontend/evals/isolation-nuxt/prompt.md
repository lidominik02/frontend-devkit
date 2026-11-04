---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---

/frontend:frontend-engineering

A teammate added this composable for the plant nursery's shortlist. Review it before it
merges.

```ts
// src/composables/useShortlist.ts
import { computed, ref } from 'vue'

interface Plant {
  id: string
  name: string
}

const shortlist = ref<Plant[]>([])

export function useShortlist() {
  const count = computed(() => shortlist.value.length)

  function toggle(plant: Plant) {
    const exists = shortlist.value.some((p) => p.id === plant.id)
    shortlist.value = exists
      ? shortlist.value.filter((p) => p.id !== plant.id)
      : [...shortlist.value, plant]
  }

  return { shortlist, count, toggle }
}
```

Anything wrong with it?
