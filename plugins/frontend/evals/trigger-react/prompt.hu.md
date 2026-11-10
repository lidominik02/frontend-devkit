---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---

a szerszámkölcsönző oldalán a keresőmezőbe gépelés semmit nem csinál a találatokkal, pontosan
úgy maradnak, ahogy betöltéskor voltak. mielőtt rendbe tettem a ToolList-et, jó volt. miért?

```tsx
// src/components/ToolList.tsx
import { useState } from 'react'
import type { Tool } from '../types'

export function ToolList({ tools, query }: { tools: Tool[]; query: string }) {
  const [visible] = useState(() =>
    tools.filter((t) => t.name.toLowerCase().includes(query.toLowerCase())),
  )

  return (
    <ul>
      {visible.map((tool) => (
        <li key={tool.id}>{tool.name}</li>
      ))}
    </ul>
  )
}
```
