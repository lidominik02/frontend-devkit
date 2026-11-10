---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---

/frontend:frontend-engineering

A teammate added this hook for the tool library's reservation basket. Review it before it
merges.

```ts
// src/hooks/useBasket.ts
import { useSyncExternalStore } from 'react'

interface Tool {
  id: string
  name: string
}

let basket: Tool[] = []
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function toggleTool(tool: Tool) {
  basket = basket.some((t) => t.id === tool.id)
    ? basket.filter((t) => t.id !== tool.id)
    : [...basket, tool]
  listeners.forEach((listener) => listener())
}

export function useBasket() {
  return useSyncExternalStore(subscribe, () => basket)
}
```

Anything wrong with it?
