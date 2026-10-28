# frontend

Frontend engineering and review knowledge for Vue 3, Nuxt and Next.js. One router skill,
`frontend-engineering`, reads each workspace's `package.json`, selects that framework's
rules, and loads only that set: the `vue-*` set for a Vue app on Vite, `vue-*` as base with
`nuxt-*` as delta for a Nuxt app. Next.js has no set yet; its API facts come from the
documentation the installed package ships. Version-gated, and free of facts about any
individual repository.

Depends on no other plugin.

Install it from your shell; the first time, the command also adds the marketplace:

```
claude plugin install frontend --marketplace lidominik02/frontend-devkit
```

Then turn auto-update on for the marketplace, or no release reaches you
([Install](../../docs/installation.md#install)).

## Why one router

Much of the guidance inverts between frameworks: module-scope state is an ordinary
singleton in a client-only Vue app and a cross-request data leak in a server-rendered one.
Choosing once, from the manifest, keeps the rules of a framework the workspace does not use
out of the context, and keeps the listing at one description however many frameworks there
are. Why: [ADR 0016](../../docs/adr/0016-framework-rules-chosen-per-workspace.md).

## Skills

| Skill | | What it does |
| --- | --- | --- |
| `frontend-engineering` | listed | Applies while writing, refactoring, reviewing or debugging anything in a Vue, Nuxt or Next.js codebase; selects the framework's rules per workspace and reads `<framework>-rules.md` first, then topic references on demand |

It answers to `/frontend:frontend-engineering`.

## Reading this file

This README is written to be read on GitHub, where its links into `docs/` resolve. An
installed copy of the plugin carries neither, and `claude plugin details` does not show
this file.
