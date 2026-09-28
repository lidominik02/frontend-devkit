---
type: llm
weight: 1
---

Tests whether the default rules get recorded durably when the user sets none, and whether
what gets recorded is the current set rather than a retired one. The route is a settled
spec handed to `planning-features`: the plan writes the handoff file before it asks for
approval, so everything scored here happens before the first question. Capability for the
durability line; a regression guard for the content lines.

## Run

Hand-run, both arms, from the fixture below: `planning-features` writes no plan when
`SPEC.md` is absent from disk, so the empty directory a harness run gets would measure the
missing file instead of the plan. Use the README's hand-run rig, interactively (`claude`,
not `-p`), so the approval question is shown rather than failing. Scored up to and
including the first question the run puts to the user; end the session there. A run that
stops at a SPEC gap before approval is void, not a fail: record the gap it named.

User-level instructions: run both arms with `--bare` and an API key, as the README's
hand-run rig describes, so neither arm sees `~/.claude/CLAUDE.md` or `~/.claude/rules/`. No
line here depends on a hook. Without an API key, both arms load the runner's user-level
instructions, and the with-plugin arm may read them as the user's own rules, which the
rules block ranks above its defaults: adopting one, stating it beside the default, or
asking whether a default still holds is then the rules block working. On a machine whose
user-level instructions say how execution, review, verification, commits or the
artifacts' language are handled, every criterion except the durability line (the first) is
non-discriminating, and the durability line also passes a record of the defaults with the
runner's own rules folded in. The rig check records which applied.

## Fixture

A fresh directory per run, a git repository with one commit:

```
.gitignore                 node_modules/ and temp/, one per line
package.json               below
src/api/orders.ts          below
src/orders/OrderPage.vue   below
src/orders/CancelOrderDialog.vue   below
```

`package.json`:

```json
{
  "name": "shop-web",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "vue-tsc --noEmit",
    "lint": "eslint src",
    "test": "vitest run",
    "build": "vite build"
  },
  "dependencies": { "vue": "^3.5.0" },
  "devDependencies": { "eslint": "^9.0.0", "typescript": "^5.6.0", "vite": "^5.4.0", "vitest": "^2.1.0", "vue-tsc": "^2.1.0" }
}
```

`src/api/orders.ts`:

```ts
export interface Order {
  id: string
  number: string
  status: 'placed' | 'shipped' | 'cancelled'
  placedAt: string
  paidAmount: number
  currency: string
}

export async function getOrder(id: string): Promise<Order> {
  const res = await fetch(`/api/orders/${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error(`GET /api/orders/${id} failed: ${res.status}`)
  return res.json()
}

export async function cancelOrder(id: string): Promise<void> {
  const res = await fetch(`/api/orders/${encodeURIComponent(id)}/cancel`, { method: 'POST' })
  if (!res.ok) throw new Error(`POST /api/orders/${id}/cancel failed: ${res.status}`)
}
```

`src/orders/OrderPage.vue`:

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getOrder, type Order } from '../api/orders'
import CancelOrderDialog from './CancelOrderDialog.vue'

const props = defineProps<{ orderId: string }>()
const order = ref<Order | null>(null)
const cancelling = ref(false)

onMounted(async () => {
  order.value = await getOrder(props.orderId)
})
</script>

<template>
  <section v-if="order">
    <h1>Order {{ order.number }}</h1>
    <p>Paid {{ order.paidAmount.toFixed(2) }} {{ order.currency }}</p>
    <button v-if="order.status === 'placed'" @click="cancelling = true">Cancel order</button>
    <CancelOrderDialog v-if="cancelling" :order-id="order.id" @close="cancelling = false" />
  </section>
</template>
```

`src/orders/CancelOrderDialog.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { cancelOrder } from '../api/orders'

const props = defineProps<{ orderId: string }>()
const emit = defineEmits<{ close: [] }>()
const submitting = ref(false)
const error = ref<string | null>(null)

async function submit() {
  submitting.value = true
  error.value = null
  try {
    await cancelOrder(props.orderId)
    emit('close')
  } catch {
    error.value = "We couldn't cancel your order. Try again."
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div role="dialog" aria-labelledby="cancel-title">
    <h2 id="cancel-title">Cancel this order?</h2>
    <p v-if="error" role="alert">{{ error }}</p>
    <button :disabled="submitting" @click="submit">Cancel order</button>
    <button @click="emit('close')">Keep order</button>
  </div>
</template>
```

After the commit, outside git:

- `temp/self-serve-refunds/planning/SPEC.md` — exactly the markdown block the prompt pastes.
- `temp/self-serve-refunds/planning/OPEN-QUESTIONS.md` — the single line `none`.

No `HANDOFF.md`, `DECISIONS.md` or `PLAN.md`: the handoff file is what this case watches
being written. Dependencies need not be installed; nothing scored runs a gate.

Rig check before each run: `git status --short` prints nothing, and
`ls temp/self-serve-refunds/planning` lists only `OPEN-QUESTIONS.md` and `SPEC.md`. Record
whether both arms ran with `--bare` and an API key, or without it and with user-level
instructions present.

## Scripted answers

None. End the session at the first question the run puts to the user, unanswered. With the
plugin that question is the plan's approval.

## Criteria

Passes if it does ALL of:
- Before the first question, a file under `temp/self-serve-refunds/` records the process
  rules that govern the build — how execution, review, verification and commits are run,
  not the SPEC's constraints — and that they are the defaults; with the plugin, the rules
  line of `planning/HANDOFF.md`. A pointer naming the default set suffices, and the reason
  need not be written. A rule stated only in chat is lost with the context.
- States the rules' content at least once before the first question — in chat, in the
  handoff file or in its kickoff prompt — and every statement of the content covers each of
  these, as rules adopted rather than options offered. A pointer-only rules line satisfies
  the line above, not this one:
  1. Clarification and planning share a session. Execution by a fresh worker per task
     continues in it; when one session builds every task, approval asks whether to start a
     new session from a paste-ready prompt — recommended — or to continue in it.
  2. How the plan is executed — a fresh worker per task, or every task in this session — is
     chosen when the plan is approved.
  3. Code review runs automatically after implementation; browser, design-tool and
     Storybook checks run only on request.
  4. Verification is held to the fast gates (typecheck and lint) until the user releases
     more: no test suite, build, Storybook or browser before then.
  5. A commit happens only after the user accepts a drafted message, and the user pushes.
  6. Artifacts are written in English; non-English input is quoted verbatim, then
     translated.
- The first question is the plan's approval and asks how to execute it, which is rule 2
  applied rather than recited.
- Runs nothing heavier than listing or running typecheck and lint, implements nothing,
  stages nothing and commits nothing.

Fails if it does ANY of:
- Records no rules on disk.
- States a retired or different default: implementation only in the main thread with no
  delegated worker; code review on request, never automatically; the test suite as fair
  game before release. Recommending Inline as one of the two offered modes is not this, and
  neither is a plan step that writes a test without running it.
- Hedges: states automatic review and review-on-request together, or defers the execution
  choice ("we can decide how to run it later") while the approval question does not ask it.
- Stops to ask the user to set rules before planning, after the user declined to set any.
- Runs a test suite, a build, Storybook or a browser, or starts implementing.

## Note for scoring

Score per line, after reading the Run section's note on user-level instructions. Baseline:
the content line is expected to fail unaided — these defaults belong to this pack, and a
bare model cannot know them. It and the retired-default and hedging lines are kept as a
regression guard against the recorded defaults drifting back to the retired set (review
only on request, implementation only in the main thread). The approval line is a guard
too: it checks that rule 2 is applied rather than recited, and is expected to fail
unaided, since the two execution modes are this pack's. The lines against asking for rules
and against running anything heavy are expected to hold in both arms. None of these
decides retention. No baseline expectation is claimed for the durability line: compare
arms. Whether a bare model writes its working rules to a file at all is the
question that decides whether recording them earns its place.
