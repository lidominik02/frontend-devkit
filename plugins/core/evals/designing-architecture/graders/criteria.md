---
type: llm
weight: 1
---

Tests how `designing-architecture` evaluates a design the user brings: a new composable that
wraps an existing one, for a single page. The run must find the existing mechanism and count
its callers before judging, put a substantially different option beside the user's, state
what the user's design costs to carry — one consumer included — write no code, and leave the
decision to the user. The fixture makes the proposal look reasonable: `usePaginatedQuery`
already serves three pages exactly as the orders page needs, so the wrapper only forwards.
Capability on the first, second, third and fifth lines; the no-code line is a regression
guard (see the note).

## Run

Hand-run from the fixture below, with the plugin and without it, two runs of each. The
skill asks through forms, so a harness run ends at its first form. Use the evals README's
hand-run rig, interactively (`claude`, not `-p`), so each form can be answered. The
with-plugin runs load `plugins/core` only: the case scores the generic skill, and the `vue`
pack is not under test. Every run gets `--strict-mcp-config` with an empty
`{"mcpServers":{}}`.

Line 1 of the prompt is the typed invocation; the text after it is the user's proposal.
Before the first baseline run, check whether the CLI passes an unknown
`/core:designing-architecture` through to the model as text; when it rejects it instead, the
baseline prompt is the same without line 1. Record which, with the CLI version.

**User-level instructions.** Where an API key is available, run every arm with `--bare`, as
the evals README's hand-run rig describes; no line here depends on a hook. Without one, read
the runner's `~/.claude/CLAUDE.md` and `~/.claude/rules/` first: a rule that holds edits
until asked makes the no-code line non-discriminating on that machine; a rule to search
before adding code does the same for the existing-mechanism line, and a rule against
speculative abstractions for the cost line. Score and record such a line, but do not let it
decide retention.

## Fixture

A fresh directory per run, a git repository with one commit, "Initial commit", holding:

```
.gitignore                          node_modules/ and temp/, one per line
package.json                        below
tsconfig.json                       below
src/api/types.ts                    below
src/composables/usePaginatedQuery.ts  below — the existing mechanism
src/pages/CustomersPage.vue         below — caller 1
src/pages/InvoicesPage.vue          below — caller 2
src/pages/ProductsPage.vue          below — caller 3
src/pages/OrdersPage.vue            below — the one consumer of the proposal
src/main.ts                         below
```

Install the dependencies in `node_modules`, the one thing runs may share. Observed with
vue 3.5.43, vue-tsc 2.2.12 and typescript 5.9.3: `npx vue-tsc --noEmit` exits 0.

`package.json`:

```json
{
  "name": "toolrent-admin",
  "private": true,
  "type": "module",
  "scripts": { "typecheck": "vue-tsc --noEmit" },
  "dependencies": { "vue": "^3.5.0" },
  "devDependencies": { "typescript": "^5.6.0", "vue-tsc": "^2.1.0" }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts", "src/**/*.vue"]
}
```

`src/api/types.ts`:

```ts
export interface Page<T> {
  items: T[]
  total: number
}

export interface Customer { id: string; name: string; email: string }
export interface Invoice { id: string; number: string; totalCents: number }
export interface Product { id: string; name: string; dailyRateCents: number }
export interface Order { id: string; placedAt: string; customerName: string }
```

`src/composables/usePaginatedQuery.ts`:

```ts
import { ref, shallowRef, watch } from 'vue'
import type { Page } from '../api/types'

export function usePaginatedQuery<T>(url: string, pageSize = 20) {
  const page = ref(1)
  const items = shallowRef<T[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`${url}?page=${page.value}&pageSize=${pageSize}`)
      if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`)
      const body = (await res.json()) as Page<T>
      items.value = body.items
      total.value = body.total
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  watch(page, load, { immediate: true })
  return { page, items, total, pageSize, loading, error }
}
```

`src/pages/CustomersPage.vue`:

```vue
<script setup lang="ts">
import type { Customer } from '../api/types'
import { usePaginatedQuery } from '../composables/usePaginatedQuery'

const { page, items, total, pageSize, loading, error } = usePaginatedQuery<Customer>('/api/customers')
</script>

<template>
  <p v-if="error">{{ error }}</p>
  <table v-else :aria-busy="loading">
    <tr v-for="c in items" :key="c.id"><td>{{ c.name }}</td><td>{{ c.email }}</td></tr>
  </table>
  <button :disabled="page === 1" @click="page--">Previous</button>
  <button :disabled="page * pageSize >= total" @click="page++">Next</button>
</template>
```

`src/pages/InvoicesPage.vue` is `CustomersPage.vue` with `Customer` read as `Invoice`, the
call as `usePaginatedQuery<Invoice>('/api/invoices', 50)`, and the row as
`<tr v-for="i in items" :key="i.id"><td>{{ i.number }}</td><td>{{ (i.totalCents / 100).toFixed(2) }}</td></tr>`.

`src/pages/ProductsPage.vue` is `CustomersPage.vue` with `Customer` read as `Product`, the
call as `usePaginatedQuery<Product>('/api/products')`, and the row as
`<tr v-for="p in items" :key="p.id"><td>{{ p.name }}</td><td>{{ p.dailyRateCents / 100 }} per day</td></tr>`.

`src/pages/OrdersPage.vue`:

```vue
<script setup lang="ts">
import { onMounted, shallowRef } from 'vue'
import type { Order, Page } from '../api/types'

const orders = shallowRef<Order[]>([])

onMounted(async () => {
  const res = await fetch('/api/orders?page=1&pageSize=1000')
  orders.value = ((await res.json()) as Page<Order>).items
})
</script>

<template>
  <table>
    <tr v-for="o in orders" :key="o.id">
      <td>{{ o.id }}</td><td>{{ o.placedAt.slice(0, 10) }}</td><td>{{ o.customerName }}</td>
    </tr>
  </table>
</template>
```

`src/main.ts`:

```ts
import { createApp, type Component } from 'vue'
import CustomersPage from './pages/CustomersPage.vue'
import InvoicesPage from './pages/InvoicesPage.vue'
import OrdersPage from './pages/OrdersPage.vue'
import ProductsPage from './pages/ProductsPage.vue'

const pages: Record<string, Component> = {
  '/customers': CustomersPage,
  '/invoices': InvoicesPage,
  '/orders': OrdersPage,
  '/products': ProductsPage,
}
createApp(pages[location.pathname] ?? ProductsPage).mount('#app')
```

No `temp/` folder, no `.claude/` folder, no `CLAUDE.md` and no decision records, so the
evidence is the code alone.

Rig check before each run: `git status --short` prints nothing; `git log --oneline` prints
one commit; `git grep -l usePaginatedQuery -- src` lists exactly the composable and the
three pages above; `npx vue-tsc --noEmit` exits 0; `ls temp` fails. After a with-plugin
run's first turn, the init event carries `core@inline` and no transcript line contains
`plugins/cache`; the baseline arm's init event lists no `core` plugin. Record which
isolation applied: `--bare` with an API key, or, without it, the user-level instruction
files present.

## Scripted answers

In order of precedence:

1. A form choosing between designs — the user's wrapper beside any other option — or asking
   whether to approve or build one: end the session there, unanswered. It is the form the
   last criteria line scores.
2. A form or chat question offering to write the code: end the session there, unanswered.
3. A form confirming the question ("This is the question", "Change it") or asking about
   outside research: the option marked "(recommended)".
4. Anything else: the option marked "(recommended)"; with none marked, the first option. A
   chat question with no options gets "Go with what you'd recommend."

End the session at the first of: rule 1 or 2, the run ending its turn with no question and
no background task still running, the first edit to an application file (which is scored),
or `max_turns`. Record, per run, the full text of every question asked, its options in
order, and the option picked.

"An application file" is anything outside `temp/` and `node_modules/`.

## Criteria

Passes if it does ALL of:
- Names the existing mechanism with its path, `src/composables/usePaginatedQuery.ts`, and
  its call sites: three — `CustomersPage.vue`, `InvoicesPage.vue` and `ProductsPage.vue` —
  counted from a search the run made, not taken from the prompt.
- Offers, beside the user's design, at least one substantially different option: the orders
  page calling `usePaginatedQuery` directly as the three other pages do, or another design
  that adds no orders-only composable. A renamed wrapper, a wrapper with other parameters or
  in another folder is a variation, not a different option.
- States what the user's design costs to carry: that `useOrdersTable` would have one
  consumer, `OrdersPage.vue`, and what it adds — a second name to read through, a layer
  that only passes calls on, one more place to change when `usePaginatedQuery` changes, or
  the orders page working unlike the other three.
- Changes no application file — after the run, `git status --short` prints nothing and
  `git log --oneline` prints one commit — and writes neither the body of `useOrdersTable`
  nor a rewritten `OrdersPage.vue` in chat.
- Leaves the decision to the user through a form whose options include the user's design
  and the different option, each with its consequence.

Fails if it does ANY of:
- Agrees with the proposal, or argues against it, without having searched for and counted
  the callers of `usePaginatedQuery`; or gives a wrong count.
- Offers only the user's design, or only variations of it.
- Calls the wrapper good practice or "cleaner" without saying it has one consumer and what
  it costs to carry.
- Edits, creates or deletes any application file, stages or commits anything, or writes out
  the wrapper's implementation or the rewritten page.
- Decides for the user — "go ahead and add it", "don't add it" — as the run's last word, or
  asks only in chat without options.

Recorded, not scored: which option each run recommended, and whether it said what speaks for
the user's design; whether the with-plugin run wrote a draft `ARCHITECTURE-<slug>.md` in the
scratchpad; whether text for the user uses the reference's terms (module, depth, shallow,
seam) rather than the project's words; whether any run raised the orders endpoint's
`pageSize=1000` or a missing error state as a separate finding, and parked it.

## Note for scoring

Score per line, and compare plugin against no plugin.

Expected baseline: the bare model usually agrees with the proposal and does not search for an
existing mechanism. The user names `usePaginatedQuery`, so a baseline mentions it, but
without opening the pages that call it or counting them.
- **The existing mechanism** fails unaided: no search, no count.
- **The different option** fails unaided: the answer refines the wrapper — its name, its
  return value — rather than setting a design without it beside it.
- **The cost** fails unaided: a wrapper per table reads as tidy, and an agreeing answer does
  not say it has one consumer.
- **No code** is expected to pass unaided on files, because the prompt asks a question;
  a baseline that writes the wrapper out in chat fails it, and that is recorded with the
  line. It is kept as a regression guard: a with-plugin run that goes on from its
  recommendation into building is the defect the skill exists to prevent.
- **The decision** fails unaided: the bare answer ends on a verdict, not a form.

A baseline that passes the first three lines on both runs says the skill's evaluation of a
user's design adds nothing here, and by the retention table that part should go.
