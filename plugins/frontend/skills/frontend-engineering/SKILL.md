---
name: frontend-engineering
description: >-
  Frontend engineering and review knowledge for Vue 3, Nuxt and Next.js, chosen per
  workspace from its package.json: reactivity that silently stops updating, composables,
  Vue Router guards, client versus server state, build-time config and secrets that reach
  the browser bundle, state that leaks between requests under SSR, useFetch and
  useAsyncData, hydration mismatches, Nitro server routes. Use whenever writing,
  refactoring, reviewing or debugging anything in a Vue, Nuxt or Next.js codebase —
  components, composables, stores, routes, pages, server routes, config — even for a small
  change, and for symptoms like "the list stops updating", "it works until I reload", "one
  user sees another user's data", "it flashes then changes".
---

# Frontend engineering

Much of the guidance inverts between frameworks: module-scope state is a harmless
singleton in a client-only SPA and a cross-request leak under SSR. So this skill picks one
framework's rules per workspace, from a fact, before any rule loads, and the rules of a
framework the workspace does not use never enter the context.

## 1. Select, once per workspace

The workspace is the one the caller names; without one, the nearest directory above the
files in question that holds a `package.json`, up to the repository root. Read that
workspace's `package.json` and select by this table. A framework listed only under
`peerDependencies` or `devDependencies` selects the "peer or dev dependency" row, not the
`nuxt` or `vue` row.

| The workspace has | Set loaded |
| --- | --- |
| `nuxt` | `vue-*` as base, `nuxt-*` as delta |
| `vue`, no `nuxt` | `vue-*` |
| `next` | no set yet; API facts come from the documentation the installed `next` package ships |
| `react`, no `next` | `react-*` once it exists; until then, the codebase's conventions |
| the framework only as a peer or dev dependency | the strictest set among the workspaces that consume it, SSR winning; with no consumer, SSR-safe rules |
| none of these | no set |

A set applies to its own workspace only. In a monorepo, select for each workspace the
work touches, and never carry one workspace's set into another.

This table is the only place a base–delta pair is written. Under `vue-*` + `nuxt-*`, the
list "Rules from the `vue-*` set that do NOT apply here" in `references/nuxt-rules.md`
wins every conflict with the base.

**Say the selection, one line per workspace, before reading any rule:**

```
<workspace> → vue-* + nuxt-* (nuxt in package.json)
<workspace> → no set (<reason>)
```

The manifest fact in parentheses is the one that decided the row.

### When no fact decides

- No `package.json` for the workspace: `no set (no package.json)`.
- A `package.json` that does not parse: say so, `no set (package.json does not parse)`, and
  follow the codebase's conventions.
- The framework only as a peer or dev dependency, and no workspace consumes it: SSR-safe
  rules, which means `vue-*` + `nuxt-*`.
- Anything else no fact settles: say so, and follow the table.

Never ask which framework it is, and never infer one from file names, globs or the
directory layout — the manifest decides.

## 2. Read in order

1. **The rules file first** — `<framework>-rules.md` of each selected set, before writing,
   reviewing or diagnosing anything. For `vue-*`: `references/vue-rules.md`. For
   `vue-*` + `nuxt-*`: `references/vue-rules.md`, then `references/nuxt-rules.md`. A
   rules file holds its set's guardrails, so it is never skipped.
2. **Topic files on demand** — a `vue-<topic>.md` or `nuxt-<topic>.md` only when the
   rules file's Reading table or symptom router points at it for what you are touching.
3. **Nothing from a set not selected** for this workspace.

With no set, read no file here: follow the codebase's conventions, and for Next.js the
installed package's documentation.

## 3. Rules every set shares

- **Check the resolved version** before applying any version-gated rule: the lockfile or
  `node_modules/<pkg>/package.json`, not a `package.json` range. Resolved version unknown:
  claim no exact version, and say so in the answer.
- **Follow the codebase's conventions.** Read the neighbouring files first, reuse what
  exists before writing anything new, and keep changes surgical.
- **No rule here is a fact about this repository.** File paths, helper names and
  conventions come from the repository itself and its own `CLAUDE.md`.
- **No sweeping rewrite.** Bulk-convert nothing the task did not ask about — no drive-by
  migrations or refactors of adjacent code.

## 4. Re-read the selected rules

The selected rules live in references, and compaction keeps no part of this body. Re-read
the selected `<framework>-rules.md` files at three points, rather than trusting what
survived:

- **before a review verdict,**
- **before reporting done,**
- **after compaction** — and when the selection itself is no longer in view, invoke this
  skill again, or read this `SKILL.md`, before re-reading the rules.

## What this must NOT do

- **Select by `paths`, file names or layout.** Only the workspace's manifest selects.
- **Read from a set not selected** for the workspace, or apply one workspace's set to
  another.
- **Write a base–delta pair** anywhere but the table above.
- **Ask the user which framework applies.** A fact decides, or the table's fallback does.
- **Apply a rule from memory of a set** after compaction without re-reading it.
