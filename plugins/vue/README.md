# vue

Vue 3 engineering and review knowledge for single-page apps on Vite: reactivity that
silently stops updating, composables, Vue Router guards, client versus server state,
build-time config and secrets that reach the browser bundle, explicit imports, testing. It
reads the installed versions of Vue, Vue Router, Pinia, Vite and TypeScript rather than
assuming them, and carries no facts about any individual repository.

Requires `core`, which enabling `vue` installs and enables with it.

For a server-rendered Nuxt app, enable [`nuxt`](../nuxt/README.md) instead; it brings
`vue` with it and says which of these rules do not apply under SSR.

## Skills

| Skill | | What it does |
| --- | --- | --- |
| `vue-engineering` | listed | Applies while writing, refactoring, reviewing or debugging anything in a Vue codebase; its references cover reactivity, data and state, routing, env and config, imports and structure, testing, versions and a review checklist |

It answers to `/vue:vue-engineering`.

## Evals

The cases that test whether this pack changes outcomes: [`evals/`](evals/README.md).

## Reading this file

This README is written to be read on GitHub, where its links into `docs/` and the other
packs resolve. An installed copy of the pack carries neither, and `claude plugin details`
does not show this file (observed on Claude Code 2.1.283).
