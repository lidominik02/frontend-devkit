---
type: llm
weight: 1
---

Tests whether a business rule's reason survives into the written spec, and whether a rule
given without a reason gets that reason asked rather than supplied. The story states two
rules. The $5,000 threshold comes with a specific reason: two large transfers were used to
hide a shrinkage problem before an audit. The 48-hour expiry comes with none. A spec that
keeps the threshold's number but not its reason has lost the fact that settles the
threshold's edges later; a spec that gives the expiry a plausible reason nobody stated has
recorded a guess as a requirement. Capability, on `clarifying-features`.

## Run

Hand-run, both arms, from the fixture below, with the scripted answers. The skill asks
through forms, so a harness run ends at its first form with nothing written. Use the
README's hand-run rig, interactively (`claude`, not `-p`), so each form can be answered;
the with-plugin arm loads `plugins/core` and `plugins/vue`, since the fixture is a Vue
app. Every run gets `--strict-mcp-config` with an empty `{"mcpServers":{}}`. Stop where the
scripted answers say.

**User-level instructions.** Where an API key is available, run both arms with `--bare`, as
the evals README's hand-run rig describes. No line here depends on a hook. Without an API
key, run without `--bare` and score the lines "Note for scoring" names as
non-discriminating on that machine.

## Fixture

A fresh directory per run, a git repository with one commit:

```
.gitignore                     node_modules/ and temp/, one per line
package.json                   below
openapi.yaml                   below
src/api/generated/transfers.ts below
src/stores/session.ts          below
src/stores/transfers.ts        below
src/views/TransferList.vue     below
```

`package.json`:

```json
{
  "name": "warehouse-web",
  "private": true,
  "type": "module",
  "scripts": { "typecheck": "vue-tsc --noEmit", "lint": "eslint src" },
  "dependencies": { "pinia": "^2.2.0", "vue": "^3.5.0" },
  "devDependencies": { "eslint": "^9.0.0", "typescript": "^5.6.0", "vue-tsc": "^2.1.0" }
}
```

`openapi.yaml`:

```yaml
openapi: 3.0.3
info: { title: Warehouse API, version: 1.4.0 }
paths:
  /transfers:
    get: { operationId: listTransfers }
    post: { operationId: createTransfer }
  /transfers/{id}/approve:
    post: { operationId: approveTransfer }
  /transfers/{id}/reject:
    post:
      operationId: rejectTransfer
      requestBody:
        content:
          application/json:
            schema: { type: object, required: [reason], properties: { reason: { type: string } } }
components:
  schemas:
    Transfer:
      type: object
      required: [id, fromWarehouseId, toWarehouseId, stockValue, status, initiatedBy, createdAt]
      properties:
        id: { type: string }
        fromWarehouseId: { type: string }
        toWarehouseId: { type: string }
        stockValue: { type: number, description: Stock value in USD }
        status: { type: string, enum: [completed, pending_approval, rejected, cancelled] }
        initiatedBy: { type: string }
        approvedBy: { type: string, nullable: true }
        rejectionReason: { type: string, nullable: true }
        createdAt: { type: string, format: date-time }
```

`src/api/generated/transfers.ts`:

```ts
// Generated from openapi.yaml. Do not edit.
export type TransferStatus = 'completed' | 'pending_approval' | 'rejected' | 'cancelled'

export interface Transfer {
  id: string
  fromWarehouseId: string
  toWarehouseId: string
  stockValue: number
  status: TransferStatus
  initiatedBy: string
  approvedBy: string | null
  rejectionReason: string | null
  createdAt: string
}

export interface NewTransfer {
  fromWarehouseId: string
  toWarehouseId: string
  lines: { sku: string; quantity: number }[]
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

export const listTransfers = () => request<Transfer[]>('GET', '/transfers')
export const createTransfer = (body: NewTransfer) => request<Transfer>('POST', '/transfers', body)
export const approveTransfer = (id: string) => request<Transfer>('POST', `/transfers/${encodeURIComponent(id)}/approve`)
export const rejectTransfer = (id: string, body: { reason: string }) =>
  request<Transfer>('POST', `/transfers/${encodeURIComponent(id)}/reject`, body)
```

`src/stores/session.ts`:

```ts
import { defineStore } from 'pinia'

export const useSessionStore = defineStore('session', {
  state: () => ({ userId: '', role: 'warehouse_manager' as 'warehouse_manager' | 'finance' }),
})
```

`src/stores/transfers.ts`:

```ts
import { defineStore } from 'pinia'
import { createTransfer, listTransfers, type NewTransfer, type Transfer } from '../api/generated/transfers'

export const useTransfersStore = defineStore('transfers', {
  state: () => ({ items: [] as Transfer[], loading: false }),
  actions: {
    async load() {
      this.loading = true
      try {
        this.items = await listTransfers()
      } finally {
        this.loading = false
      }
    },
    async create(input: NewTransfer) {
      const created = await createTransfer(input)
      this.items.unshift(created)
      return created
    },
  },
})
```

`src/views/TransferList.vue`:

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useTransfersStore } from '../stores/transfers'

const transfers = useTransfersStore()
onMounted(() => transfers.load())
</script>

<template>
  <p v-if="transfers.loading">Loading transfers…</p>
  <table v-else>
    <tr v-for="t in transfers.items" :key="t.id">
      <td>{{ t.fromWarehouseId }} → {{ t.toWarehouseId }}</td>
      <td>{{ t.stockValue.toFixed(2) }}</td>
      <td>{{ t.status }}</td>
    </tr>
  </table>
</template>
```

No `temp/` folder. Rig check before each run: `git status --short` prints nothing, `ls temp`
fails, and `/mcp` in the session lists no connected server. Record which isolation applied:
`--bare` with an API key, or, without it, the user-level instruction files present
(`ls ~/.claude/CLAUDE.md ~/.claude/rules/`).

## Scripted answers

In order of precedence, for every form or chat question in either arm:

1. A question about why a transfer waiting for approval is cancelled after 48 hours —
   whatever its options — gets the free-text answer: "Stock is counted every other night.
   A transfer left pending across a count leaves the stock out of both warehouses'
   expected figures, so finance wants anything older than 48 hours cancelled before the
   next count."
2. The extras block: "leave it out" for every extra.
3. The question confirming the spec (Plan it, Change something, Stop here): "Plan it".
   End the session at the next question after it, unanswered.
4. A question asking whether to start building: end the session there, unanswered.
5. Anything else: the option marked "(recommended)"; with none marked, the first option.
   A chat question with no options gets "Go with what you'd recommend."

A chat message holding several questions gets one reply, answering each by these rules. The
session also ends when the run ends its turn with no question and no background task still
running, and at the first edit to an application file, which is scored.

Record, per run, the full text of every question asked, its options in order, and the
option picked.

## Criteria

"The written spec" is `temp/warehouse-transfer-approvals/planning/SPEC.md` with the plugin.
In the baseline arm it is whichever file holds the requirements or, when there is none, the
final chat message that states them. A run with no written spec fails every line that needs
one. "An application file" is anything under `src/`, `package.json` or `openapi.yaml`.

A reason counts as given only when the story states it for that rule, or the user gave it in
an answer, typed or picked from the run's options. The story's reason for the threshold is
not a reason for the 48-hour expiry: carrying it over is the run's own inference.

Passes if it does ALL of:
- Asks the user why a transfer is cancelled after 48 hours before recording any reason for
  that rule. A question whose recommended answer says the reason is unknown, or names who
  would know, passes; a question that proposes a reason nobody gave as the recommended or
  settled answer does not.
- The written spec records the $5,000 threshold and the rule that the initiator cannot
  approve their own transfer, each beside the reason the story gives for them — in the same
  entry as the rule (its bullet, row or rationale line), not only in Outcome or elsewhere.
  The reason passes when it says large transfers were used to hide shrinkage between
  locations; the incident's details (two transfers, last quarter, before an audit) are
  optional.
- The written spec records the 48-hour expiry beside the reason the scripted answer gave —
  stock is counted every other night, and a transfer pending across a count throws the
  counts off.
- No rule carries a reason that neither the story nor an answer gave; a rule still without
  one is marked as assumed or unconfirmed.
- Keeps the rejection notification, with its reason sent back to the initiator.
- Implements nothing: no application file is created or changed. A requirements document
  may be written anywhere.

Fails if it does ANY of:
- Records a reason for the 48-hour expiry that the user never gave, without asking —
  "to avoid stale requests", "to keep stock accurate" — or asks and then records a
  different reason than the answer.
- States the threshold's reason only as a gesture or not at all. "Audit", "compliance",
  "fraud prevention" or "financial controls", with no mention of shrinkage being hidden, is
  the gesture: a hedge that fits almost any compliance feature is an omission of the actual
  reason.
- Drops the same-initiator restriction or the rejection notification.
- Writes application code.

## Note for scoring

Score per line. The line that decides whether asking for a rule's reason earns its place is
the first: a bare model that records a plausible reason for the expiry without asking fails
it, however good the rest of its spec is. The baseline is expected to fail that line and to
pass the rejection-notification line; the other lines carry no expectation, so compare arms
on them. The baseline arm gets the same answers in chat, to whichever of these questions it
asks; a run that asks none is scored on what it wrote.

**Lines a runner's user-level instructions can decide.** Without `--bare`, user-level
instructions load in both arms. Where they tell the model to ask rather than guess, or to
state its assumptions, they already carry the 48-hour question line, the no-invented-reason
line and the first fails-if line. On such a machine, record those three but score them
non-discriminating. The first of them decides this case, so the verdict on the rationale
probe waits for a `--bare` run.
