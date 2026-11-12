# Vue Router in an SPA

## Guards deny by default

The explicit permitted path, on a router you construct:

```ts
router.beforeEach((to) => {
  const required = to.meta.authorities
  if (required === null) return true      // deliberately public
  if (!auth.isAuthenticated) return { name: 'login', query: { next: to.fullPath } }
  if (!required || !auth.hasAny(required)) return { name: 'forbidden' }  // no metadata: denied
  return true
})
```

The mandatory route metadata, typed:

```ts
declare module 'vue-router' {
  interface RouteMeta {
    authorities: string[] | null   // null means deliberately public
  }
}
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

## Version note

Typed routes and their import paths differ between Vue Router 4 and 5; the Vue Router
table in `vue-spa-versions.md` has what holds on each. Check which is installed before
writing an import.
