# Data fetching

The general rules from the `vue` pack still hold: a cache key must contain every input
that changes the result, keys read general-to-specific, and every fetch has four states.
What changes here is that Nuxt already ships the query layer, and getting the choice
between its three entry points wrong costs a duplicate request on every page load.

## Which one

| Use | When |
| --- | --- |
| `useFetch(url)` | Data the template renders, fetched from a URL |
| `useAsyncData(key, fn)` | Data the template renders, from anything that is not a plain URL |
| `$fetch(url)` | An event handler, a server route, or a call whose result is not rendered |

`useFetch` is `useAsyncData` with the key and the URL wired together — it is not a
different mechanism.

## The double-fetch

`$fetch` in a component's setup runs during SSR, and then runs **again** on the client
during hydration, because nothing keyed the result and nothing put it in the payload.
The page works, so this is invisible: it just costs every user two requests and every
API two hits.

```ts
const { data } = await useFetch('/api/orders')   // fetched once, transferred
const orders = await $fetch('/api/orders')       // fetched twice
```

`$fetch` inside `onMounted`, a click handler, or a server route is correct — those run
in one place only.

## Keys

`useAsyncData` requires a key and `useFetch` derives one from the URL and options. The
key is the payload key and the dedup identity, so:

- **Two calls with the same key are the same request.** On Nuxt 4 they also share the
  same `data`, `error` and `status` refs, so a second component calling `useFetch` with
  the same URL gets the first one's state rather than its own copy. Usually what you
  want; surprising if you expected independence.
- **A key that omits a varying input serves the wrong data.** Interpolate the input:
  `useAsyncData(() => \`order-\${id.value}\`, () => fetchOrder(id.value))`.
- **A key that changes every render refetches forever.** Do not build one from an object
  literal or `Date.now()`.

## Reactive inputs

A URL passed as a plain string is resolved once. Pass a getter or a computed so the
request re-runs when its input changes, and add `watch` for inputs the URL does not
contain:

```ts
const { data } = await useFetch(() => `/api/orders/${id.value}`)
const { data: list } = await useFetch('/api/orders', { query: { page }, watch: [page] })
```

This is the same getter-across-a-boundary rule as the `vue` pack's composables: a value
captures a snapshot, a getter keeps tracking.

## The options that matter

- **`lazy`** — do not block navigation on this request. The template must then handle
  `pending`, because `data` starts null.
- **`server: false`** — skip it during SSR, fetch on the client only. The data is not in
  the payload and not in the page source, so do not use it for anything a crawler or a
  no-JavaScript reader needs.
- **`immediate: false`** — do not fetch until something calls `execute()`.
- **`transform`** / **`pick`** — shrink the response *before* it enters the payload.
  This is the lever for payload size: without it the entire API response is serialised
  into the HTML, whether the template uses it or not.
- **`getCachedData`** — return an already-known value instead of refetching. It receives
  the reason it was called, so a manual refresh can bypass the cache while a route
  revisit uses it.
- **`default`** — an initial value, so the template does not branch on null.

## The returned handles

`data`, `status`, `error`, `refresh`, `execute`, `clear`. Prefer `status`
(`idle`/`pending`/`success`/`error`) over the older boolean, and distinguish an error
from an empty result — a failed request and a legitimately empty list must not render
the same, which is the `vue` pack's rule and no less true here.

`refresh()` re-runs one call; `refreshNuxtData()` invalidates by key across the app.
After a mutation, refresh the affected key rather than reloading the route.

## Deep vs shallow

On Nuxt 4 `data` is a `shallowRef`, so mutating a nested property does not trigger a
re-render. Replace the value (`data.value = { ...data.value, x }`) rather than mutating
into it. See `references/versions.md` for the major-by-major position.

## Common failure modes

- `$fetch` in setup for rendered data — the double-fetch.
- A key missing its varying input, so one order's data renders for another.
- A key built fresh every render, refetching in a loop.
- A plain-string URL that never re-fetches when its input changes.
- No `transform`/`pick`, so the whole response ships in the HTML.
- Deep-mutating `data` on Nuxt 4 and seeing no update.
- Adding TanStack Query alongside this and paying for every request twice.
- A server-side `$fetch` to an internal route with no forwarded cookies — see
  `references/ssr-state.md`.
