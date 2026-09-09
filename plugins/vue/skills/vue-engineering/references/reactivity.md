# Reactivity

## ref vs reactive vs shallowRef

`ref` is the default choice. It works for primitives and objects, survives
reassignment, and is obvious at the call site because of `.value`.

`reactive` returns a deeply reactive proxy. Two costs make it the exception:
you cannot reassign the whole object and keep reactivity, and destructuring it
yields plain values that no longer track. Use `toRefs` when you must destructure.

```ts
const state = reactive({ count: 0 })
const { count } = state          // dead — a plain number
const { count } = toRefs(state)  // reactive ref
```

`shallowRef` tracks only `.value` reassignment, not deep mutation. Correct for
large arrays and objects you replace wholesale, and a meaningful performance win
for big lists.

## Crossing a composable boundary

This is the most common silent-reactivity bug in Vue code, and it is silent in
the worst way: everything renders correctly on first paint and then never
updates.

```ts
// wrong — receives a number, tracks nothing
const { data } = useThing(props.id)

// right — receives a getter, keeps tracking
const { data } = useThing(() => props.id)
```

Inside the composable, accept `MaybeRefOrGetter<T>` and resolve with `toValue()`:

```ts
function useThing(id: MaybeRefOrGetter<string>) {
  const result = computed(() => lookup(toValue(id)))
  return { result }
}
```

One exception worth knowing: if a parameter might legitimately BE a function
value, do not use `MaybeRefOrGetter` — `toValue()` would invoke it. Accept
`MaybeRef` and resolve with `unref()` instead.

Composables that accept getters are also far easier to test, which is an
independent reason to write them that way.

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

## computed vs watch vs watchEffect

`computed` for derived values. Cached, lazy, no cleanup, and declarative — the
relationship between inputs and output is visible in one place.

`watch` for side effects with an explicit source. Use it when something outside
the reactive graph must happen: a fetch, a route push, an analytics call.

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
async callback after an `await` is outside the setup scope and will leak.

Lifecycle hooks registered after an `await` in `<script setup>` never fire, for
the same reason. Register them synchronously.

For cleanup tied to a watcher's own re-run, prefer `onWatcherCleanup()` (3.5+)
over the `onCleanup` callback argument — it works from nested functions too.

## Template refs

On 3.5+, `useTemplateRef('name')` is the current API and is what to reach for.
The older pattern — a `ref(null)` whose variable name must match the template
attribute — still works but couples the two by naming convention.

## Common failure modes

- Watching a `reactive` object without `deep`, then wondering why nested changes
  are missed.
- A `watch` that writes to its own source, producing an infinite loop.
- `v-for` keyed by index, causing wrong component reuse on reorder. Key by a
  stable id; index keys are only safe for a list that never reorders or filters.
- Mutating a prop and having it silently overwritten on the next parent render.
- Reading `.value` in a template (templates unwrap refs automatically).
- Passing `props.thing` into a composable instead of `() => props.thing`.
- A `computed` that reads a value mutated outside the reactive system, so it
  never invalidates.
