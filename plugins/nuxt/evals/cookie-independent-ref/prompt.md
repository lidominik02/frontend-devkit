---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---

/nuxt:nuxt-engineering

Two sibling components in a Nuxt app both read and write the same cookie:

```ts
// app/components/ThemeToggle.vue (script setup)
const theme = useCookie<'light' | 'dark'>('theme', { default: () => 'light' })
function toggle() { theme.value = theme.value === 'light' ? 'dark' : 'light' }
```

```ts
// app/components/ThemeBadge.vue (script setup)
const theme = useCookie<'light' | 'dark'>('theme', { default: () => 'light' })
```

QA reports: click the toggle, and `ThemeBadge` right next to it still shows the old
value. Waiting a moment, or clicking anything else, makes it catch up.

What's going on, and what would you check?
