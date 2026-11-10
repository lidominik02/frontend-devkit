---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---

/frontend:frontend-engineering

Review this module and the code that uses it before I merge it.

```ts
// src/lib/current-member.ts
export type Member = { id: string; name: string }

let currentMember: Member | null = null

export function setCurrentMember(member: Member | null) {
  currentMember = member
}

export function getCurrentMember() {
  return currentMember
}
```

Is there a problem with it?
