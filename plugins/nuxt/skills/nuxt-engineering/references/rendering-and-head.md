# Rendering, hydration and head

## Hydration, and why it fails quietly

The server sends HTML; the client mounts the same components over it and adopts the
existing DOM. That only works if the client's first render is **identical** to the
server's. When it is not, Vue warns in development ("Hydration node mismatch") and in
production silently discards and re-renders the subtree — so the bug reaches users as a
flash, a lost input, or a wrong value that corrects itself.

Anything that differs between the two renders causes it:

- **Time and dates.** `new Date().toLocaleString()` renders the server's timezone, then
  the browser's. Use `<NuxtTime>`, or format from a fixed timezone, or render the ISO
  string and localise after mount.
- **Randomness.** `Math.random()`, `crypto.randomUUID()`, a shuffled array. For ids, use
  `useId()`, which is stable across the boundary.
- **Browser globals.** `window`, `document`, `localStorage`, `matchMedia` do not exist
  on the server. Reading one during setup either throws at SSR or yields a different
  branch per environment.
- **Invalid HTML nesting.** A `<div>` inside a `<p>`, or a `<p>` inside a `<p>`: the
  browser's parser repairs the server's HTML into a different tree than the one the
  client builds. This produces a mismatch with no obviously wrong code.
- **Anything read from a store or a cookie only on one side.**

## The escape hatches, in order of preference

1. **Make the render deterministic.** Best outcome: the content is in the HTML, indexed
   and visible without JavaScript.
2. **`import.meta.server` / `import.meta.client`** to branch *logic* — a side effect that
   only makes sense in one place. Branching *rendered output* on these re-creates the
   mismatch rather than fixing it.
3. **Move it into `onMounted`.** Runs on the client only, after hydration. The initial
   HTML has the pre-effect state, which must therefore be a sensible thing to show.
4. **`<ClientOnly>`** for a subtree that genuinely cannot render on the server (a map, a
   canvas, a widget touching `window`). Give it a `fallback` with the **same geometry**
   as the real content, or the page shifts layout when it swaps — the skeleton rule from
   the `vue` pack, with an SSR-specific cause.

**Not an escape hatch: moving a time- or locale-derived value into `useState`.** This is
correct alone and wrong in combination with the fix above it. `useState` is per-request,
not per-render — its value is computed once on the server and serialised into the
payload, so a value fixed there stays at the **server's** clock and locale for the rest
of that request's session, never advancing to the visitor's own. It looks like a fix
because the mismatch warning goes away; it has actually removed the client's chance to
ever show its own time. See `ssr-state.md` for what `useState` is and is not for.

`<ClientOnly>` is a cost, not a fix: its content is absent from the HTML, invisible to
crawlers, and unavailable with JavaScript off. Reach for it after the first three.

## Lazy hydration

A component can be server-rendered and have its hydration deferred until it is needed —
visible, idle, interacted with — which keeps the content in the HTML while cutting the
JavaScript that runs at load. This is version-gated and the API has moved; check
`versions.md` before using it. Note that importing a component explicitly from
`#components` opts it out.

## Rendering modes

`ssr: false` in `nuxt.config` makes the whole app client-rendered — at which point the
`vue` pack's SPA rules apply again and most of this pack does not. That is a deliberate
architectural choice, not a fix for a hydration warning.

`routeRules` sets the mode per route: prerender a marketing page at build, SSR the
dashboard, cache an expensive route at the edge. Prefer a route rule to a global switch
when only some routes have the problem.

## Head and SEO

`useHead()` and `useSeoMeta()` set title, meta and link tags. Both must run **during
SSR** to be in the HTML the crawler receives:

```ts
useSeoMeta({ title: order.value.reference, description: () => order.value.summary })
```

- Set head data in setup, not in `onMounted`. Tags added after mount are in devtools and
  in no crawler's index — the symptom is "the tags are there when I inspect but the
  preview is empty".
- Pass a **getter** for anything derived from data that arrives asynchronously, so the
  tag updates when the value does.
- Prefer `useSeoMeta` for standard meta: it is typed, so a misspelled `og:` property is
  a type error rather than a tag nobody notices is missing.
- A `<ClientOnly>` wrapper or `server: false` fetch around the content that feeds the
  title means the crawler gets neither.

## Common failure modes

- A locally-formatted date or `Math.random()` in a rendered template.
- `window`/`localStorage` read during setup instead of `onMounted`.
- Invalid nesting producing a mismatch that looks like a framework bug.
- `<ClientOnly>` with no fallback, or a fallback of a different height.
- `<ClientOnly>` used to silence a warning that a deterministic render would fix.
- Head tags set in `onMounted`, or built from a `server: false` fetch.
- A static string where a getter was needed, so the title never updates.
