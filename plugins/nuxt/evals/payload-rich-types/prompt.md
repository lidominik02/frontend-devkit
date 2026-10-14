---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---

/nuxt:nuxt-engineering

This Nuxt app's lockfile resolves `nuxt` to 4.6.1. A page keeps its filter state in
`useState`:

```ts
const filters = useState('filters', () => ({
  since: new Date(),
  tags: new Set(['new']),
}))
```

```html
<template>
  <p>Since {{ filters.since.toISOString() }}</p>
  <p v-if="filters.tags.has('new')">Showing new items</p>
</template>
```

In review, a teammate commented: "State goes through the Nuxt payload, so on the client
`since` arrives as a string and `tags` as a plain `{}`. Both need converting back to a
`Date` and a `Set` before use."

Is the teammate right? Should the code change?
