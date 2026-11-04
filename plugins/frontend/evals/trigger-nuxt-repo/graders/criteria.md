---
type: llm
weight: 1
---

Tests whether `frontend-engineering` fires on its description alone when the code sits in the
project's files rather than in the prompt: a Nuxt question with no slash invocation and no
skill name, in English (`prompt.md`) and in Hungarian (`prompt.hu.md`). The two prompts carry
the same request; the language is the only variable between the arms.

This case is the pair of `trigger-nuxt`, with the same request and the same code. The one
difference in the run is where the code is: `trigger-nuxt` pastes the two code blocks into
the prompt, while here they are the fixture's `composables/useBasket.ts` and
`pages/basket.vue`, without the path comment each pasted block opens with, and the prompt
says only that the code is in the repository. The criteria differ from `trigger-nuxt`'s in
two places: the diagnosis is defined more strictly, so a hedged hypothesis does not count in
any run, read or not, and a run cut off by `max_turns` is recorded and counted. (f) is
compared with `trigger-nuxt`'s (f) with the stricter diagnosis in mind; (s) is read beside the
count of runs cut off by `max_turns`.

The prompts are in a deliberately realistic register, and their prose avoids the router
description's own vocabulary — its symptom phrases, "composable", the framework's name —
wherever a natural alternative exists, and names no file. The framework shows only in the
fixture's files, so a fire is earned on the request and the project, not on echoed wording.
"basket" in the prompt matches both file names, so the files are easy to find, and a high
read rate is not credited to the router.

Expected result: the skill fires in every run of both arms. This is a with-plugin-only case
whose result is a rate, a score, not a verdict on keeping or removing the skill.

## Run

Hand-run from the fixture below, with the manual `claude -p` rig of
`plugins/core/evals/README.md` ("Running them"): `core` and `frontend` loaded from the
working tree with `--plugin-dir`, both plugin directories also passed with `--add-dir`, the
installed copies disabled for the run, `--strict-mcp-config` with an empty
`{"mcpServers":{}}`, `--permission-prompts none`, and the prompt's `max_turns` and
`allowed_tools`. Strip the frontmatter and the blank lines behind it. The run's working
directory is the fixture directory, so the workspace is that directory — `.` or its name in
the selection line.

Run the with-plugin arm only, 5 runs per prompt file: without the `frontend` plugin there is
no skill to fire, so a baseline arm measures nothing here.

The Hungarian arm is hand-run only. The harness help names `prompt.md` as a case's prompt;
whether it ignores `prompt.hu.md` beside it is unobserved. A whole-pack harness run measures
nothing for this case either: on CLI 2.1.310 `claude plugin eval` ran the isolation cases in
a directory with no `package.json`, where the router answers `no set (no package.json)`.

## Fixture

A fresh, empty directory per run, never this repository, holding three files.

`package.json`:

```json
{"dependencies":{"nuxt":"^4.0.0","vue":"^3.5.0"}}
```

`composables/useBasket.ts`:

```ts
interface BasketItem {
  id: string
  name: string
  quantity: number
}

const basket = ref<BasketItem[]>([])

export function useBasket() {
  async function load() {
    basket.value = await $fetch<BasketItem[]>('/api/basket')
  }
  return { basket, load }
}
```

`pages/basket.vue`:

```vue
<script setup lang="ts">
const { basket, load } = useBasket()
await load()
</script>

<template>
  <ul>
    <li v-for="item in basket" :key="item.id">{{ item.quantity }} × {{ item.name }}</li>
  </ul>
</template>
```

Rig check, before reading anything out of a run; a run that fails one is void, not a fail:

- The directory holds exactly these three files, with the content above.
- No line of the prompt sent starts with a slash invocation — `/` followed by a name — and
  the prompt does not name `frontend-engineering`.
- The init event lists `core@inline` and `frontend@inline`, beside them only `@builtin`
  plugins, and its `mcp_servers` is empty. Another plugin carrying a Vue or Nuxt skill would
  compete for the same request.
- No transcript line contains `plugins/cache`.
- No `Skill` call was denied, and no Read of a file under the loaded plugin directories was
  denied for lying outside the run's directory.

Recorded with the rig check, not voiding: which user-level instructions applied
(`~/.claude/CLAUDE.md`, `~/.claude/rules/`) and which user-level skills the init event
lists, as `plugins/core/evals/README.md` describes. A language instruction there reaches the
Hungarian arm most.

## Criteria

The **diagnosis** is the first assistant text anywhere in the run, not only the final
answer, that names a code location or a mechanism as the cause. A text that marks the cause
as uncertain ("probably", "might", "likely", "could be"), with or without a stated check, is
a hypothesis and does not count; a cause stated without such a marker is a diagnosis.
`no-fire-and-answers` and `stall` below judge a diagnosis by this same definition.

Passes if it does ALL of:
- (f) The transcript holds a `Skill` tool call naming `frontend:frontend-engineering` (or
  `frontend-engineering`), with a successful result, before any diagnosis. Only the call's
  position before any diagnosis matters: a call with no diagnosis after it, because the run
  was cut off or ends in a question, also holds. A call that follows another skill's call
  counts as a fire.
- (s) After it fires, the assistant text holds one selection line in the shape
  `<workspace> → <set> (<manifest fact>)`, in either arm's language: the workspace as `.` or
  the directory's name, `→`, `vue-* + nuxt-*`, and in parentheses the manifest fact that
  decided the row — `nuxt` in `package.json`: `. → vue-* + nuxt-* (nuxt in package.json)`. A
  translated parenthetical passes only if it names the same manifest fact. A line that
  selects `vue-*` alone, or hedges between sets, fails.

Fails if it does ANY of:
- Never calls `frontend-engineering`. → (f)
- Asks which framework the project uses after it fired. → (s)

Recorded per run, as one outcome:
- **fired** — (f) holds.
- **late-fire** — `frontend-engineering` is called only after the diagnosis; (f) fails.
- **no-fire-and-answers** — no `Skill` call at all, and an assistant text gives a diagnosis.
  Reading the skill's `SKILL.md` with `Read` instead of calling `Skill` is a no-fire.
- **no-fire-and-asks** — no `Skill` call at all, and an assistant text asks a question
  instead, which framework included.
- **wrong-skill-only** — `Skill` calls, none to `frontend-engineering`.
- **stall** — no `Skill` call, no diagnosis, no question: the run ends or hits `max_turns`.

Recorded, not scored: the arm (`en` or `hu`); every `Skill` call, in order, with its input
verbatim; the selection line verbatim; every file under `references/` read, in order; every
fixture file read, in order, and whether before or after the `frontend-engineering` call;
whether the run was cut off by `max_turns` (yes or no); whether the answer names the
module-scope `basket` as a cross-request leak.

## Note for scoring

Report per arm, `en` and `hu` separately, the (f) fire rate and the (s) rate, each as `n` of
5, beside `trigger-nuxt`'s rates for the same arm. (f) is the line under test; (s) shows the
router ran to its selection once fired. A run cut off by `max_turns` without a selection line
counts in the (s) rate as a fail, and each arm's (s) rate is reported with the number of its
runs cut off by `max_turns` beside it. A rate below 5/5 is recorded as the result, not a
void. The answer's diagnosis is not scored.
