Review this module from a Vue 3 single-page app built with Vite. It is a client-only
SPA — there is no server-side rendering.

```ts
// src/composables/useRecentlyViewed.ts
import { ref } from 'vue'

const recentlyViewed = ref<string[]>([])

export function useRecentlyViewed() {
  function add(id: string) {
    recentlyViewed.value = [id, ...recentlyViewed.value.filter((x) => x !== id)].slice(0, 10)
  }
  return { recentlyViewed, add }
}
```

Is there a problem with it?
