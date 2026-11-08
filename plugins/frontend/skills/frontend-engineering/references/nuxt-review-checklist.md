# Review checklist — Nuxt

## Contents
- Blocking (Critical)
- Warning
- Before writing the verdict

**This is a delta. Run the `vue-*` set's review checklist first**
— lost reactivity, a cache key missing its varying input, a missing error branch, an
uncleaned watcher, unvalidated external input, a guard failing open and every item of
`web-review.md` are all still findings here and are not repeated below.

Then apply this list.

## Blocking (Critical)

**State shared across requests.** A `ref`, `reactive`, `Map`, array or `let` declared at
module scope and written during render or in a composable. On the server that value is
per-process, so it is shared by every user. Also: a `QueryClient`, a Pinia instance, or
any cache created at module scope. The fix is `useState`, or per-request context. This is
the highest-severity finding available in a Nuxt diff, and it is invisible in
single-user testing.

**A secret in `app.config.ts` or `useState`.** Both reach the browser: `app.config.ts` is
bundled, and the `useState` payload is HTML.

**An endpoint that trusts the caller.** A `server/` handler returning or mutating data
owned by a user or tenant with no ownership check. Route middleware does not protect an
endpoint; it decides which page renders. A client-side redirect is not authorisation.

**A cached response that varies per user.** `defineCachedEventHandler` or a `routeRules`
cache over a handler returning user-specific data. This is the cross-request leak again,
delivered by the cache.

**A server-side fetch that drops the request's credentials.** A plain `$fetch` during SSR
sends no cookies, so it is unauthenticated. It either 401s or returns an anonymous
response that then renders — and may be cached — for a logged-in user. Use
`useRequestFetch()`.

**A hydration mismatch from a locally formatted date or invalid HTML nesting.** Vue
discards and re-renders silently in production, so the symptom reaching users is a flash
or a lost input rather than an error.

## Warning

- `$fetch` in setup for rendered data — fetched twice, once per render pass.
- `useAsyncData`/`useFetch` with a key missing a varying input, or a key rebuilt every
  render.
- A plain-string URL where a getter was needed, so it never refetches.
- A second client query layer, such as TanStack Query, added next to `useFetch`/
  `useAsyncData` for data they already key, dedupe and carry in the payload — use the
  built-in one. See `nuxt-data-fetching.md`.
- No `transform`/`pick` on a large response — the whole payload ships inside the HTML.
- Deep mutation of `data` on Nuxt 4, where it is a `shallowRef` and will not re-render.
- An environment variable with no declared key in `nuxt.config`, so the override is
  ignored.
- Configuration that exists only in `.env`, which a built server does not read.
- `<ClientOnly>` with no `fallback`, or a fallback of different geometry — layout shift.
- `<ClientOnly>` used to silence a mismatch a deterministic render would fix.
- Head or SEO tags set in `onMounted`, or built from a `server: false` fetch — absent
  from the HTML a crawler receives.
- A static value passed to `useSeoMeta` where a getter was needed.
- A `server/` handler with no method suffix, answering every verb.
- `403` where `404` would avoid confirming a resource exists.
- An internal error message returned in `statusMessage`.
- `server/middleware/` returning a value, ending unrelated requests.
- `useRoute()` called inside middleware instead of using `to`.
- Middleware performing a fetch that belongs in the page.
- A `.client`-suffixed plugin whose effect other code assumes ran during SSR.
- Module-scope state in a plugin.
- A component test using a bare `mount` where `mountSuspended` is needed, or MSW where
  `registerEndpoint` is.

## Before writing the verdict

`nuxt typecheck` is the gate that checks templates — a bare `vue-tsc --noEmit` against a
solution-file `tsconfig.json` exits 0 having checked nothing, so report that as not
verifying rather than as a pass. See `nuxt-versions.md`.

For anything server-rendered, static review cannot see a hydration mismatch or a payload
problem. If they were not checked by loading the page and viewing source, say so rather
than implying the render was verified. `/frontend:verifying-ui` is what checks them — a
hydration mismatch shows as a flash of replaced content plus a console warning, and both
need a browser attached. Naming it turns "not verified" into something the reader can act
on instead of a disclaimer.
