# Route middleware and plugins

## Route middleware

| Kind | File | Runs |
| --- | --- | --- |
| Named | `app/middleware/auth.ts` | Only on pages that ask for it |
| Global | `app/middleware/auth.global.ts` | Every route change |
| Inline | inside `definePageMeta` | That page only |

```ts
// app/middleware/auth.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const { loggedIn } = useUserSession()
  if (!loggedIn.value) return navigateTo('/login', { redirectCode: 302 })
})
```

```ts
// app/pages/orders/[id].vue
definePageMeta({ middleware: ['auth'] })
```

Return `navigateTo()` to redirect, `abortNavigation()` to refuse, and nothing to allow.
The deny-by-default warning from the `vue-*` set applies unchanged: **returning nothing
means allow**, so an early `return` on an error path opens the route instead of closing
it. Make every branch explicit.

## The double execution

On a server-rendered or generated app, middleware for the **initial** page runs on the
server during render and then **again on the client** during hydration, so its side
effects happen twice: an analytics event, a counter, or a redirect log in middleware
fires two times for the first navigation and once thereafter.

## Rules that are easy to get wrong

- **Use the `to` argument; never call `useRoute()` inside middleware.** `useRoute()`
  returns the *current* route, which during a navigation is the one being left.
- **Middleware is for redirecting and refusing, not for fetching.** Data belongs in the
  page via `useAsyncData`, where it is keyed and enters the payload. A fetch in
  middleware blocks navigation and is not cached.
- **Do not use middleware to protect data.** It controls which page renders, not who can
  read an endpoint. Authorisation belongs in the Nitro route as well — see
  `nuxt-server-routes.md`. A client-side redirect is a UX affordance; the server route is
  the boundary.
- **Route metadata is version-gated.** Which keys appear on `route.meta`, and how route
  names are generated from filenames, changed between majors. Check
  `nuxt-versions.md` before relying on `route.meta.name`.
- **`scrollBehavior` and focus** live in `app/router.options.ts`, not in a constructed
  router. Focus management after client-side navigation is still your job, and still
  matters — the `vue-*` set's routing notes on that hold.

## Plugins

Files in `app/plugins/` run once when the Nuxt app is created, before mount, and are the
place for anything that must be installed rather than called.

```ts
// app/plugins/error-handler.client.ts
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('vue:error', (err) => { /* report */ })
})
```

- **Suffixes decide where they run.** `.client.ts` skips the server, `.server.ts` skips
  the client, no suffix runs in both. A plugin touching `window` needs `.client`.
- **Ordering is by filename**, so a numeric prefix (`01.setup.ts`) is how ordering is
  expressed. Where one plugin genuinely needs another, declare `dependsOn` rather than
  relying on the prefix.
- **A plugin runs per request on the server.** Anything it assigns to a module-level
  variable is shared across users — the leak in `nuxt-ssr-state.md`. Provide state through
  `nuxtApp` or `useState`.

## Common failure modes

- Middleware side effects firing twice on first load.
- `useRoute()` inside middleware, returning the route being left.
- An error branch that returns nothing, allowing the navigation it meant to refuse.
- Relying on a client redirect while the endpoint stays unauthenticated.
- A `.client`-only plugin that other code assumes ran during SSR.
- Module-scope state in a plugin, shared across requests.
