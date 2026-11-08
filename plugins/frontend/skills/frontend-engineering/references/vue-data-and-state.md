# Data and state

## The split that governs everything else

**Server state** is data the server owns and you are borrowing: it can be stale, it can
fail, it needs refetching, and two components asking for the same thing should get one
request. **Client state** is data the app owns: the open tab, the draft, the sidebar.

Copying server state into a store turns a cache problem into a synchronisation problem.
The store has no idea the data went stale, so you end up hand-writing invalidation,
loading flags and refetch triggers — badly, and in every feature separately.

| Need | Use |
| --- | --- |
| UI state shared across routes | Pinia setup store |
| UI state for one subtree | `provide`/`inject` or props |
| UI state for one component | `ref` in that component |

## Query keys

A cache is only as good as its key. Two rules follow:

- **The key must contain every input that changes the result.** `['user']` is wrong;
  `['user', id]` is right. A key missing its varying input serves one user's data to the
  next, and the bug looks like a caching glitch rather than the data leak it is.
- **Order the key from general to specific**, so a prefix is a meaningful group:
  `['tenant', tenantId, 'invoices', page]` lets you invalidate everything for a tenant
  with the prefix alone.

## Every fetch has four states

`data`, `error`, `pending`, and empty-but-successful. A component that renders
`data.items` with no error branch throws on the first backend hiccup, and an empty list
rendered as a blank panel reads as a broken page.

Handle all four, and verify them rather than assuming: force an error by pointing the
call at a failing endpoint or flipping the mock's error rate, and empty the fixture to
see the empty state. A state nobody has looked at is a state that does not work.

Keep the loading skeleton the same shape and size as the loaded content. A skeleton with
different geometry produces a layout shift on every load, which is both a Core Web
Vitals problem and the single most visible sign of an unconsidered UI.

## Pinia

Use setup stores, for consistency with `<script setup>`:

```ts
export const useCartStore = defineStore('cart', () => {
  const items = ref<Item[]>([])
  const total = computed(() => items.value.reduce((s, i) => s + i.price, 0))
  function add(item: Item) { items.value.push(item) }
  return { items, total, add }
})
```

- **Destructure with `storeToRefs`.** `const { items } = useCartStore()` gives a plain
  array that stops updating; `storeToRefs` keeps the refs. Actions are the exception —
  they destructure fine, because they are not reactive state.
- **A store is not a dumping ground** for anything awkward to pass down. If only one
  subtree needs it, `provide`/`inject` is cheaper and the ownership is visible.
- **Do not put a token or any credential in a store.** Devtools serialise state.

## Errors

Funnel API failures through one handler so the mapping from status to user-facing
behaviour is written once: 401 refreshes or redirects, 403 explains, 429 surfaces the
limit, 5xx says the service is unavailable. Scattering that logic across call sites
guarantees inconsistency, and inconsistency in error handling is what makes an app feel
unreliable even when it mostly works.

Distinguish "the request failed" from "there is nothing here" all the way to the UI. A
list that renders empty on error is telling the user something false.
