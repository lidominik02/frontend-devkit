# Vue Router in an SPA

## Guards deny by default

The explicit permitted path, on a router you construct:

```ts
router.beforeEach((to) => {
  const required = to.meta.authorities
  if (!required) return true              // deliberately public
  if (!auth.isAuthenticated) return { name: 'login', query: { next: to.fullPath } }
  if (!auth.hasAny(required)) return { name: 'forbidden' }
  return true
})
```

The mandatory route metadata, typed:

```ts
declare module 'vue-router' {
  interface RouteMeta {
    authorities: string[] | null   // null means deliberately public
    breadcrumb?: BreadcrumbItem[]
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

Vue Router 5 absorbed `unplugin-vue-router` into core: typed routes are built in, the
imports moved to `vue-router/vite`, `vue-router/unplugin` and `vue-router/experimental`,
and `unplugin-vue-router/client` must come out of `tsconfig`. On Router 4 the plugin is
still a separate dependency. Check which is installed before writing an import.
