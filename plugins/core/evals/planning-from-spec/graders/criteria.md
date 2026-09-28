---
type: llm
weight: 1
---

Tests whether the plan is built from the spec it is handed rather than retold from it:
named tasks that each deliver one observable behaviour, the spec's exact values carried
over verbatim, every success criterion and review concern owned by a task, decisions
rather than code, and an open question that blocks one task handled by planning that task
around it instead of stopping. Capability.

## Run

Hand-run, both arms, from the fixture below: `planning-features` writes no plan when
`SPEC.md` is absent from disk, so the empty directory a harness run gets would measure the
missing file instead of the plan. Use the README's hand-run rig, interactively (`claude`,
not `-p`), so the approval question is shown rather than failing. Scored up to and
including the first question the run puts to the user; end the session there. A run that
hands back on a SPEC gap other than the owned open question is void, not a fail: record
the gap it named.

User-level instructions: run both arms with `--bare` and an API key, as the README's
hand-run rig describes, so neither arm sees `~/.claude/CLAUDE.md` or `~/.claude/rules/`. No
line here depends on a hook. Without an API key, both arms load the runner's user-level
instructions. On a machine whose user-level instructions hold commits for the user, or
hold verification to typecheck and lint, the no-commit-step line and the Done-when line are
non-discriminating: a baseline pass there comes from the runner's configuration, not from
the model unaided. The rig check records which applied.

## Fixture

A fresh directory per run, a git repository with one commit:

```
.gitignore                           node_modules/ and temp/, one per line
package.json                         below
src/api/client.ts                    below
src/invoices/InvoiceForm.vue         below
src/invoices/invoicePdf.ts           below
src/creditNotes/CreditNoteForm.vue   below
src/reports/revenue.ts               below
```

`package.json`:

```json
{
  "name": "invoicing-web",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "vue-tsc --noEmit",
    "lint": "eslint src",
    "test": "vitest run"
  },
  "dependencies": { "vue": "^3.5.0" },
  "devDependencies": { "eslint": "^9.0.0", "typescript": "^5.6.0", "vitest": "^2.1.0", "vue-tsc": "^2.1.0" }
}
```

`src/api/client.ts`:

```ts
export interface InvoiceLine { description: string; amount: number }
export interface Invoice { id: string; customerId: string; lines: InvoiceLine[]; issuedAt: string | null }
export interface Customer { id: string; name: string; currency: string }

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

export const getCustomer = (id: string) => request<Customer>('GET', `/customers/${encodeURIComponent(id)}`)
export const listInvoices = () => request<Invoice[]>('GET', '/invoices')
export const createInvoice = (body: { customerId: string; lines: InvoiceLine[] }) => request<Invoice>('POST', '/invoices', body)
export const createCreditNote = (body: { invoiceId: string; lines: InvoiceLine[] }) => request<{ id: string }>('POST', '/credit-notes', body)
```

`src/invoices/InvoiceForm.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { createInvoice, type InvoiceLine } from '../api/client'

const props = defineProps<{ customerId: string }>()
const lines = ref<InvoiceLine[]>([])

async function issue() {
  await createInvoice({ customerId: props.customerId, lines: lines.value })
}
</script>

<template>
  <form @submit.prevent="issue">
    <slot name="lines" :lines="lines" />
    <button type="submit">Issue invoice</button>
  </form>
</template>
```

`src/invoices/invoicePdf.ts`:

```ts
import type { Invoice } from '../api/client'

export function invoicePdfLines(invoice: Invoice): string[] {
  const total = invoice.lines.reduce((sum, l) => sum + l.amount, 0)
  return [...invoice.lines.map((l) => `${l.description}  ${l.amount.toFixed(2)} EUR`), `Total  ${total.toFixed(2)} EUR`]
}
```

`src/creditNotes/CreditNoteForm.vue`:

```vue
<script setup lang="ts">
import { createCreditNote, type Invoice } from '../api/client'

const props = defineProps<{ invoice: Invoice }>()

async function issue() {
  await createCreditNote({ invoiceId: props.invoice.id, lines: props.invoice.lines })
}
</script>

<template>
  <button @click="issue">Issue credit note</button>
</template>
```

`src/reports/revenue.ts`:

```ts
import type { Invoice } from '../api/client'

export function totalRevenue(invoices: Invoice[]): number {
  return invoices
    .filter((i) => i.issuedAt !== null)
    .reduce((sum, i) => sum + i.lines.reduce((s, l) => s + l.amount, 0), 0)
}
```

After the commit, outside git, under `temp/multi-currency/planning/`:

- `SPEC.md` — exactly the first markdown block the prompt pastes.
- `OPEN-QUESTIONS.md` — exactly the second markdown block the prompt pastes.
- `DECISIONS.md`:

  ```
  - **D1** · 2026-09-18 · support EUR, USD and GBP only
    - Rejected: every ISO currency
    - Source: the product owner: "those three cover every customer we bill"
  - **D2** · 2026-09-18 · a failed rates request blocks issuing, with the error copy in SPEC States
    - Rejected: fall back to EUR
    - Source: SPEC States
  - **D3** · 2026-09-18 · show today's rate beside each option in the currency selector
    - Rejected: plain currency codes
    - Source: the user accepted it as an extra
  ```

- `HANDOFF.md`:

  ```
  # Handoff: multi-currency — temp/multi-currency/planning/PLAN.md

  ## Stage
  clarify — owner: clarifying-features
  Execution mode: not chosen
  Rules: the default rules block

  ## Status
  SPEC.md confirmed by the user on 2026-09-18. One open question with the product owner, in OPEN-QUESTIONS.md.

  ## Next action
  Write the plan — planning-features.

  ## Kickoff prompt
  Resume the feature multi-currency with the planning-features skill, in resume mode.
  Read first, in order:
  1. temp/multi-currency/planning/HANDOFF.md
  2. temp/multi-currency/planning/SPEC.md
  3. temp/multi-currency/planning/DECISIONS.md
  4. temp/multi-currency/planning/OPEN-QUESTIONS.md
  Stage: clarify — owner: clarifying-features.
  Next action: write the plan.
  Rules: the default rules block of planning-features.
  ```

Dependencies need not be installed; the plan lists the gates, it does not run them.

Rig check before each run: `git status --short` prints nothing, and
`ls temp/multi-currency/planning` lists `DECISIONS.md`, `HANDOFF.md`, `OPEN-QUESTIONS.md`
and `SPEC.md`, and no `PLAN.md`. Record whether both arms ran with `--bare` and an API key,
or without it and with user-level instructions present.

## Scripted answers

None. End the session at the first question the run puts to the user, unanswered. With the
plugin that question is the plan's approval.

## Criteria

Passes if it does ALL of:
- Writes the plan to a file a later session can find, before the first question — any
  path in the repository counts; with the plugin, `temp/multi-currency/planning/PLAN.md`. A
  plan presented only through the harness's plan mode or task list, with no file, fails
  this line.
- The plan is a list of named tasks, each delivering one behaviour a user can observe,
  built through every layer it needs — for example, choosing the currency on a new invoice
  covers the rates call, the form and the stored rate. Tasks split by layer ("all API
  changes", "all UI") fail this line, and so does an enabling task that delivers nothing a
  user can observe — the rates client or the `Invoice` type on its own — even when it is
  the only one and the slices after it consume it.
- The plan carries the spec's exact values verbatim, in a section every task is held to:
  `EUR, USD, GBP` in that order, `6 decimal places`, `half-even`, `2 decimal places`,
  `16:00 CET`, `Rate on issue date: 1 EUR = {rate} {currency}` and
  `Exchange rates are unavailable. Try again in a few minutes.`
- Every one of the six success criteria is an acceptance criterion of some task, the
  EXTRA one (today's rate in the selector) included.
- Each of the two review concerns — a draft issued after a rate change takes the new rate
  while an issued invoice keeps its own; the dashboard never adds mixed currencies — is
  assigned to a named task: listed with that task's name, or written into that task's
  acceptance criteria.
- Steps say what to decide or produce and where; no step contains a function body, a
  component template or other code, beyond fixed copy or a rule the interfaces do not
  determine, such as the rounding. An exact signature or type shape is an interface, not
  code, wherever the plan writes it.
- No task has a step to commit, stage, push or open a merge request.
- Every task's done condition names the repository's fast gates — typecheck and lint, as
  `package.json` declares them — and no task's done condition requires the test suite or
  the build.
- The credit-note work is planned as a task and carries the open question as what blocks
  it; the other tasks are planned without waiting for it. A credit-note split in which only
  the rate task is blocked passes.
- Leaves the open question open: neither rate is chosen for credit notes as if settled. A
  provisional choice — "use the invoice's rate until the product owner answers" — counts as
  choosing it; a task that waits for the answer, or plans both outcomes, does not.

Fails if it does ANY of:
- Writes no plan to disk.
- Stops before writing the plan to ask the open question, or refuses to plan until it is
  answered.
- Answers the open question itself, provisionally included, or drops the credit-note work
  or the EXTRA criterion.
- Paraphrases a planted value — "a few decimal places", "banker's rounding", "mid
  afternoon", or reworded copy — where the paraphrase stands in for the value: the plan
  states that value only in other words, or a step rewords a copy string. A synonym or an
  abbreviation beside a value that the section every task is held to carries verbatim —
  "half-even (banker's rounding)", "2 dp" — does not fire this line.
- Splits the tasks by layer, or writes code into the steps beyond fixed copy or a rule the
  interfaces do not determine.
- Includes a commit step, or starts implementing.

A line in this list that fires fails the run, whatever the list above passes.

## Note for scoring

Score per line, after reading the Run section's note on user-level instructions. No
baseline expectation is claimed — compare arms. The spec's own section headings are in the
prompt, so a bare model has the values in front of it; the lines to read first are the
verbatim values, the review concerns assigned to tasks, the blocked task planned rather
than the plan stopped, and the absence of a commit step. Record whether the baseline arm
reached for the harness's own plan mode or task list; the first line scores what that
produced.
