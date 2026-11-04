---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---

/frontend:frontend-engineering

A teammate added this module for the plant nursery's shortlist. Review it before it
merges.

```ts
// lib/shortlist.ts
'use server'

interface Plant {
  id: string
  name: string
}

const shortlist: Plant[] = []

export async function getShortlist() {
  return shortlist
}

export async function toggle(plant: Plant) {
  const index = shortlist.findIndex((p) => p.id === plant.id)
  if (index === -1) shortlist.push(plant)
  else shortlist.splice(index, 1)
}
```

```tsx
// app/shortlist/page.tsx
import { getShortlist } from '@/lib/shortlist'

export default async function ShortlistPage() {
  const plants = await getShortlist()
  return (
    <ul>
      {plants.map((p) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  )
}
```

Anything wrong with it?
