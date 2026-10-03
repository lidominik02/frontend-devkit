---
type: llm
weight: 1
---

Tests three guardrails of `designing-architecture` when it is typed with no decision to
make: the run stops after a short list of what is worth restructuring, before designing any
of it; it changes no code; and it recommends no abstraction that would have a single
consumer. The fixture holds one real candidate — a price rule copied into three files that
the history shows changing together — and one generic-looking helper with a single caller,
so the tempting answer and the right one are both reachable. Capability on the stop and the
single-consumer lines; the other two lines are regression guards (see the note).

## Run

Hand-run from the fixture below, with the plugin and without it, two runs of each. The
skill asks through forms, so a harness run ends at its first form. Use the evals README's
hand-run rig, interactively (`claude`, not `-p`), so each form can be answered. The
with-plugin runs load `plugins/core` only: the fixture is plain TypeScript, so no framework
pack applies. Every run gets `--strict-mcp-config` with an empty `{"mcpServers":{}}`.

Line 1 of the prompt is the typed invocation. The text after it reaches the skill as its
argument and names no particular decision, so the skill routes it to its no-question
branch, the survey. The first form a with-plugin run shows tells which branch ran: the
survey's "Which one becomes the question?" form, or the question-confirming form ("This is
the question"). Record the branch for every with-plugin run, with the CLI version. A run on
the question branch has misrouted an open-ended request: a skill failure (see "Scripted
answers").

Before the first baseline run, check whether the CLI passes an unknown
`/core:designing-architecture` through to the model as text; when it rejects it instead,
the baseline prompt is the same without line 1. Record which, with the CLI version.

**User-level instructions.** Where an API key is available, run every arm with `--bare`, as
the evals README's hand-run rig describes; no line here depends on a hook. Without one, read
the runner's `~/.claude/CLAUDE.md` and `~/.claude/rules/` first: a rule that holds edits
until asked makes the "changes no code" line non-discriminating on that machine, and a rule
against speculative abstractions does the same for the single-consumer line. Score and
record such a line, but do not let it decide retention.

## Fixture

A fresh directory per run, a git repository with three commits:

```
.gitignore                      node_modules/ and temp/, one per line
package.json                    below
tsconfig.json                   below
src/api/types.ts                below
src/catalog/productCard.ts      below — price rule, copy 1
src/catalog/catalogPage.ts      below
src/cart/cartSummary.ts         below — price rule, copy 2
src/orders/orderRow.ts          below — price rule, copy 3
src/orders/ordersToCsv.ts       below — the helper with one caller
src/orders/ordersPage.ts        below
src/main.ts                     below
```

Install `typescript` in `node_modules`, the one thing runs may share.

`package.json`:

```json
{
  "name": "toolrent-web",
  "private": true,
  "type": "module",
  "scripts": { "typecheck": "tsc --noEmit" },
  "devDependencies": { "typescript": "^5.6.0" }
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
  "include": ["src"]
}
```

`src/api/types.ts`:

```ts
export interface Tool {
  id: string
  name: string
  dailyRateCents: number
}

export interface CartLine {
  tool: Tool
  days: number
}

export interface Order {
  id: string
  placedAt: string
  customerName: string
  totalCents: number
}
```

`src/catalog/productCard.ts`:

```ts
import type { Tool } from '../api/types'

function formatPrice(cents: number): string {
  if (cents === 0) return 'Included'
  return new Intl.NumberFormat('de-AT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function productCard(tool: Tool): string {
  return `<article class="card">
  <h3>${tool.name}</h3>
  <p>${formatPrice(tool.dailyRateCents)} per day</p>
</article>`
}
```

`src/catalog/catalogPage.ts`:

```ts
import type { Tool } from '../api/types'
import { productCard } from './productCard'

export async function renderCatalog(root: HTMLElement): Promise<void> {
  const response = await fetch('/api/tools')
  const tools = (await response.json()) as Tool[]
  root.innerHTML = tools.map(productCard).join('')
}
```

`src/cart/cartSummary.ts`:

```ts
import type { CartLine } from '../api/types'

const euros = new Intl.NumberFormat('de-AT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function cartSummary(lines: CartLine[]): string {
  const totalCents = lines.reduce((sum, line) => sum + line.tool.dailyRateCents * line.days, 0)
  const total = totalCents === 0 ? 'Included' : euros.format(totalCents / 100)
  return `<aside class="cart">
  <p>${lines.length} tools</p>
  <p>Total: ${total}</p>
</aside>`
}
```

`src/orders/orderRow.ts`:

```ts
import type { Order } from '../api/types'

export function orderRow(order: Order): string {
  const total =
    order.totalCents === 0
      ? 'Included'
      : (order.totalCents / 100).toLocaleString('de-AT', {
          style: 'currency',
          currency: 'EUR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })
  return `<tr><td>${order.id}</td><td>${order.placedAt.slice(0, 10)}</td><td>${total}</td></tr>`
}
```

`src/orders/ordersToCsv.ts`:

```ts
import type { Order } from '../api/types'

export function ordersToCsv(orders: Order[]): string {
  const header = 'Order,Date,Customer,Total'
  const lines = orders.map((order) =>
    [
      order.id,
      order.placedAt.slice(0, 10),
      `"${order.customerName.replace(/"/g, '""')}"`,
      (order.totalCents / 100).toFixed(2),
    ].join(','),
  )
  return [header, ...lines].join('\n')
}
```

`src/orders/ordersPage.ts`:

```ts
import type { Order } from '../api/types'
import { orderRow } from './orderRow'
import { ordersToCsv } from './ordersToCsv'

export async function renderOrders(root: HTMLElement): Promise<void> {
  const response = await fetch('/api/orders')
  const orders = (await response.json()) as Order[]
  root.innerHTML = `<table>${orders.map(orderRow).join('')}</table>
<a download="orders.csv" href="data:text/csv,${encodeURIComponent(ordersToCsv(orders))}">Export</a>`
}
```

`src/main.ts`:

```ts
import { renderCatalog } from './catalog/catalogPage'
import { renderOrders } from './orders/ordersPage'

const root = document.querySelector<HTMLElement>('#app')
if (root) {
  if (location.pathname.startsWith('/orders')) void renderOrders(root)
  else void renderCatalog(root)
}
```

Set-up, so the history shows the three price copies changing together:

1. `git init -b main`. Write every file above, except that in `productCard.ts`,
   `cartSummary.ts` and `orderRow.ts` both fraction-digit options read `2` and `'Included'`
   reads `'Free'`. Commit everything as "Initial commit".
2. In those three files only, set both fraction-digit options to `0`. Commit as "Round
   prices to whole euros".
3. In those three files only, change `'Free'` to `'Included'`. Commit as "Label zero prices
   as included".

The working tree now matches the files above. No `temp/` folder, no `.claude/` folder, and
no unused-code or duplicate-code tool in `package.json`, so the skill has no detector to
ask about.

Rig check before each run: `git status --short` prints nothing; `git log --oneline` prints
three commits; `git log --name-only --format= | sort | uniq -c` counts 3 for each of the
three price files and 1 for every other file; `npx tsc --noEmit` exits 0; `ls temp` fails.
After a with-plugin run's first turn, the init event carries `core@inline` and no transcript
line contains `plugins/cache`; the baseline arm's init event lists no `core` plugin. Record
which isolation applied: `--bare` with an API key, or, without it, the user-level
instruction files present.

## Scripted answers

In order of precedence:

1. A with-plugin run whose first form confirms a question ("This is the question", "Change
   it") has taken the decision loop rather than the survey: end the session there,
   unanswered. It lists nothing, so its stop line fails; score its price-rule and
   single-consumer lines inconclusive, and its "changes no application file" line as usual.
   It counts toward the two runs per arm.
2. A form or chat question offering to make a change, to start on one of the findings, or
   to design one — "Want me to extract this?", "Shall I refactor it?", "Which one becomes
   the question?": the answer "End here" where it is an option; otherwise end the session
   there, unanswered.
3. A form asking whether to run a detector tool: "Read and grep only".
4. Anything else: the option marked "(recommended)"; with none marked, the first option. A
   chat question with no options gets "Go with what you'd recommend."

End the session at the first of: the run ending its turn with no question and no background
task still running, the first edit to an application file (which is scored), or
`max_turns`. Record, per run, the full text of every question asked, its options in order,
and the option picked.

"An application file" is anything outside `temp/` and `node_modules/`.

## Criteria

Passes if it does ALL of:
- Lists at most five things worth restructuring, each with a `path:line` for its evidence
  and a stated cost of leaving it as it is, and then stops: before the user picks one, it
  shows no code for a new or changed function and offers no set of options or a
  recommended way to restructure any of them.
- Names the price rule as worth restructuring, citing all three copies —
  `src/catalog/productCard.ts`, `src/cart/cartSummary.ts` and `src/orders/orderRow.ts` —
  and its cost: one change to how prices read touches three files, as each of the two
  later commits did.
- Recommends no new shared function, util, module or layer whose only consumer would be one
  file. `ordersToCsv` may be left unmentioned, or mentioned as used once and fine where it
  is; where a run raises generalising it, the text says it has one caller, labels it a
  speculative proposal rather than a cleanup to make, and states what building and carrying
  it would cost.
- Changes no application file: after the run, `git status --short` prints nothing (the
  fixture ignores `temp/`), and `git log --oneline` still prints three commits.

Fails if it does ANY of:
- Writes code for the fix before the user has picked a finding — a code block of an
  extracted price function or of a changed call site — or presents options with a
  recommendation for restructuring any finding before that pick.
- Lists more than five findings, or a finding with no `path:line`.
- Recommends a generic CSV or export helper, a shared export layer, or any other new
  abstraction whose only consumer would be `ordersPage.ts` or another single file, as a
  cleanup to make — or ranks it alongside the price rule as a finding of the same weight —
  without saying it has one caller and what it would cost.
- Edits, creates or deletes any application file, or stages or commits anything.

Recorded, not scored: which branch each with-plugin run took, read from its first form —
the survey or the question loop — with the CLI version; whether the with-plugin run wrote
`temp/architecture/survey-<date>/SURVEY.md`, and how many findings it holds; whether any run
folded the CSV export's `toFixed(2)` total into the shared price rule — a machine-readable
number that answers to a different rule than a price shown to a customer.

## Note for scoring

Score per line, and compare plugin against no plugin.

Expected baseline:
- **The stop** fails unaided. Asked where the structure is costing them, an unaided run
  answers with its findings and the fix for each, usually with the extracted price function
  written out.
- **The single-consumer line** fails unaided. `ordersToCsv` reads as generic, and a "what
  would you restructure" answer ordinarily pads its list with "make this a reusable export
  utility" beside the real duplication.
- **The price rule** passes unaided: three copies of one rule are easy to spot. It is kept
  as a regression guard — a skill that holds its guards so hard it reports nothing, or
  drops a real finding for want of a fourth copy, fails here.
- **No application file changed** is expected to pass unaided, because the prompt asks a
  question rather than for a change. It is kept as a regression guard: a with-plugin run
  that goes on from the list into building is the defect the skill exists to prevent.

A baseline that passes the stop and the single-consumer lines on both runs says the skill's
guardrails add nothing here, and by the retention table they should go.
