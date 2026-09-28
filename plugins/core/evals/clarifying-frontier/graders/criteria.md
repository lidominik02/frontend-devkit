---
type: llm
weight: 1
---

Tests how `clarifying-features` handles work that arrives without a user story — a ticket
that is only a title, rough notes in Hungarian, a design link the session cannot open —
and whether it tells that apart from a small change. On the feature route the claim is
facts first: the classification said out loud with its reasons; a claim the user makes
about the code checked against the code; a business rule given without a reason gets its
reason asked; every question a form with the recommended option first; no question about
something the repository answers; nothing built. On a small request the claim is the
short route: a design written in chat and approved through a form, with no spec or plan.
Capability on the feature route; the short route is a regression guard.

## Arms

Both arms run against the same fixture and are scored only on the lines under their own
heading.

- **Arm A** — `prompt.md`: the ticket, the notes, the unreadable design link, and the
  user's claim that the list already paginates on the server, which the fixture
  contradicts.
- **Arm B** — this prompt, with `max_turns: 30` and the same `allowed_tools` as
  `prompt.md`:

  ```
  /core:clarifying-features

  On the new-supplier form, the phone field takes anything, letters included. Make it
  accept only digits, spaces and a leading +.
  ```

Arm B runs with the plugin only. A bare model asked directly for a one-field change makes
it, and the classification, the in-chat design and the approval form exist only in the
skill, so a baseline run would fail by construction and say nothing about retention. Arm B
is a regression guard on the route choice instead: a with-plugin run that over-clarifies a
one-field change, edits before the approval or asks what the repository answers is a defect
in the skill.

## Run

Hand-run from the fixture below, with the scripted answers: Arm A with the plugin and
without, Arm B with the plugin only, two runs of each. The skill asks through forms, so a
harness run ends at its first form. Use the README's hand-run rig, interactively (`claude`,
not `-p`), so each form can be answered. The with-plugin runs load `plugins/core` and
`plugins/vue`, since the fixture is a Vue app. Every run gets `--strict-mcp-config` with an
empty `{"mcpServers":{}}`, so no design tool can open the link. Stop where the scripted
answers say.

**User-level instructions.** Where an API key is available, run every arm with `--bare`, as
the evals README's hand-run rig describes. No line here depends on a hook; gate results are
not scored. Without an API key, run without `--bare` and score the lines "Note for scoring"
names as non-discriminating on that machine.

## Fixture

A fresh directory per run, a git repository with one commit:

```
.gitignore                         node_modules/ and temp/, one per line
package.json                       below
tsconfig.json                      below
openapi.yaml                       below
src/api/types.ts                   below
src/api/suppliers.ts               below
src/components/BaseToggle.vue      below
src/suppliers/SupplierList.vue     below
src/suppliers/SupplierForm.vue     below
src/orders/NewOrderForm.vue        below
```

`package.json`:

```json
{
  "name": "procurement-web",
  "private": true,
  "type": "module",
  "scripts": { "typecheck": "vue-tsc --noEmit", "lint": "eslint src", "test": "vitest run" },
  "dependencies": { "vue": "^3.5.0" },
  "devDependencies": {
    "eslint": "^9.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "vue-tsc": "^2.1.0"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "src/**/*.vue"]
}
```

`openapi.yaml` — `GET /suppliers` takes a `status` filter, no paging parameter, and answers
with one array:

```yaml
openapi: 3.0.3
info: { title: Procurement API, version: 2.3.0 }
paths:
  /suppliers:
    get:
      operationId: listSuppliers
      parameters:
        - { name: status, in: query, required: false, schema: { type: string, enum: [active, inactive] } }
      responses:
        '200':
          description: Suppliers
          content:
            application/json:
              schema: { type: array, items: { $ref: '#/components/schemas/Supplier' } }
    post: { operationId: createSupplier }
  /orders:
    post: { operationId: createOrder }
components:
  schemas:
    Supplier:
      type: object
      required: [id, name, vatNumber, phone, status]
      properties:
        id: { type: string }
        name: { type: string }
        vatNumber: { type: string }
        phone: { type: string }
        status: { type: string, enum: [active, inactive] }
```

`src/api/types.ts`:

```ts
export type SupplierStatus = 'active' | 'inactive'

export interface Supplier {
  id: string
  name: string
  vatNumber: string
  phone: string
  status: SupplierStatus
}
```

`src/api/suppliers.ts`:

```ts
import type { Supplier, SupplierStatus } from './types'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

export function listSuppliers(params: { status?: SupplierStatus } = {}): Promise<Supplier[]> {
  const query = params.status ? `?status=${encodeURIComponent(params.status)}` : ''
  return request<Supplier[]>('GET', `/suppliers${query}`)
}

export const createSupplier = (input: Omit<Supplier, 'id' | 'status'>) =>
  request<Supplier>('POST', '/suppliers', input)
```

`src/components/BaseToggle.vue`:

```vue
<script setup lang="ts">
defineProps<{ label: string }>()
const model = defineModel<boolean>({ required: true })
</script>

<template>
  <label>
    <input type="checkbox" role="switch" v-model="model" />
    {{ label }}
  </label>
</template>
```

`src/suppliers/SupplierList.vue` — loads every supplier in one request and renders every
row; there is no paging anywhere:

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { listSuppliers } from '../api/suppliers'
import type { Supplier } from '../api/types'

const suppliers = ref<Supplier[]>([])
const loading = ref(true)

onMounted(async () => {
  suppliers.value = await listSuppliers()
  loading.value = false
})
</script>

<template>
  <p v-if="loading">Loading suppliers…</p>
  <table v-else>
    <thead><tr><th>Name</th><th>VAT number</th><th>Status</th></tr></thead>
    <tbody>
      <tr v-for="s in suppliers" :key="s.id">
        <td>{{ s.name }}</td>
        <td>{{ s.vatNumber }}</td>
        <td>{{ s.status }}</td>
      </tr>
    </tbody>
  </table>
</template>
```

`src/suppliers/SupplierForm.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { createSupplier } from '../api/suppliers'

const name = ref('')
const vatNumber = ref('')
const phone = ref('')
const error = ref<string | null>(null)

async function submit() {
  error.value = null
  if (!name.value.trim()) {
    error.value = 'Name is required.'
    return
  }
  await createSupplier({ name: name.value.trim(), vatNumber: vatNumber.value.trim(), phone: phone.value.trim() })
}
</script>

<template>
  <form @submit.prevent="submit">
    <label for="name">Name</label>
    <input id="name" v-model="name" />
    <label for="vat">VAT number</label>
    <input id="vat" v-model="vatNumber" />
    <label for="phone">Phone</label>
    <input id="phone" v-model="phone" type="tel" />
    <p v-if="error" role="alert">{{ error }}</p>
    <button type="submit">Save supplier</button>
  </form>
</template>
```

`src/orders/NewOrderForm.vue`:

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { listSuppliers } from '../api/suppliers'
import type { Supplier } from '../api/types'

const suppliers = ref<Supplier[]>([])
const supplierId = ref('')

onMounted(async () => {
  suppliers.value = await listSuppliers()
})
</script>

<template>
  <form>
    <label for="supplier">Supplier</label>
    <select id="supplier" v-model="supplierId">
      <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
    </select>
    <slot name="lines" />
    <button type="submit" :disabled="!supplierId">Place order</button>
  </form>
</template>
```

No `temp/` folder, no `.claude/` folder. Rig check before each run: `git status --short`
prints nothing, `ls temp` fails, and `/mcp` in the session lists no connected server.
Record which isolation applied: `--bare` with an API key, or, without it, the user-level
instruction files present (`ls ~/.claude/CLAUDE.md ~/.claude/rules/`).

The notes translate as: inactive suppliers should not show in the supplier list by default;
there should be a toggle that shows them anyway; no new order can be placed with an
inactive supplier; the design link.

## Scripted answers

**Arm A**, for every form or chat question, in order of precedence:

1. A question about the design link — asking for screenshots or an export, or how to go on
   without the frame: the option that proceeds from the repository's existing screens;
   with no such option, the free-text answer "I can't get screenshots today — work from
   the existing screens."
2. A question about why an inactive supplier cannot receive new orders: the free-text
   answer "Inactive means we're in a payment dispute with the supplier, and finance has put
   new orders on hold until it's settled. Orders placed before that still go through."
3. The question confirming the spec (Plan it, Change something, Stop here), or a question
   asking whether to start building: end the session there, unanswered.
4. Anything else, the pagination question included: the option marked "(recommended)";
   with none marked, the first option. A chat question with no options gets "Go with what
   you'd recommend."

A chat message holding several questions gets one reply, answering each by these rules. The
session also ends when the run ends its turn with no question and no background task still
running, and at the first edit to an application file, which is scored.

**Arm B**:

1. The first form: the option marked "(recommended)".
2. The design approval: "Build it".
3. Anything else: the option marked "(recommended)", else the first option. A chat
   question with no options gets "Go with what you'd recommend."
4. End the session at the first of: a `Skill` call to `reviewing-changes`, any question
   after the design approval, the run ending its turn with no question and no background
   task still running, or `max_turns`.

Record, per run, the full text of every question asked, its options in order, and the
option picked.

"An application file" is anything under `src/`, `package.json`, `tsconfig.json` or
`openapi.yaml`.

## Arm A

Passes if it does ALL of:
- Before its first question, states the classification with a reason for each part taken
  from this work: the larger route rather than a small change — two screens and a rule
  whose edges are open, for example — a change with UI, and whether the API is involved.
  Any API verdict passes when its reason is drawn from the repository, such as what
  `openapi.yaml` offers for `/suppliers` and `/orders`.
- Checks the pagination claim against the repository before building on it, and — since
  `openapi.yaml` gives `GET /suppliers` no paging parameter and a single array, and
  `SupplierList.vue` loads every supplier in one request — puts the contradiction to the
  user as a question that quotes the claim and shows the evidence with its location: in the
  question, or in a research note the question names that cites `path:line`. The
  recommended option follows the evidence. It neither records paging as existing nor
  silently corrects the user.
- Asks why an inactive supplier cannot receive new orders, rather than supplying a reason.
  A question whose recommended option says the reason is unknown, or names who would know,
  passes; one whose recommended option proposes a reason nobody gave does not.
- Asks every question through a form, the recommended option first, each option saying
  what choosing it leads to.
- Asks nothing the repository answers: whether suppliers have a status and which values it
  takes (`src/api/types.ts`), whether the list endpoint filters by status (`openapi.yaml`,
  `src/api/suppliers.ts`), whether a toggle component exists
  (`src/components/BaseToggle.vue`), where orders are placed and how the supplier is
  chosen (`src/orders/NewOrderForm.vue`). Paging comes up only as the contradiction.
- Implements nothing: no application file is created or changed.

Fails if it does ANY of:
- Treats paging as done — records it as existing, or scopes no work for it without having
  asked about it.
- Records a reason for the order rule that nobody gave.
- Asks one of the facts listed above.
- Asks in prose where a form was available, or puts the recommended option anywhere but
  first.
- Starts building the feature.

## Arm B

Passes if it does ALL of:
- Before its first question, states the classification as a small, contained change with
  its reasons: one form, one field, no API need, no open product question.
- Writes the design in chat — what changes and where (the phone field in
  `src/suppliers/SupplierForm.vue`), its error state, the acceptance criteria — and asks
  for approval through a form whose first option approves it.
- Writes no spec and no plan: no `temp/<feature>/planning/` folder, and no `SPEC.md` or
  `PLAN.md` anywhere.
- Edits nothing before the approval; after it, makes the change in the main session.

Fails if it does ANY of:
- Opens a full clarification — rounds of questions, a spec, a plan — for a one-field
  validation change.
- Edits a file before the design is approved.
- Asks something the repository answers, such as where the form lives or how it shows a
  validation error (the name field's "Name is required." is the pattern).

One gap question with a recommended default, folded into the round-1 form, or an edge the
design states as an assumption — whether an empty phone is still allowed, say — keeps the
run on the short route for both lists. A second round of questions does not.

## Note for scoring

Score per arm and per line. Arm A's baseline is expected to fail the pagination line —
building on the user's claim — and the order-rule reason line. Its classification and form
lines describe the skill's own conventions and are expected to fail at baseline too; they
show that the route ran, and on their own do not argue for retention. Arm B has no baseline
and gives no retention verdict: a with-plugin run that fails one of its lines is a
regression in the route choice.

Also record, unscored: whether the Hungarian notes appear in what the run writes quoted
verbatim, with a translation beside them, rather than paraphrased. Read it only next to the
rig record of which user-level instructions loaded, since such an instruction can require
exactly that.

**Lines a runner's user-level instructions can decide.** Without `--bare`, user-level
instructions load in both arms. Where they tell the model to ask rather than guess, they
already carry Arm A's order-rule reason line and its invented-reason fails-if line; where
they tell it to put decisions to the user through forms, Arm A's form line and its
prose fails-if line. On such a machine, record those lines but score them
non-discriminating.
