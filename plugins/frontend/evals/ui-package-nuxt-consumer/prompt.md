---
max_turns: 20
allowed_tools: [Read, Glob, Grep, Skill]
---

/frontend:frontend-engineering

A teammate added this composable to our shared UI package, at
`packages/ui/src/composables/useCompareList.ts`. Shoppers pick up to four products to
compare, and the package's compare bar shows them. Review it before it merges.

```ts
import { computed, ref } from 'vue'

export interface CompareItem {
  id: string
  name: string
}

const compareList = ref<CompareItem[]>([])

export function useCompareList() {
  const isFull = computed(() => compareList.value.length >= 4)

  function add(item: CompareItem) {
    if (isFull.value || compareList.value.some((i) => i.id === item.id)) return
    compareList.value = [...compareList.value, item]
  }

  function remove(id: string) {
    compareList.value = compareList.value.filter((i) => i.id !== id)
  }

  return { compareList, isFull, add, remove }
}
```

Anything wrong with it?
