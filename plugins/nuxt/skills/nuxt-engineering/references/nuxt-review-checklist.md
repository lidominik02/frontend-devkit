# Review checklist — Nuxt

**This is a delta. Run the `vue` pack's `references/review-checklist.md` first** — lost
reactivity, a cache key missing its varying input, prop mutation, a missing error branch,
an uncleaned watcher, unvalidated external input and a guard failing open are all still
findings here and are not repeated below.

Then apply this list, and the inversions at the bottom, which change the verdict the
`vue` list would give.

## Blocking (Critical)

**State shared across requests.** A `ref`, `reactive`, `Map`, array or `let` declared at
module scope and written during render or in a composable. On the server that value is
per-process, so it is shared by every user. Also: a `QueryClient`, a Pinia instance, or
any cache created at module scope. The fix is `useState`, or per-request context. This is
the highest-severity finding available in a Nuxt diff, and it is invisible in
single-user testing.

**A secret reachable from the client.** Any credential under `runtimeConfig.public`, in a
`NUXT_PUBLIC_*` variable, in `app.config.ts`, or placed in `useState` — the payload is
HTML. Unlike an SPA there *is* somewhere safe here, so the fix is a Nitro route holding
the key, not a better hiding place.

**An endpoint that trusts the caller.** A `server/` handler returning or mutating data
owned by a user or tenant with no ownership check, or one using `readBody`/`getQuery`
without validation. Route middleware does not protect an endpoint; it decides which page
renders. A client-side redirect is not authorisation.

**A cached response that varies per user.** `defineCachedEventHandler` or a `routeRules`
cache over a handler returning user-specific data. This is the cross-request leak again,
delivered by the cache.

**A server-side fetch that drops the request's credentials.** A plain `$fetch` during SSR
sends no cookies, so it is unauthenticated. It either 401s or returns an anonymous
response that then renders — and may be cached — for a logged-in user. Use
`useRequestFetch()`.

**A hydration mismatch.** Locally-formatted dates, `Math.random()`, `crypto.randomUUID()`
for a rendered id, `window`/`localStorage` read during setup, or invalid HTML nesting.
Vue discards and re-renders silently in production, so the symptom reaching users is a
flash or a lost input rather than an error.

**Middleware depending on client-only state.** A guard reading `localStorage` or a store
populated after mount answers differently on the server, and the server pass is what
decides the HTML that ships.

## Warning

- `$fetch` in setup for rendered data — fetched twice, once per render pass.
- `useAsyncData`/`useFetch` with a key missing a varying input, or a key rebuilt every
  render.
- A plain-string URL where a getter was needed, so it never refetches.
- No `transform`/`pick` on a large response — the whole payload ships inside the HTML.
- Deep mutation of `data` on Nuxt 4, where it is a `shallowRef` and will not re-render.
- A private `runtimeConfig` key read from client code — silently `undefined`.
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
- A file moved between the app source directory and the project root without checking
  which major roots it where.
- An explicit `#components` import that opts a component out of lazy hydration.
- A component test using a bare `mount` where `mountSuspended` is needed, or MSW where
  `registerEndpoint` is.

## What is NOT a finding in Nuxt

These four **invert** the `vue` pack's list. Applying that list unchanged produces false
findings here, or misses real ones.

- **An auto-imported `ref`, `computed` or composable with no import statement.** Correct
  here. Do not ask for the import, and do not flag its absence. Adding imports for
  auto-imported symbols is churn, and importing from `#components` has a real cost.
- **A build that serves more than one environment.** In the `vue` list a single-environment
  build is Critical; here it is the normal case, because `runtimeConfig` is read at
  runtime. Do not flag the absence of a `/config.json` boot fetch — adding one is the
  finding.
- **A page component imported statically rather than as a dynamic import.** `app/pages/`
  is already split per file. A hand-written `() => import(...)` has nothing to do.
- **A top-level `await` before a lifecycle hook in a page.** Pages are
  `<Suspense>`-wrapped, so `await useAsyncData(...)` at the top of a page is idiomatic.
  Only hooks and watchers registered *after* the await are the defect the `vue` rule
  describes.

Conversely, one item the `vue` list explicitly excuses is Critical here: module-scope
state. It is listed as "NOT a finding" there because an SPA is client-only. Do not carry
that excuse across.

## Before writing the verdict

Say which gates ran. `nuxt typecheck` is the one that checks templates — a bare
`vue-tsc --noEmit` against a solution-file `tsconfig.json` exits 0 having checked
nothing, so report that as not verifying rather than as a pass, and note that
`strictTemplates` defaults to off. See `references/versions.md`.

For anything server-rendered, static review cannot see a hydration mismatch or a payload
problem. If they were not checked by loading the page and viewing source, say so rather
than implying the render was verified.
