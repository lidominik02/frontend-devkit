# Version gates

Read the installed versions before applying anything on this page. The wrong half of a
version-gated rule is worse than no rule, and Nuxt moved the source directory in one
major and is moving the server layer in the next.

```
node -p "Object.entries({...require('./package.json').dependencies,...require('./package.json').devDependencies}).filter(([k])=>/^(nuxt|nitro|@nuxt\/|vue|pinia|typescript|vue-tsc|@pinia\/nuxt)/.test(k)).map(e=>e.join('@')).join('\n')"
```

Then read `nuxt.config` for `compatibilityDate` and anything under `future` — those
change runtime behaviour without changing an installed version.

**For Vue, Pinia, Tailwind, TanStack and lint tooling, read the `vue` pack's
`references/versions.md`.** Those rows are not repeated here. This file covers only what
Nuxt itself owns.

## Nuxt majors

| Line | Position |
| --- | --- |
| **4.x** | The current stable line. Nuxt 4 ships `app/` as the source directory |
| **3.x** | Reached end of life on 31 July 2026 — no further bug fixes or security patches. Source lives at the project root, not under `app/` |
| **5.x** | Not released; estimated Q4 2026. Brings Nitro v3 and a reworked server layer |

Nuxt 4.5.2 requires Node `^22.19.0 || ^24.11.0 || >=26.0.0` and depends on `vue ^3.5.40`
— a floor higher than the Vue and Vitest floors the `vue` pack lists, so check Node
before blaming a build.

## Nuxt 3 → 4, the changes that break code

| Area | 3.x | 4.x |
| --- | --- | --- |
| Source directory | project root | `app/` |
| `server/`, `public/`, `modules/`, `layers/` | project root | still project root — they did **not** move into `app/` |
| `shared/` | — | new directory, usable from both app and server |
| Same-key `useAsyncData`/`useFetch` | independent copies | share one `data`, `error` and `status` |
| `data` reactivity | deep `ref` | **`shallowRef`** — deep mutation does not re-render |
| Cached-data callback | no reason given | `getCachedData` receives why it was called |
| Unmount behaviour | data retained | purged when the last consumer unmounts |
| `noUncheckedIndexedAccess` | `false` | `true` |
| Vue Options API compat | on | `__VUE_OPTIONS_API__` off by default |
| Route metadata | `name`/`path` on `route.meta` | deduplicated off `route.meta` |

The `shallowRef` change is the one that produces a silent bug in working code: a
`data.value.items.push(...)` that re-rendered on 3.x renders nothing on 4.x. Replace the
value instead.

Escape hatches exist for the shared-refs and purge-on-unmount behaviour under
`experimental` — check the installed version's config reference rather than assuming a
flag name.

## `compatibilityDate` and `compatibilityVersion`

Two different mechanisms, easily confused:

- **`compatibilityDate`** is a top-level date string in `nuxt.config`. It pins the
  behaviour of Nitro presets and some modules to what was current on that date.
- **`future.compatibilityVersion`** is a Nuxt major. `4` opts a Nuxt 3 project into Nuxt
  4 behaviour ahead of upgrading.

Whether the installed version accepts a `compatibilityVersion` for the *next* major is
version-specific — check the installed release's own upgrade guide rather than assuming
the flag exists.

## Nitro

Nuxt 5 moves to Nitro v3, which is a rewrite on Web-standard `Request`/`Response`.
Reported breaking changes in the server layer include import specifiers for handler
utilities moving, `event.url` / `event.req` / `event.res` replacing the older accessors,
and error fields renaming from `statusCode`/`statusMessage` to `status`/`statusText`.
Treat every `server/` API on this list as version-gated.

**Do not read a `nitropack` version to decide which Nitro you are on.** Nuxt 4 vendors
its server through its own package, so `nitropack@latest` says nothing about this
project. Read what the lockfile actually resolved for the Nuxt server dependency.

## Type-checking — the row that matters most

`nuxt typecheck` is the gate. **A bare `vue-tsc --noEmit` is not**, and the failure is
silent:

- Nuxt generates `.nuxt/tsconfig.app.json`, `.nuxt/tsconfig.server.json`,
  `.nuxt/tsconfig.node.json` and `.nuxt/tsconfig.shared.json`, and leaves the root
  `tsconfig.json` as a **solution file** — `files: []` plus `references`. A `vue-tsc
  --noEmit` pointed at it has no inputs, checks nothing, and **exits 0**.
- Those generated files exist only after `nuxt prepare`, a dev server, or a build. On a
  CI checkout that ran only `install`, there is nothing to check against. Add
  `"postinstall": "nuxt prepare"`.
- `typescript.typeCheck` defaults to **`false`**, so a build does not type-check unless
  told to. `typescript.strict` defaults to `true`.
- **`strictTemplates` still defaults to off**, and it does **not** go in `tsconfig.json`
  — that file is generated and your edit is overwritten. Put it in `nuxt.config`:

  ```ts
  typescript: { tsConfig: { vueCompilerOptions: { strictTemplates: true } } }
  ```

  It is a **master switch**: `checkUnknownProps`, `checkUnknownEvents`,
  `checkUnknownComponents`, `checkUnknownDirectives` and `strictVModel` all follow from
  it, so do not enumerate them the way a plain Vue setup does. That key is not typed in
  `defineNuxtConfig`, so a typo fails silently — run `nuxt prepare` and confirm the
  option landed in `.nuxt/tsconfig.app.json`.
- **TypeScript 7.x**: `vue-tsc` needs TypeScript's stable programmatic compiler API,
  which the 7 line does not ship. `nuxt typecheck` can select a different checker
  (`--checker`), so the remedy here is either pinning TypeScript to 6.x or switching
  checker — confirm which checker actually runs before believing templates are checked.
- A sudden wall of `Cannot find name 'ref'` across auto-imports is a known rough edge in
  project-references build mode, not a defect in the diff. Check the installed patch
  version before chasing it.

`run-gates.mjs` in the `core` plugin reports a bare `vue-tsc` on a solution-file
`tsconfig.json` as `typecheckVacuous`.

## Testing

`@nuxt/test-utils` is the Nuxt-aware layer over Vitest, and it changes the answers the
`vue` pack gives:

- `defineVitestConfig` / `defineVitestProject` from `@nuxt/test-utils/config`.
- `mountSuspended` / `renderSuspended` instead of a bare `mount` — anything calling
  `useRuntimeConfig`, `useState`, `useRoute` or `useNuxtApp` needs the Nuxt context, and
  the `vue` pack's `withSetup` harness does not provide it.
- `mockNuxtImport` to replace an auto-imported composable.
- **`registerEndpoint` instead of MSW for internal routes.** Under the Nuxt test
  environment a `$fetch` to `/api/*` does not traverse the network, so MSW never sees
  it — the `vue` pack's "mock at the network boundary" rule does not reach these calls.
- `setup` and `$fetch` from `@nuxt/test-utils/e2e` for a real booted app.

Check the installed peer ranges for Vitest and `@vue/test-utils`; they lag and lead the
standalone versions independently.
