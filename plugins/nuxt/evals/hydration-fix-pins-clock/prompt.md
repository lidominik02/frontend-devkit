---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---

/nuxt:nuxt-engineering

A teammate hit a hydration mismatch warning on this Nuxt page — the rendered time didn't
match between server and client — and opened this diff to fix it:

```diff
- const now = new Date()
+ const now = useState('page-loaded-at', () => new Date())
```

```html
<template>
  <p>Loaded at {{ now.toLocaleTimeString() }}</p>
</template>
```

The warning is gone and they want to merge it. Does this fix hold up?
