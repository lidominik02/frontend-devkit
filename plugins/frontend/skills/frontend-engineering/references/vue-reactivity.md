# Reactivity

## Contents
- Props destructuring
- watchEffect and flush timing
- Cleanup and ownership
- Template refs
- Common failure modes

## Props destructuring

Reactive props destructuring was stabilized in Vue 3.5 and is on by default, so
variables destructured from `defineProps` in `<script setup>` stay reactive when
you *read* them.

The catch: the destructured identifier is reactive on access, but it is **not a
reactive source**. Anything that needs a source — a watcher, a composable
argument — needs a getter.

```ts
const { count } = defineProps<{ count: number }>()
watch(() => count, (n) => { /* correct */ })
watch(count, () => {})              // wrong — watching a number
useThing(() => count)               // correct
useThing(count)                     // wrong — loses reactivity
```

On a codebase pinned below 3.5, destructured props are not reactive at all.
Check the installed version before relying on this.

## watchEffect and flush timing

`watchEffect` for side effects whose dependencies are awkward to enumerate. The
tradeoff is that its dependency set is implicit, so it is easier to trigger
accidentally. Prefer explicit `watch` when you can name the sources.

Never put a side effect in a `computed`. It will run at unpredictable times,
because a computed evaluates lazily and caches.

Flush timing matters when you read the DOM:

- default (`pre`) runs before render — the DOM is still stale
- `flush: 'post'` runs after render — correct for measuring elements
- `flush: 'sync'` fires immediately and repeatedly; almost never what you want

## Cleanup and ownership

Anything you start in a component must stop when it unmounts: intervals,
listeners, observers, subscriptions. `watch` and `watchEffect` return a stop
handle and auto-stop when created during setup — but a watcher created inside an
async callback, or after an `await` in a plain `async setup()` function, is outside
the setup scope and will leak.

A lifecycle hook registered there never fires, for the same reason: register it
synchronously. A top-level `await` in `<script setup>` is the exception — the compiler
restores the component instance after it, as the SFC docs state for `<script setup>`
(stable since Vue 3.2) — so a hook or watcher after that `await` works under the
`<Suspense>` ancestor such a component needs; flag a missing `<Suspense>`, not the hook.

For cleanup tied to a watcher's own re-run, prefer `onWatcherCleanup()` (3.5+)
over the `onCleanup` callback argument — it works from nested functions too.

## Template refs

On 3.5+, `useTemplateRef('name')` is the current API and is what to reach for.
The older pattern — a `ref(null)` whose variable name must match the template
attribute — still works but couples the two by naming convention.

## Common failure modes

- A `watch` that writes to its own source, producing an infinite loop.
- `v-for` keyed by index, causing wrong component reuse on reorder. Key by a
  stable id; index keys are only safe for a list that never reorders or filters.
- Reading `.value` in a template (templates unwrap refs automatically).
- A `computed` that reads a value mutated outside the reactive system, so it
  never invalidates.
