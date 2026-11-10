---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---

typing in the search box on the tool library page does nothing to the results, they stay
exactly as they were on load. it was fine before I tidied up ToolList. why?

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
