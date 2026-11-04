---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---

/frontend:frontend-engineering

In a Vue 3 single-page app, a settings panel should save the user's notification
preferences whenever one of them changes. The preferences live in a `reactive` object,
and the save is wired up like this:

```ts
const prefs = reactive({
  notifications: { email: true, sms: false, digest: 'weekly' },
  theme: 'light',
})

watch(() => prefs.notifications, () => {
  savePreferences(prefs.notifications)
})
```

The toggles bind with `v-model="prefs.notifications.email"`,
`v-model="prefs.notifications.sms"` and `v-model="prefs.notifications.digest"`. Flipping
any of them updates the UI, so the reactive state does change, but the watcher's callback
never fires: a log on its first line never prints, and `savePreferences` never runs.

Why does Vue's reactivity not trigger this watcher, and what is the fix? A teammate suggests `watch(prefs.notifications, …)` instead of
the getter. Would that fire when a toggle changes, or does it need `deep: true` as well?
