---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---

/frontend:frontend-engineering

Please review this PR before it merges. Description: "Adds partner payouts: a page that
lists payouts and a button that requests one. CI's `pnpm typecheck` is green."

```ts
// nuxt.config.ts (changed)
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  runtimeConfig: {
    payoutsWebhookSecret: '',
    public: {
      payoutsApiUrl: '',
      // the provider's secret API key, set per environment through NUXT_PUBLIC_PAYOUTS_API_KEY
      payoutsApiKey: '',
    },
  },
})
```

```ts
// app/plugins/remote-config.client.ts (new)
export default defineNuxtPlugin(async () => {
  // staging and production get different values; the same image is promoted between them
  const res = await fetch('/config.json', { cache: 'no-store' })
  const remoteConfig = await res.json()
  return { provide: { remoteConfig } }
})
```

```ts
// app/plugins/vue-query.ts (new)
import { QueryClient, VueQueryPlugin, dehydrate, hydrate, type DehydratedState } from '@tanstack/vue-query'

export default defineNuxtPlugin((nuxtApp) => {
  const state = useState<DehydratedState | null>('vue-query')
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })
  nuxtApp.vueApp.use(VueQueryPlugin, { queryClient })
  if (import.meta.server) {
    nuxtApp.hooks.hook('app:rendered', () => {
      state.value = dehydrate(queryClient)
    })
  }
  if (import.meta.client) hydrate(queryClient, state.value)
})
```

```ts
// server/api/payouts.post.ts (new)
export default defineEventHandler(async (event) => {
  const body = await readBody<{ partnerId: string; amount: number }>(event)
  const config = useRuntimeConfig(event)
  return await $fetch(`${config.public.payoutsApiUrl}/payouts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.public.payoutsApiKey}` },
    body: { partner: body.partnerId, amount: body.amount },
  })
})
```

```vue
<!-- app/pages/payouts.vue (new) -->
<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'

const config = useRuntimeConfig()
const webhookConfigured = Boolean(config.payoutsWebhookSecret)

const { data: payouts, suspense } = useQuery({
  queryKey: ['payouts'],
  queryFn: () => $fetch('/api/payouts', { headers: useRequestHeaders(['cookie']) }),
})
await suspense()
</script>

<template>
  <main>
    <h1>Payouts</h1>
    <p v-if="!webhookConfigured">Webhook not configured.</p>
    <ul>
      <li v-for="payout in payouts" :key="payout.id">{{ payout.amount }}</li>
    </ul>
  </main>
</template>
```
