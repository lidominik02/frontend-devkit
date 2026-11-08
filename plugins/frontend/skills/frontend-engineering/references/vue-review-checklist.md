# Vue review checklist

## Contents
- Blocking (Critical)
- Warning
- What is NOT a finding
- Before writing the verdict

Read this when reviewing a diff in a Vue codebase. It is the `vue-*` set's knowledge,
aimed at finding defects rather than avoiding them.

Vue's worst bugs are **silent**: no stack trace, no failing build, often no visible
error — a value that stops updating, a request that fires twice, a key that leaks one
user's cached data to the next. A generic diff reading will not find them, which is why
this list exists.

## Blocking (Critical)

**A secret in the client bundle.** A secret credential — a private API key, token or
password — reachable from client code. Also flag a secret token —
including a user's session or access token — written to `localStorage`, placed in Pinia
state, or put in a query string.

**Lost reactivity.** The value silently stops updating:
- destructuring a store without `storeToRefs`
- watching a destructured prop directly rather than via a getter
- a query whose input is a plain value, so it never refetches

**A cache key missing its varying input.** `['user']` where `['user', id]` was meant.
This does not read as a caching bug — it reads as one account seeing another's data.
Flag it Critical.

**Missing error branch on fetched data.** Rendering `data.items` with no error handling.
Also flag rendering an empty state on failure: telling the user "there is nothing here"
when the request failed is worse than an error, because it is confidently wrong.

**Lifecycle or watcher registered after an `await`** in a plain `async setup()` or inside
an async callback — outside the setup scope, so hooks never fire and watchers leak. Not a
top-level `await` in `<script setup>` under `<Suspense>`, which keeps the instance (documented
for `<script setup>`, stable since Vue 3.2); a top-level `await` with no `<Suspense>`
ancestor is the finding instead.

**A route guard that fails open.** A permission check whose error path or missing branch
lets navigation through. Also a new route with no access metadata where the codebase
requires it.

## Warning

- A side effect inside a `computed`.
- `v-for` keyed by index where the list reorders or filters.
- A new composable extracted from single-use logic, adding indirection for no reuse.
- Server data copied into a Pinia store, where nothing will invalidate it.
- `deep: true` on data that is only ever replaced wholesale.

## What is NOT a finding

- Style the repo is already consistent about.
- A pattern the diff copies from its immediate neighbours, unless it is in the Critical
  list above or in that of `web-review.md`. Note it as Info and say it is pre-existing.
- Missing tests in a repo with no test runner. Report the *gap* once, in the report
  header, as a tooling finding — not as a defect on every changed file.
- A version-specific API that is correct for the version actually installed. Check
  `vue-versions.md` before flagging one as wrong.

## Before writing the verdict

Every gate here reads code, so nothing in this checklist has seen the page. A change to
what a user looks at — an empty or error state, a skeleton, focus after a route change —
is unverified until someone loads it, and `/frontend:verifying-ui` is what loads it. Say which
of the two you did, rather than letting a static pass stand in for both.
