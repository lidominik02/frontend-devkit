---
max_turns: 15
allowed_tools: [Read, Glob, Grep]
---

Review this module from a Nuxt application. Server-side rendering is enabled and the app
runs as a Node server behind a load balancer.

```ts
// app/composables/useRecentlyViewed.ts
const recentlyViewed = ref<string[]>([])

export function useRecentlyViewed() {
  function add(id: string) {
    recentlyViewed.value = [id, ...recentlyViewed.value.filter((x) => x !== id)].slice(0, 10)
  }
  return { recentlyViewed, add }
}
```

Is there a problem with it?
