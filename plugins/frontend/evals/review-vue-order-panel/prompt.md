---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---

/frontend:frontend-engineering

Please review this PR before it merges. Description: "Adds the order detail panel with a
status filter. `pnpm typecheck` passes."

```ts
// src/stores/orders.ts (new)
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchOrders, type Order } from '../api/orders'

export const useOrdersStore = defineStore('orders', () => {
  const orders = ref<Order[]>([])
  const loaded = ref(false)

  async function load() {
    if (loaded.value) return
    orders.value = await fetchOrders()
    loaded.value = true
  }

  async function reload() {
    orders.value = await fetchOrders()
  }

  return { orders, loaded, load, reload }
})
```

```ts
// src/composables/useOrderFilters.ts (new)
import { reactive } from 'vue'

const filters = reactive({ status: 'open' as 'open' | 'paid', search: '' })

export function useOrderFilters() {
  return filters
}
```

```vue
<!-- src/components/OrderFilterBar.vue (new) -->
<script setup lang="ts">
import { useOrderFilters } from '../composables/useOrderFilters'

const filters = useOrderFilters()
</script>

<template>
  <select v-model="filters.status">
    <option value="open">Open</option>
    <option value="paid">Paid</option>
  </select>
  <input v-model="filters.search" type="search" />
</template>
```

```vue
<!-- src/components/OrderBadge.vue (changed: the `variant` prop is renamed to `tone`) -->
<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'neutral' | 'danger' }>(), { tone: 'neutral' })
</script>

<template>
  <span class="badge" :class="`badge--${tone}`"><slot /></span>
</template>
```

```vue
<!-- src/components/OrderNotes.vue (new) -->
<script setup lang="ts">
import { ref } from 'vue'
import type { Order } from '../api/orders'

const props = defineProps<{ order: Order }>()
const draft = ref(props.order.notes)

function save() {
  props.order.notes = draft.value
}
</script>

<template>
  <textarea v-model="draft" />
  <button type="button" @click="save">Save notes</button>
</template>
```

```vue
<!-- src/components/OrderDetail.vue (new) -->
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import OrderBadge from './OrderBadge.vue'
import OrderNotes from './OrderNotes.vue'
import { useOrdersStore } from '../stores/orders'
import { useOrderFilters } from '../composables/useOrderFilters'

const props = defineProps<{ orderId: string }>()

const store = useOrdersStore()
const { orders } = storeToRefs(store)
onMounted(() => store.load())

const { status, search } = useOrderFilters()

const order = ref(orders.value.find((o) => o.id === props.orderId))
watch(orders, (list) => {
  order.value = list.find((o) => o.id === props.orderId)
})

const total = ref(0)
watch(
  () => order.value?.lines,
  (lines) => {
    total.value = (lines ?? []).reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
  },
  { immediate: true },
)
</script>

<template>
  <section v-if="order">
    <h2>{{ order.reference }} <OrderBadge :variant="order.overdue ? 'danger' : 'neutral'" /></h2>
    <p>Showing {{ status }} orders matching "{{ search }}"</p>
    <p>Total: {{ total }}</p>
    <OrderNotes :order="order" />
  </section>
</template>
```
