# State under SSR

## The inversion

In a client-only SPA every module is instantiated once per browser tab, so module-scope
state is a per-user singleton and is often exactly the right tool. On a Nuxt server the
same module is instantiated once per **process**, and that process serves every request
from every user. The line does not change; its meaning does.

```ts
// app/composables/useRecentlyViewed.ts
const recentlyViewed = ref<string[]>([])          // shared by every visitor

export function useRecentlyViewed() {
  function add(id: string) { recentlyViewed.value = [id, ...recentlyViewed.value] }
  return { recentlyViewed, add }
}
```

That is a cross-request data leak. It never shows up in development, where there is one
user, and it never shows up in a test that renders one page. It shows up as one customer
seeing another customer's data.

The same applies to any module-scope container: a `Map` used as a cache, a `let` holding
the current user, a `QueryClient`, an array of pending requests, a memoisation table
keyed by id.

## `useState`

`useState(key, init)` is a `ref` scoped to the request and serialised into the payload,
so the client resumes with the value the server rendered rather than re-deriving it. The
payload is not plain JSON: a `Date` comes back a `Date`, while a class instance throws on
the default payload — the third rule below.

```ts
// app/composables/useRecentlyViewed.ts
export const useRecentlyViewed = () => useState<string[]>('recently-viewed', () => [])
```

Three rules:

- **The key must be unique across the app**, because it is the payload key. Two
  unrelated `useState('user')` calls are the same piece of state.
- **The initialiser must be a function.** `useState('x', [])` evaluates the array once at
  module load; `useState('x', () => [])` evaluates it per request.
- **The value must be payload-serialisable.** The payload is serialised with devalue, so
  a `Date`, `Map`, `Set` or `RegExp` in `useState` or `useAsyncData` reaches the client
  as itself on every Nuxt 3+ version (Nuxt docs, Data Fetching → Serializing Data From
  Server to Client, checked against Nuxt 4.6.1; Nuxt 3.0 already rendered it with
  `@nuxt/devalue`). `BigInt`, `ref`/`reactive`/`shallowRef`/`shallowReactive`,
  `NuxtError` and a type registered with `definePayloadPlugin` survive only with the
  JSON payload — default since Nuxt 3.5, behind `experimental.renderJsonPayloads` in
  3.4, so not on a project whose `nuxt.config` sets that flag `false`. On that default
  path a function or a class instance throws `Cannot stringify arbitrary non-POJOs`
  during the server render unless a `definePayloadPlugin` reducer/reviver pair registers
  that type (the `useState` docs, Troubleshooting, checked against Nuxt 4.6.1; for a
  function, also the devalue README, checked against devalue 6.0.3). A server
  route is different: its response reaches `$fetch` and `useFetch` as JSON, so a `Date`
  it returns arrives as a string (Nuxt docs, Data Fetching → Serializing Data From API
  Routes, checked against Nuxt 4.6.1).

Wrap it in a composable rather than calling `useState('recently-viewed')` at call sites.
A hand-written key at each site is a typo away from a second, silent piece of state.

Expose a read-only view where callers should not write: `readonly(state)` plus explicit
mutator functions, the same discipline as a store's actions.

## Pinia

Pinia works under SSR through `@pinia/nuxt`, which creates a fresh store instance per
request and hydrates it from the payload. Plain `pinia` installed by hand does not do
that, and a store created at module scope is the leak above with more ceremony.

The client-vs-server split from the `vue` pack still holds: Pinia holds what the client
owns. Server data belongs in `useAsyncData`/`useFetch`, which is already keyed and
already in the payload — see `data-fetching.md`.

## Per-request context

Anything derived from *this* request has to be read from the request, not from a module.

- **`useRequestEvent()`** — the underlying request event on the server, `undefined` on
  the client. Guard before use.
- **`useRequestHeaders(['cookie'])`** — the incoming headers, allowlisted by name.
- **`useRequestFetch()`** — a `$fetch` that forwards the request's context. This is the
  fix for the most common SSR auth bug: a plain `$fetch('/api/me')` on the server sends
  no cookies, because there is no browser attaching them, so it returns 401 or, worse,
  an anonymous response that then gets cached and rendered for a logged-in user.
- **`useCookie(name, opts)`** — an SSR-safe reactive cookie, but **each call returns its
  own ref**, not a shared one. Two components calling `useCookie('theme')` do not read or
  write the same object. They stay in sync anyway — writing to one updates the cookie, and
  Nuxt re-reads it into the other on navigation and, on the client, over a broadcast
  channel — but that sync is asynchronous. Code that writes in one component and reads
  the *other* component's ref on the very next line, expecting the write to already be
  visible, is racing a channel message that has not arrived yet.

A credential must not be put in `useState`. The payload is HTML that reaches the
browser; anything in it is public to that user and to anything that can read the page.

## Common failure modes

- Module-scope `ref`, `Map` or `let` mutated during render — the leak.
- `useState` with a non-function initialiser, giving one shared array again.
- A duplicated `useState` key colliding with unrelated state.
- `$fetch` on the server without `useRequestFetch()`, so the call is unauthenticated.
- A `Date` returned from a server route and read through `useFetch` as if it were still a
  `Date` — it arrives as a string.
- A class instance in `useState` on the default JSON payload, throwing
  `Cannot stringify arbitrary non-POJOs` with no `definePayloadPlugin` reducer/reviver
  registered for it.
- State that is never cleared on logout, so the next render still has it.
