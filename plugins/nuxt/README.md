# nuxt

Nuxt engineering and review knowledge for server-rendered Vue: state that leaks between
requests, `useState`, `useFetch` and `useAsyncData`, the double-fetch on hydration,
`runtimeConfig` public versus private secrets, hydration mismatches, Nitro server routes,
middleware that runs twice. Version-gated, and free of facts about any individual
repository.

Requires `core` and `vue`, and declares both directly.

## A delta on `vue`

Roughly half the guidance inverts between a client-only Vue app and a server-rendered one:
module-scope reactive state is an ordinary singleton in one and a cross-request data leak
in the other. So this pack carries only what server rendering inverts or adds, and names
every [`vue`](../vue/README.md) rule that does not apply here; it does not repeat the rest.
Why: [ADR 0004](../../docs/adr/0004-framework-packs-layer-as-deltas.md).

## Skills

| Skill | | What it does |
| --- | --- | --- |
| `nuxt-engineering` | listed | Applies while writing, refactoring, reviewing or debugging anything in a Nuxt codebase; its references cover SSR state, data fetching, runtime config, rendering and head, server routes, middleware and plugins, versions and an SSR review checklist |

It answers to `/nuxt:nuxt-engineering`.

## Evals

The cases that test whether this pack changes outcomes, including the matched pair that
tests the split itself: [`evals/`](evals/README.md).

## Reading this file

This README is written to be read on GitHub, where its links into `docs/` and the other
packs resolve. An installed copy of the pack carries neither, and `claude plugin details`
does not show this file (observed on Claude Code 2.1.283).
