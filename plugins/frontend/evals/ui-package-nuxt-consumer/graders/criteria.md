---
type: llm
weight: 1
---

Tests the router's "peer or dev dependency" row on a UI-library workspace with a Nuxt
consumer. The shared package `packages/ui` names `vue` only as a peer and a dev dependency.
The shop that consumes it, `apps/shop`, names `nuxt`. The router selects the strictest set
among the consuming workspaces, with SSR winning. So for `packages/ui` it reads the `vue-*`
set as base and the `nuxt-*` set as delta. With those rules, the module-scope `compareList`
is a Critical cross-request leak: Nuxt renders on the server by default, and the fixture
holds no `nuxt.config` that turns it off.
This is the claim in ADR 0016's "Measured after the release" line.

Expected result: pass in every run. This is a with-plugin-only case. Its result is a score,
not a verdict on keeping the row.

## Run

Hand-run from the fixture below, with the manual `claude -p` rig of
`plugins/core/evals/README.md` ("Running them"):

- `core` and `frontend` loaded from the working tree with `--plugin-dir`, both plugin
  directories also passed with `--add-dir`;
- the installed copies disabled for the run;
- `--strict-mcp-config` with an empty `{"mcpServers":{}}`;
- `--permission-prompts none`, and the prompt's `max_turns` and `allowed_tools`.

Strip the frontmatter and the blank lines behind it, so `/frontend:frontend-engineering` is
line 1. The run's working directory is the fixture's root. The prompt names the file, so the
workspace is `packages/ui`, the nearest directory above it that holds a `package.json`.

Run the with-plugin arm, at least twice. Without the `frontend` plugin there is no router and
no selection, so a baseline arm, `core` alone, can score only (c), and it is not part of this
case's verdict. Its expected result on (c) is uncertain: the prompt names no framework, so a
baseline passes only if it reads `apps/shop/package.json` on its own and reasons from Nuxt's
server rendering. Where `--bare` is unavailable, user-level instructions reach that arm too:
read the runner's `~/.claude/CLAUDE.md` and `~/.claude/rules/` for a rule about server
rendering or severity, and record whether one applied. Where one did, (c) in that arm is
non-discriminating: record it, and do not read it as evidence for keeping the row.

## Fixture

A fresh, empty directory per run, never this repository, holding four files.

`package.json`:

```json
{"name":"storefront","private":true,"workspaces":["packages/*","apps/*"]}
```

`packages/ui/package.json`:

```json
{"name":"@storefront/ui","version":"0.0.0","peerDependencies":{"vue":"^3.5.0"},"devDependencies":{"vue":"^3.5.0"}}
```

`apps/shop/package.json`:

```json
{"name":"shop","private":true,"dependencies":{"@storefront/ui":"*","nuxt":"^4.0.0","vue":"^3.5.0"}}
```

`packages/ui/src/composables/useCompareList.ts`: the code block of the prompt, verbatim.

Rig check, before reading anything out of a run. A run that fails one is void, not a fail.

- The directory holds only the four files above, with the content above.
- The init event lists `core@inline` and `frontend@inline`, and its `mcp_servers` is empty.
- No transcript line contains `plugins/cache`.
- The skill fired: the run's session JSONL holds a user message that begins
  `Base directory for this skill: ` followed by a path equal to the `frontend` `--plugin-dir`
  path plus `/skills/frontend-engineering`, then the skill body. Or the transcript holds a
  successful `Skill` tool result for `frontend:frontend-engineering`. The run keeps session
  persistence, and the runner copies that session JSONL next to the run's output, as for the
  isolation cases.
- No `Skill` call was denied, and no Read of a file under the loaded plugin directories was
  denied for lying outside the run's directory.

## Criteria

A **read** of a set file is defined as in `isolation-nuxt`: a tool call that targets a file
under `plugins/frontend/skills/frontend-engineering/references/` or returns its content. An
attempt counts. A `Glob` or a name-only `Grep` is not a read. Order is transcript order. A
**read** of a manifest is a tool call that returns its content: a `Read`, or a `Grep` that
returns its dependency lines. A `Glob` that only lists it is not.

Passes if it does ALL of:
- (s) Before the first read of a set file, the assistant text holds a selection line for the
  UI package in the shape the skill gives. The workspace is `packages/ui` or
  `@storefront/ui`, then `→` (or `->`), then `vue-* + nuxt-*` verbatim; another form of
  the set, such as `vue-*, nuxt-*`, fails. The parenthesis is required, and a line without
  one fails. It names a manifest fact that is true and decided the row: `vue` only as a peer or dev dependency, or
  `nuxt` in the consumer's manifest (`nuxt in apps/shop/package.json` passes). A
  parenthesis that is false of the UI package and names no consumer, such as the skill's
  example `(nuxt in package.json)` copied as is, fails. A line for `apps/shop`, when there
  is one, reads `vue-* + nuxt-*` too; any other set there fails.
- (k) The run reads `apps/shop/package.json`, and the answer names `apps/shop` (or `shop`)
  as the workspace that consumes the package with Nuxt.
- (r) Reads `references/vue-rules.md` and `references/nuxt-rules.md`, with the first read of
  `vue-rules.md` before the first read of `nuxt-rules.md`.
- (c) Rates the module-scope `compareList` Critical, or blocking, as a cross-request leak:
  under the shop's server rendering, one shopper's compare list is rendered for another. A
  conditional answer passes only when it states Nuxt's default as the premise — Nuxt
  renders on the server by default, unless the shop sets `ssr: false` — and keeps Critical
  as the rating for this shop.

Fails if it does ANY of:
- Selects `vue-*` alone, or `no set`, for the UI package, or hedges between sets in the
  selection line. → (s)
- Gives the selection only for the repository root, or only for `apps/shop`. → (s)
- Asks which framework the project uses, in text or a form. → (s)
- Calls the module-scope ref an ordinary client-side singleton, rates it below Critical or
  blocking, or raises only unrelated concerns. → (c)
- Treats the existence of a server-rendering consumer as in doubt — "if a consumer ever
  renders on the server" — when `apps/shop` is in the repository, or gives a rating in
  both directions ("Critical under SSR, a nit if client-only") without stating Nuxt's
  default as the premise. → (c)

(s) is scored on the selection line alone. Prose elsewhere that weighs another set, such as
"in a client-only consumer this would be fine", does not fail (s); it is read under (c).

Recorded, not scored:
- the selection line verbatim;
- every manifest read and every set file read, in order, and the tool that read each;
- whether the run read the root `package.json` `workspaces`;
- the severity label verbatim;
- the fix offered, and whether it suits a package whose manifest names `vue` and not
  `nuxt`.

## Note for scoring

The case passes when every line passes in every run. With no consumer, the same row also
gives `vue-* + nuxt-*` (SSR-safe rules), so the set in (s) alone does not show that the
consumer was found. (k) is the line that does. (c) is the claim under test.
