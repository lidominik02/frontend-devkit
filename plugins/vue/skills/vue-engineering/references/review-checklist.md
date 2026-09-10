# Vue review checklist

Read this when reviewing a diff in a Vue codebase. It is the same knowledge as
`SKILL.md`, aimed at finding defects rather than avoiding them.

Vue's worst bugs are **silent**: no stack trace, no failing build, often no visible
error — a value that stops updating, a request that fires twice, a key that leaks one
user's cached data to the next. A generic diff reading will not find them, which is why
this list exists.

This is the plain-Vue list. A Nuxt app has a different set of criticals (SSR-shared
state, hydration mismatch, double-fetch, payload serialisation) and several of them
invert here — module-scope state most of all, which is listed below as *not* a finding
and is Critical under SSR. If the project depends on `nuxt`, review against the `nuxt`
pack's `references/nuxt-review-checklist.md`, which is a delta on this file and states
which of these verdicts it overrides.

## Blocking (Critical)

**A secret in the client bundle.** Any credential, API key or token reachable from
client code — including anything added under a `VITE_` prefix, which is inlined at build
time and readable in devtools. Also flag a token written to `localStorage`, placed in
Pinia state, or put in a query string. There is no server in an SPA, so there is nowhere
safe: the fix is an endpoint you control, not a better hiding place.

**A build that can only serve one environment.** A new `VITE_` variable holding an
environment-specific URL means the artifact you tested is not the artifact you can
promote. Runtime config, not build-time.

**Lost reactivity.** The value silently stops updating:
- passing `props.thing` into a composable instead of `() => props.thing`
- destructuring a `reactive` object without `toRefs`
- destructuring a store without `storeToRefs`
- watching a destructured prop directly rather than via a getter
- a query whose input is a plain value, so it never refetches

**A cache key missing its varying input.** `['user']` where `['user', id]` was meant.
This does not read as a caching bug — it reads as one account seeing another's data.
Flag it Critical.

**Missing error branch on fetched data.** Rendering `data.items` with no error handling.
Also flag rendering an empty state on failure: telling the user "there is nothing here"
when the request failed is worse than an error, because it is confidently wrong.

**Prop mutation.** A component assigning to its own prop.

**Lifecycle or watcher registered after an `await`** in `<script setup>` — it is outside
the setup scope, so hooks never fire and watchers leak.

**No cleanup.** An interval, listener, observer or subscription started in a component
with no matching teardown.

**A route guard that fails open.** A permission check whose error path or missing branch
lets navigation through. Also a new route with no access metadata where the codebase
requires it.

**Unvalidated external input crossing into typed code.** An API response, route param or
form value asserted with `as` instead of parsed. `as` is a claim, not a check.

## Warning

- `watch` used where `computed` was meant — a derived value with an extra tick and a
  stale window.
- A side effect inside a `computed`.
- `v-for` keyed by index where the list reorders or filters.
- A route component imported statically rather than lazily, or a heavy library pulled
  into the entry chunk.
- A loading skeleton whose geometry differs from the loaded content, causing layout
  shift on every load.
- An empty state that is indistinguishable from a loading state.
- A new composable extracted from single-use logic, adding indirection for no reuse.
- Server data copied into a Pinia store, where nothing will invalidate it.
- A hand-written type or enum duplicating something that is generated.
- A hand-edited generated file — the change disappears on the next generation run.
- `deep: true` on data that is only ever replaced wholesale.
- A `data-testid` used where an accessible role or label would have worked.
- Visual change with no dark-mode consideration, in a repo that supports it.
- New interactive markup with no keyboard path, or a client-side navigation that leaves
  focus stranded on the old view.

## What is NOT a finding

- Style the repo is already consistent about.
- A pattern the diff copies from its immediate neighbours, unless it is in the Critical
  list above. Note it as Info and say it is pre-existing.
- Module-scope state in a client-only SPA. It is an ordinary singleton here — the
  cross-request leak that makes it dangerous is an SSR property. If the app is
  server-rendered, this list is the wrong one: the `nuxt` pack's checklist governs, and
  it rates the same code Critical.
- Missing tests in a repo with no test runner. Report the *gap* once, in the report
  header, as a tooling finding — not as a defect on every changed file.
- Preferences about `reactive` versus `ref` where the existing file already chose one.
- A version-specific API that is correct for the version actually installed. Check
  `references/versions.md` before flagging one as wrong.

## Before writing the verdict

A passing `vue-tsc` is weaker evidence than it looks: `strictTemplates` and the
`checkUnknown*` options default to off, so unknown props, unknown components and
misspelled events pass silently. If the repo has not enabled them, say so once in the
report header rather than treating the green run as full template coverage.

Every gate here reads code, so nothing in this checklist has seen the page. A change to
what a user looks at — an empty or error state, a skeleton, focus after a route change —
is unverified until someone loads it, and `/core:verifying-ui` is what loads it. Say which
of the two you did, rather than letting a static pass stand in for both.
