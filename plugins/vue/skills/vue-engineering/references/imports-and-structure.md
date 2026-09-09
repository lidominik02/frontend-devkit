# Imports and structure

## Imports are explicit

There are no auto-imports outside Nuxt. Every `ref`, `computed`, `watch`, component and
composable is imported where it is used. Code written against auto-imports does not
compile here, and it is one of the most common ways Nuxt habits leak into a plain Vue
app.

Use `import type` for type-only imports. With `verbatimModuleSyntax` enabled — the
current default in fresh setups — a type imported as a value is a build error, and a
value imported as a type is erased and fails at runtime.

## Barrels versus subpaths

A barrel (`index.ts` re-exporting everything) is convenient and costs you tree-shaking
precision: importing one symbol can pull the module graph of everything the barrel
touches, and circular imports become easy to create and hard to see.

The workable compromise, and what most well-organised Vue codebases converge on:

- **A curated barrel** for the handful of things consumers genuinely use as a set.
- **Subpath imports** for everything else — `@pkg/ui/components/button` rather than
  reaching through the root.

What matters more than which you choose is that the codebase does one of them
consistently. Read the neighbouring imports and match them.

## Package boundaries, if there are packages

In a monorepo the dependency direction is the architecture. The app depends on the
design system, the schemas and the mocks; none of them depends on the app. The moment
the design system imports the router or the store, it stops being reusable and starts
being a second copy of the app.

Enforce it mechanically rather than by convention — ESLint `no-restricted-imports`
scoped by path is enough, and it converts a review argument into a build error:

```js
{
  files: ['packages/ui/src/**'],
  rules: { 'no-restricted-imports': ['error', { paths: ['vue-router', 'pinia'] }] },
}
```

One gotcha specific to flat config: a later block **replaces** `no-restricted-imports`
rather than merging with it. Hoist the shared list into a constant and spread it into
each block, or the global rule silently disappears wherever a scoped one applies.

## Where code goes

- **`components/`** — presentational and reusable. Props in, events out. No knowledge of
  routes or stores.
- **`composables/`** — reusable reactive logic. No DOM assumptions.
- **`stores/`** — client state genuinely shared across unrelated routes.
- **`pages/` or `views/`** — route-level composition. This is where a route may read
  stores and query data.
- **`api/`** — one place that knows how to talk to the server: base URL, auth header,
  error shape, response validation.

Feature-first beats type-first once a feature owns more than a couple of files: a
`features/billing/` directory holding its components, composables and schemas keeps the
blast radius of a change visible. Reserve the top-level type directories for things that
are genuinely shared.

## Extract on the second occurrence, not the first

A composable extracted from single-use logic adds indirection that the next reader pays
for and buys nothing. Extract when logic is genuinely reused, or when isolating it makes
it testable in a way it was not before.

The same applies to component splitting. Split when a component owns two distinct
concerns, when a section is reused, or when a file has grown past comfortable reading —
not to hit a line count. A 2,000-line component and a component split into fifteen
one-purpose files that only ever appear together are both failures, in opposite
directions.

## Generated code

If any part of the codebase is generated — an API client, schemas from an OpenAPI spec,
route types — it is read-only. Hand-editing it produces a change that disappears on the
next generation run, silently. If a generated type is wrong, the source spec is wrong.

Where a generated artifact exists, prefer deriving from it over restating it. A status
enum extracted from the generated schema cannot drift; a hand-written copy of the same
list will.
