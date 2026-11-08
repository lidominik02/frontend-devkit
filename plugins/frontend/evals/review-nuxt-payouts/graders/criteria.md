---
type: llm
weight: 1
---

A review with several seeded defects in a Nuxt app. The rows under test are (q), a second
query layer next to `useFetch`/`useAsyncData`, and (c), a green typecheck that checks
nothing because the root `tsconfig.json` is a solution file.

The baseline arm, `core` alone, is expected to find the security defects but call the
TanStack setup fine and never say why the typecheck is green. The pack arm carries the
`nuxt-*` set's text for both rows: the review checklist's Warning on a second client query
layer with the data-fetching notes behind it, for (q), and the checklist's typecheck note
with `nuxt-versions.md`, for (c). A pack arm that fails a row points at that text.

## Fixture

A fresh, empty directory per run, never this repository, holding these files, the same in
every arm.

`package.json`:

```json
{"scripts":{"build":"nuxt build","typecheck":"vue-tsc --noEmit"},"dependencies":{"nuxt":"^4.0.0","vue":"^3.5.0","@tanstack/vue-query":"^5.0.0"},"devDependencies":{"typescript":"^5.9.0","vue-tsc":"^3.0.0"}}
```

`tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./.nuxt/tsconfig.app.json" },
    { "path": "./.nuxt/tsconfig.server.json" },
    { "path": "./.nuxt/tsconfig.shared.json" },
    { "path": "./.nuxt/tsconfig.node.json" }
  ]
}
```

## Criteria

Graded: the final answer.

Passes if it does ALL of:
- (q) Says the page does not need TanStack Query here: `useFetch`/`useAsyncData` already key,
  dedupe and transfer the data, so the second query layer adds cost. Any severity counts; a
  question that only notes "a second way of fetching" without saying what `useFetch`
  already provides does not meet (q).
- (c) Says the green `pnpm typecheck` proves nothing: `vue-tsc --noEmit` against this
  solution-file `tsconfig.json` (`files: []` plus `references`) checks no file, or the
  referenced `.nuxt/` configs do not exist on a CI checkout; the fix is `nuxt typecheck` (or
  build mode after `nuxt prepare`).

Fails if it does ANY of:
- Calls the TanStack setup fine with no word about `useFetch`/`useAsyncData` already doing
  the job. → (q)
- Explains the green typecheck only by other causes (loose types, private keys typed on the
  client) without the solution-file one. → (c)

Recorded, not scored: whether the review also flags the secret under `runtimeConfig.public`,
the boot-time `/config.json` fetch, the private key read in the page, the unvalidated body,
and whether it says which checks it ran.
