# Vue Router

## Guards deny by default

A guard that returns nothing lets the navigation through. That means a bug in a
permission check — a thrown error swallowed, a branch that falls off the end — fails
open, and the page renders for a user who should never have reached it.

Write guards so the permitted path is the explicit one:

```ts
router.beforeEach((to) => {
  const required = to.meta.authorities
  if (!required) return true              // deliberately public
  if (!auth.isAuthenticated) return { name: 'login', query: { next: to.fullPath } }
  if (!auth.hasAny(required)) return { name: 'forbidden' }
  return true
})
```

Make the metadata mandatory rather than optional, and type it, so a route that forgot to
declare its access is a compile error rather than a public page:

```ts
declare module 'vue-router' {
  interface RouteMeta {
    authorities: string[] | null   // null means deliberately public
    breadcrumb?: BreadcrumbItem[]
  }
}
```

Guards run on every navigation including the first, so keep them cheap. An `await` on a
network call in a global guard delays every route change; resolve the session once at
boot and let the guard read the result.

## Redirect loops

The usual cause is a guard that redirects to a route which the same guard also rejects —
sending an unauthenticated user to `/login` while `/login` itself requires
authentication. Exempt the destination explicitly, and treat "already going there" as a
pass:

```ts
if (to.name === 'login') return true
```

## Lazy routes and chunking

Route components should be dynamic imports so each route is its own chunk:

```ts
{ path: '/reports', component: () => import('@/pages/ReportsPage.vue') }
```

Static-importing one route component pulls it into the entry bundle, which is the most
common reason an SPA's initial download grows without anyone noticing. Anything heavy
and rarely used — a chart library, a rich text editor, a PDF viewer — should be behind a
dynamic import too, not just behind a route.

## Scroll and focus

`scrollBehavior` restores position on back/forward; without it every back navigation
lands at the top, which reads as data loss on a long list.

Focus is the accessibility half of the same problem: a client-side navigation does not
move focus, so a keyboard or screen-reader user stays where they were while the page
changes underneath them. Move focus to the new view's heading on navigation.

## Params are input from outside

Route params and query strings are user-controlled strings. Validate them at the
boundary with the repo's schema library before they reach anything typed — an `id` that
arrives as `undefined` or `"[object Object]"` should fail at the edge, not three layers
in.

Deriving the accepted values from the same schema that describes the API, rather than
hand-writing a second copy, means a backend change surfaces as a type error rather than
an empty page.

## Version note

Vue Router 5 absorbed `unplugin-vue-router` into core: typed routes are built in, the
imports moved to `vue-router/vite`, `vue-router/unplugin` and `vue-router/experimental`,
and `unplugin-vue-router/client` must come out of `tsconfig`. On Router 4 the plugin is
still a separate dependency. Check which is installed before writing an import.
