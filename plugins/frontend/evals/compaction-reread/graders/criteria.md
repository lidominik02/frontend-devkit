---
type: llm
weight: 1
---

Tests whether the router's selected rules are read again after a compaction, before the next
rule is applied. Section 4 of `frontend-engineering`'s `SKILL.md` names compaction as a
re-read point: compaction keeps no part of the invoked body, so the selected
`<framework>-rules.md` files are re-read, and when the selection itself is out of view, the
skill is invoked again first.

The prompt has two parts in a Nuxt workspace. The first is long: checking every line of a
2,400-product catalogue, which carries the session across a low autocompact window. The
second is a review verdict on a composable whose module-scope `ref` is a cross-request leak
under SSR, a rule of the `nuxt-*` set. The verdict is the rule application the re-read has to
come before.

The case does not separate the after-compaction point from the before-a-verdict point: the
rule applied here is a review verdict, so both points ask for the same read. A pass shows the
selected rules were read again between the compaction and the next rule applied, which is the
claim. A rules file the CLI attaches to the context after the compaction is not a re-read:
the compaction put it there, not the model.

Expected result: (r) holds in at least 3 of 4 valid runs. This is a with-plugin-only case:
without the `frontend` plugin there is no selection and no rules file to read again, so a
baseline arm measures nothing here.

## Run

Hand-run from the fixture below, with the manual `claude -p` rig of
`plugins/core/evals/README.md` ("Running them"):

- `core` and `frontend` loaded from the working tree with `--plugin-dir`, both plugin
  directories also passed with `--add-dir`;
- the installed copies disabled for the run;
- `--strict-mcp-config` with an empty `{"mcpServers":{}}`;
- `--permission-prompts none`, and the prompt's `max_turns` and `allowed_tools`;
- `--permission-mode default`, so a user-level default mode such as `auto` does not approve
  tools the prompt does not grant;
- `--disallowedTools Bash Grep`, so the catalogue can be checked only with `Read`: a
  read-only `Bash` command can be approved in `default` mode without being granted, and
  `jq` or a `Grep` answers the question without the reads that fill the window;
- `--autocompact 100k`, so reading the catalogue crosses the window.

The flags are as CLI 2.1.319 gives them: `claude --help` lists
`--disallowedTools <tools...>`, comma or space separated, and `--permission-mode` accepts
`default` although its help lists only the other modes.

Strip the frontmatter and the blank lines behind it, so `/frontend:frontend-engineering` is
line 1. The run's working directory is the fixture directory, so the workspace is that
directory — `.` or its name in the selection line.

The run keeps session persistence (no `--no-session-persistence`), and the runner copies the
session JSONL from `~/.claude/projects/` next to the run's output. That file is the
transcript of record: a compaction is a `system` entry with subtype `compact_boundary` in it,
and order is the order of its lines.

Run the with-plugin arm until it has 4 valid runs. A void run, from the rig check or from
the criteria below, does not count toward the 4. After 4 void runs the case is NOT RUN, with
their reasons. The automated harness does not fit: it runs
a case without its fixture and without `--autocompact`.

Recorded with every run, valid or void: the exact model ID from the init event's `model`;
the judge model, or that a person graded it; the CLI version from `claude --version`; the
OS and its version; the plugin source — the commit of the working tree the `--plugin-dir`
paths point at, and whether it had uncommitted changes. Also which user-level instructions
applied (`~/.claude/CLAUDE.md`, `~/.claude/rules/`) and which user-level skills the init
event lists, as `plugins/core/evals/README.md` describes.

## Fixture

A fresh, empty directory per run, never this repository, holding five files.

`package.json`:

```json
{"dependencies":{"nuxt":"^4.0.0","vue":"^3.5.0"}}
```

`server/data/catalog.json`: written by the script below. Save it outside the fixture
directory, as `gen-catalog.mjs`, and run `node <its path>` from the fixture directory. The
file it writes has 2,402 lines, and its SHA-256 is
`68adf3db4d130104a045f269815699ed88ed6c87c59009875cc63588de04e170`.

```js
import { mkdirSync, writeFileSync } from 'node:fs'

const kinds = [
  ['shirts', 'Linen shirt'],
  ['trousers', 'Chino trousers'],
  ['jackets', 'Field jacket'],
  ['shoes', 'Leather sneaker'],
  ['bags', 'Canvas tote'],
  ['hats', 'Wool beanie'],
  ['scarves', 'Cotton scarf'],
  ['belts', 'Leather belt'],
]
const rows = []
for (let i = 1; i <= 2400; i++) {
  const [category, name] = kinds[i % 8]
  const price = 1990 + ((i * 37) % 60) * 100
  rows.push(JSON.stringify({
    sku: 'SKU-' + String(i).padStart(5, '0'),
    name: name + ' ' + i,
    category,
    price,
    salePrice: i % 211 === 0 ? price + 500 : price - (i % 5) * 200,
    currency: 'EUR',
    stock: (i * 13) % 40,
    updatedAt: '2026-10-' + String(1 + (i % 28)).padStart(2, '0'),
  }))
}
mkdirSync('server/data', { recursive: true })
writeFileSync('server/data/catalog.json', '[\n' + rows.join(',\n') + '\n]\n')
```

`server/api/products/[sku].get.ts`:

```ts
import catalog from '../../data/catalog.json'

export default defineEventHandler((event) => {
  const sku = getRouterParam(event, 'sku')
  const product = catalog.find((p) => p.sku === sku)
  if (!product) throw createError({ statusCode: 404, statusMessage: 'Product not found' })
  return product
})
```

`composables/useRecentlyViewed.ts`:

```ts
export interface ViewedProduct {
  sku: string
  name: string
}

const recentlyViewed = ref<ViewedProduct[]>([])

export function useRecentlyViewed() {
  function track(product: ViewedProduct) {
    recentlyViewed.value = [
      product,
      ...recentlyViewed.value.filter((p) => p.sku !== product.sku),
    ].slice(0, 5)
  }
  return { recentlyViewed, track }
}
```

`pages/products/[sku].vue`:

```vue
<script setup lang="ts">
const route = useRoute()
const { data: product } = await useFetch(`/api/products/${route.params.sku}`)
const { recentlyViewed, track } = useRecentlyViewed()
if (product.value) track({ sku: product.value.sku, name: product.value.name })
</script>

<template>
  <main>
    <h1>{{ product?.name }}</h1>
    <aside>
      <h2>Recently viewed</h2>
      <ul>
        <li v-for="p in recentlyViewed" :key="p.sku">{{ p.name }}</li>
      </ul>
    </aside>
  </main>
</template>
```

Rig check, before reading anything out of a run; a run that fails one is void, not a fail:

- The directory holds exactly these five files, with the content above, and
  `server/data/catalog.json` has the SHA-256 above.
- The init event lists `core@inline` and `frontend@inline`, beside them only `@builtin`
  plugins, and its `mcp_servers` is empty.
- No transcript line contains `plugins/cache`.
- The skill fired: the session JSONL holds a user message that begins
  `Base directory for this skill: ` followed by a path equal to the `frontend` `--plugin-dir`
  path plus `/skills/frontend-engineering`, then the skill body.
- No `Skill` call was denied, and no Read of a file under the loaded plugin directories was
  denied for lying outside the run's directory.
- The session JSONL holds at least one `compact_boundary` after the skill body. A run without
  one never compacted and measures nothing.

## Criteria

A **code finding** is an assistant text that names a defect in, a severity of, a risk in, or
an approval of a code file of the fixture — the composable, the page or the server route.
A passing remark that names a defect counts. A text about the catalogue's data alone is not
one, and thinking blocks are not scored.

A code finding before the first `compact_boundary` makes the run void, with the reason
recorded: the prompt puts the review after the catalogue, and a verdict already given
before the compaction leaves nothing to measure. Its restatement after the boundary is not a
rule application.

The **rule application** is the first code finding after the first `compact_boundary`. The
**scored boundary** is the last `compact_boundary` before the rule application, or, in a
run without one, the last `compact_boundary` of the run.

A **re-read** is, after the scored boundary and before the rule application, either:
- a `Read` tool call of `references/nuxt-rules.md` under the `frontend` `--plugin-dir`
  path, with a successful result. A `Read` with `offset` or `limit` counts only if its range
  includes the rule that opens `**Module-scope state is a cross-request leak.**`; or
- a `Skill` tool call naming `frontend:frontend-engineering` (or `frontend-engineering`),
  with a successful result.

A `Read` of `vue-rules.md` alone, a denied or erroring `Read`, a `Grep` over a rules file, a
`Read` of `SKILL.md` alone, and a rules file the CLI attached to the context are not a
re-read; record them.

- (r) The run passes when it states a rule application and a re-read comes before it. It
  fails when the rule application comes with no re-read, and when it ends or hits
  `max_turns` after the first `compact_boundary` with no rule application.

Recorded per run, as one outcome:
- **reread-rules** — (r) holds through a `Read` of `nuxt-rules.md` and no `Skill` call.
- **reread-skill** — (r) holds through a `Skill` call, with or without a rules file `Read`
  after it.
- **no-reread** — (r) fails: a rule application with no re-read before it.
- **no-verdict** — (r) fails: no rule application after the first `compact_boundary`.
- **void** — with the reason: a named rig-check line, or a code finding before the first
  `compact_boundary`.

Recorded, not scored: the selection line verbatim; the number of `compact_boundary` entries
and the session JSONL line of each; every tool call that targets a file under
`plugins/frontend/skills/frontend-engineering/` (`SKILL.md` and `references/`), in order,
with the tool and its position relative to each boundary; whether an entry after the scored
boundary attaches the content of `vue-rules.md` or `nuxt-rules.md`, and its line; the line
ranges of `server/data/catalog.json` read; the rule application verbatim, and whether it
calls the module-scope `recentlyViewed` a cross-request leak and with what severity.

## Note for scoring

Report (r) as `n` of 4 valid runs, with the number of void runs and their reasons beside it,
and each run's outcome and recorded data. The case passes when (r) holds in at least 3 of 4
valid runs, and is NOT RUN, with the void reasons, after 4 void runs.
(r) is the only line under test. The verdict's content is not scored: whether a module-scope
`ref` is a cross-request leak in Nuxt is `ssr-shared-state`'s question, and the catalogue
answer exists to carry the session across the autocompact window.
