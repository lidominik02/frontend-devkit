# frontend

Frontend engineering and review knowledge for Vue 3, Nuxt and Next.js. One router skill,
`frontend-engineering`, reads each workspace's `package.json`, selects one framework's set of
references — a set that specialises another is loaded after its base and wins a conflict —
and loads nothing of the others; before a review verdict it also reads `web-review.md`, the
findings that do not depend on the framework, whichever set is selected. The selection
table in [`frontend-engineering/SKILL.md`](skills/frontend-engineering/SKILL.md) is the
only place a base and its delta are paired. Next.js has no set yet; its API facts come from
the documentation the installed package ships. Version-gated, and free of facts about any
individual repository.

It also holds `verifying-ui`, the web QA unit: the browser, design intent and Storybook
checks. Depends on no other plugin.

Install it from your shell; the first time, the command also adds the marketplace:

```
claude plugin install frontend --marketplace lidominik02/frontend-devkit
```

In a team repository, install it at local scope instead, so the committed settings do not
change. Then turn auto-update on for the marketplace, or no release reaches you
([Install](../../docs/installation.md#install)). It replaces the two framework packs of
0.5.x ([Upgrading from 0.5.x](../../docs/installation.md#upgrading-from-05x)).

## Why one router

Much of the guidance inverts between frameworks: module-scope state is an ordinary
singleton in a client-only Vue app and a cross-request data leak in a server-rendered one.
Choosing once, from the manifest, keeps the rules of a framework the workspace does not use
out of the context — a client-only Vue app never loads Nuxt's rules, nor a Nuxt app the
client-only ones — and keeps the listing at one description however many frameworks there
are. Why: [ADR 0016](../../docs/adr/0016-framework-rules-chosen-per-workspace.md).

## Skills

| Skill | | What it does |
| --- | --- | --- |
| `frontend-engineering` | listed | Applies while writing, refactoring, reviewing or debugging anything in a Vue, Nuxt or Next.js codebase; selects the framework's rules per workspace and reads `<framework>-rules.md` first, then topic references on demand |
| `verifying-ui` | listed | Verifies a UI change: observes it in a real browser through a browser MCP server, compares it with the design's intent, and checks its Storybook stories, each mode skipped by name when its prerequisite is absent. Opens no browser until released; `report` fixes nothing, `design` reads the design source only |

They answer to `/frontend:frontend-engineering` and `/frontend:verifying-ui`; `core` calls
both by these names.

## Reading this file

This README is written to be read on GitHub, where its links into `docs/` resolve. An
installed copy of the plugin carries neither, and `claude plugin details` does not show
this file.
