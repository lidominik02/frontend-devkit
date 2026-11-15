---
type: llm
weight: 1
---

Tests whether the router's selected rules are in the context again after a compaction, before
the next rule is applied. Section 4 of `frontend-engineering`'s `SKILL.md` names compaction
as a re-read point: compaction keeps no part of the invoked body, so the selected
`<framework>-rules.md` files are re-read, and when the selection itself is out of view, the
skill is invoked again first.

The task has two parts in a Nuxt workspace, sent as two messages of one session with a manual
`/compact` between them. The first, `prompt.md`, is a data task, checking every line of a
200-product catalogue, and the code of a new server route that returns the rows it finds,
given in the reply. Writing code is a point where the router's reading order asks for the
rules files, so they are read before the compaction, and a read after it is a re-read. The
second, in the Run section below, is a review verdict on a composable whose module-scope
`ref` is a cross-request leak under SSR, a rule of the `nuxt-*` set. The verdict is the rule
application the rules have to be back in the context for.

The case does not separate the after-compaction point from the before-a-verdict point: the
rule applied here is a review verdict, so both points ask for the same read. A pass shows the
content of the selected `nuxt-rules.md` was in the context between the compaction and the
next rule applied, which is the claim: either the model read the file again, or the CLI
attached its content to the context after the compaction. The outcome says which of the two
carried it.

Expected result: (r) holds in at least 3 of 4 valid runs. This is a with-plugin-only case:
without the `frontend` plugin there is no selection and no rules file to read again, so a
baseline arm measures nothing here. Kind: capability — the selected rules back in view after
a compaction, rather than a review from the compaction's summary, is an ordering the model
does not follow unaided. A `reattached` pass shows the rules were in view through the CLI,
not that the model read them again; the per-outcome count in the Note for scoring separates
the two.

## Run

Hand-run from the fixture below, with the manual `claude -p` rig of
`plugins/core/evals/README.md` ("Running them"): `core` and `frontend` loaded
with `--plugin-dir`, both plugin directories also passed with `--add-dir`, the
installed copies disabled for the run, `--strict-mcp-config` with an empty
`{"mcpServers":{}}`, `--permission-prompts none`, and the prompt's `max_turns` and
`allowed_tools`. Strip the frontmatter and the blank lines behind it, so
`/frontend:frontend-engineering` is line 1.
Load `core` and `frontend` from a copy of the working tree's `plugins/` directory, kept as
`plugins/` under a path that names none of the case, the framework or the devkit, such as
`/tmp/tree/plugins/`, and point `--plugin-dir` and `--add-dir` at that copy. Copy the fixture
into a fresh directory per run whose path names none of the case, the framework, the devkit
or the word "frontend", such as `/tmp/runs/w01`: the model sees these paths, and a name in
them is a cue the case means to leave to the prompt and the manifest. That directory is the
run's working directory, so the workspace is that directory — `.`, its name or its full path
in the selection line.

Two more flags:

- `--permission-mode default`, so a user-level default mode such as `auto` does not approve
  tools the prompt does not grant;
- `--disallowedTools Bash Grep Agent Task Write`, so every read happens with `Read` in the
  main session, where the session JSONL records it and it can be scored: a read-only `Bash`
  command can be approved in `default` mode without being granted, a subagent's reads stay
  out of the main session, and a written script hands the work to one.

A run is three commands in its working directory, each with every flag above, in one
session:

1. `claude -p` with the prompt on stdin: the first part. Its init event's `session_id` is
   the run's `<id>`.
2. `claude -p --resume <id>` with `/compact` on stdin: a manual compaction.
3. `claude -p --resume <id>` with the second part on stdin, verbatim:

   ```text
   Next, a teammate added `composables/useRecentlyViewed.ts` so the product page can show the last few products a shopper looked at. Review it before it merges: can it ship as it is?
   ```

No `--fork-session`: both resumed commands continue the first command's session.

The run keeps session persistence (no `--no-session-persistence`), and the runner copies the
session JSONL from `~/.claude/projects/` next to the run's output. That file is the
transcript of record: a compaction is a `system` entry with subtype `compact_boundary` in it,
and order is the order of its lines.

Run the with-plugin arm until it has 4 valid runs. A void run, from the rig check or from
the criteria below, does not count toward the 4. After 4 void runs the case is NOT RUN, with
their reasons — unless three valid runs that passed exist by then: the arm then runs on to
its fourth valid run for at most 4 more void runs, and after those the case is NOT RUN, with
their reasons. The automated harness does not fit: it runs a case without its fixture and as one
message, with no compaction between the parts.

Recorded with every run, valid or void: the run's `<id>`; the exact model ID from the init
event's `model`; the judge model, or that a person graded it; the CLI version from
`claude --version`; the OS and its version; the plugin source — the commit of the working
tree the `--plugin-dir` paths point at, and whether it had uncommitted changes. Also which
user-level instructions applied (`~/.claude/CLAUDE.md`, `~/.claude/rules/`) and which
user-level skills the init event lists, as `plugins/core/evals/README.md` describes.

## Fixture

A fresh, empty directory per run, never this repository, holding five files.

`package.json`:

```json
{"dependencies":{"nuxt":"^4.0.0","vue":"^3.5.0"}}
```

`server/data/catalog.json`: written by the script below. Save it outside the fixture
directory, as `gen-catalog.mjs`, and run `node <its path>` from the fixture directory. The
file it writes has 202 lines, and its SHA-256 is
`bfcbf975441a4ffabfd7007d77ff6f32d77460d4a4f25378e7710ee5e17c78e5`.

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
for (let i = 1; i <= 200; i++) {
  const [category, name] = kinds[i % 8]
  const price = 1990 + ((i * 37) % 60) * 100
  rows.push(JSON.stringify({
    sku: 'SKU-' + String(i).padStart(5, '0'),
    name: name + ' ' + i,
    category,
    price,
    salePrice: i % 47 === 0 ? price + 500 : price - (i % 5) * 200,
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
- The init event's `tools` list contains none of `Bash`, `Grep`, `Agent`, `Task` and
  `Write`.
- No transcript line contains `plugins/cache`.
- The run's working directory names none of the case, the framework, the devkit or the word
  "frontend", and no `--plugin-dir` or `--add-dir` path names the case, the framework or the
  devkit above its `plugins/` directory.
- The skill fired: the session JSONL holds a user message that begins
  `Base directory for this skill: ` followed by a path equal to the `frontend` `--plugin-dir`
  path plus `/skills/frontend-engineering`, then the skill body.
- No `Skill` call was denied, and no Read of a file under the loaded plugin directories was
  denied for lying outside the run's directory.
- The init events of the three commands carry the same `session_id`, and the session JSONL
  holds a `compact_boundary` after the skill body and before the second part's message. A
  run without one never compacted and measures nothing.
- A `Read` of `references/nuxt-rules.md` with a successful result comes before the first
  `compact_boundary`. Without one, a first read after the compaction would score as a
  re-read.

## Criteria

A **verdict** is an assistant text that answers the review question for a code file of the
fixture — the composable, the page or the server route `server/api/products/[sku].get.ts`:
whether it can ship as it is, yes or no, or what must change, without deferring to a check
not yet made. A text that names a risk
and then says it will check the rules, or otherwise defers its conclusion, is not one ("this
module-scope `ref` is shared across requests; let me check the rules before I conclude"), nor
is a text about the catalogue's data or the new route of the first part alone. A remark
made while doing the first part — a neighbouring file read for its conventions, a pattern
reused from it — is not one unless it answers whether one of those three files can ship.
Thinking blocks are not scored.

A verdict before the first `compact_boundary` makes the run void, with the reason recorded:
the review is asked only after the compaction, and a verdict already given before the
compaction leaves nothing to measure. Its restatement after the boundary is not a rule
application.

The **rule application** is the first verdict after the first `compact_boundary`. The
**scored boundary** is the last `compact_boundary` before the rule application, or, in a
run without one, the last `compact_boundary` of the run.

A **re-read** is a `Read` tool call of the plugin copy's `references/nuxt-rules.md` — by any
spelling of its path, through the `--plugin-dir` or the `--add-dir` path, relative or
absolute, once resolved to that file — after the scored boundary and before the rule
application, with a successful result: one that returns the file's content. A result
without it, such as a stub saying the file is unchanged, is not a re-read. A `Read` with
`offset` or `limit` counts only if its range covers the whole rule that opens
`**Module-scope state is a cross-request leak.**`, from that line through the last line of
its paragraph. A `Skill` tool call naming `frontend:frontend-engineering` (or
`frontend-engineering`) before the re-read is allowed, and is not a re-read by itself: the
router's section 4 invokes the skill again only to recover the selection, and the rules are
still read after it.

A **re-attachment** is an entry the CLI writes into the session JSONL, not a tool result,
that carries the content of the plugin copy's `references/nuxt-rules.md`: a line whose
`type` is `attachment`, whose `attachment.type` is `file`, whose `attachment.filename`
resolves to that file, and whose `attachment.content.file.content` holds the file's text —
after the scored boundary and before the rule application. It counts only if that text
covers the whole rule that opens `**Module-scope state is a cross-request leak.**`, from
that line through the last line of its paragraph. The compaction summary, the user entry
flagged `isCompactSummary` right after the boundary, is not one, even when it names the file
or restates its rules.

A `Skill` call with no `Read` of `nuxt-rules.md` after it, a `Read` of `vue-rules.md` alone, a
denied or erroring `Read`, a `Read` of `SKILL.md` alone, and an attachment of `vue-rules.md`
alone are neither a re-read nor a re-attachment; record them. A read by a subagent or by a
disallowed tool cannot occur on this rig, and would not count.

- (r) The run passes when it states a rule application and a re-read or a re-attachment
  comes before it. It fails when the rule application comes with neither, and when it ends
  or hits `max_turns` after the first `compact_boundary` with no rule application.

Recorded per run, as one outcome:
- **reread-rules** — (r) holds through a re-read of `nuxt-rules.md`, with or without a
  `Skill` call or a re-attachment before it.
- **reattached** — (r) holds through a re-attachment of `nuxt-rules.md` alone, with no
  re-read.
- **no-rules** — (r) fails: a rule application with neither a re-read nor a re-attachment
  before it.
- **no-verdict** — (r) fails: no rule application after the first `compact_boundary`.
- **void** — with the reason: a named rig-check line, or a verdict before the first
  `compact_boundary`.

Recorded, not scored: the selection line verbatim; the number of `compact_boundary` entries,
the session JSONL line of each and its `trigger`; every `Skill` call after the scored
boundary; every tool call that targets a file under
`plugins/frontend/skills/frontend-engineering/` (`SKILL.md` and `references/`), in order,
with the tool and its position relative to each boundary; every `attachment` entry of
`type` `file` after the scored boundary, with its `filename` and its line; the line
ranges of `server/data/catalog.json` read; the rule application verbatim, and whether it
calls the module-scope `recentlyViewed` a cross-request leak and with what severity.

## Note for scoring

Report (r) as `n` of 4 valid runs, with the number of void runs and their reasons beside it,
and each run's outcome and recorded data. A pass is either `reread-rules` or `reattached`;
report how many valid runs each of the two carried. The case passes when (r) holds in at
least 3 of 4 valid runs. It is NOT RUN, with the void reasons, after 4 void runs, unless
three valid runs that passed exist by then; the arm then runs on to the fourth valid run for
at most 4 more void runs, as the Run section says.
(r) is the only line under test. The verdict's content is not scored: whether a module-scope
`ref` is a cross-request leak in Nuxt is `ssr-shared-state`'s question, and the catalogue
answer and the new route exist to give the session work before the compaction that is not a
review of the fixture's code, and that reads the rules files.
