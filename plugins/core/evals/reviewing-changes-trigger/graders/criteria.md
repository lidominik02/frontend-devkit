---
type: llm
weight: 1
---

Tests whether ordinary pre-merge wording starts `reviewing-changes`, and whether the chain
behind it keeps the review out of the main session: the change measured against the branch
the repository actually merges into, the reading done by `core:reviewer` workers in fresh
read-only contexts, a separate verification of what they find, the gates reported as run or
NOT RUN, a report file with a brief in chat that points at it, nothing edited, and a stop.
Capability, and a component decision: the prompt is untyped on purpose, so a pass or a fail
says something about the skill's description as well as its body.

## Run

Hand-run, both arms, from the fixture below; no form is expected. Use the README's hand-run
rig. The with-plugin arm loads `plugins/core` only: the fixture is plain TypeScript, so no
framework pack applies. Run the with-plugin arm at least twice — whether the description
fires is a rate, not a single result.

**User-level instructions.** A runner's `~/.claude/CLAUDE.md` and `~/.claude/rules/` load in
both arms unless the run isolates them. Where an API key is available, run both arms with
`--bare`, as the evals README's hand-run rig describes. No line here depends on a hook:
each is scored on what the run wrote before its turn first ended, and the Stop hook's gate
context arrives after that. Where `--bare` is unavailable, run both arms without it and treat
the gate line, the edit line and the stop line as non-discriminating on that machine, since
user-level instructions may already say to report an unrun gate as NOT RUN, to run no tests
unasked, and to change or fix nothing unasked. Score and record those three lines, but do not
let them decide retention.

## Fixture

A fresh directory per run. The repository merges into `develop`; a local `main` that
`develop` has moved past is the trap.

1. `git init -b main seed`, then in `seed` write the files below at their initial versions,
   run `npm install`, and commit everything as "Initial invoicing app".
2. `git switch -c develop`, change `src/customers/customerName.ts` to its develop version,
   commit as "Show the trading name when a customer has one".
3. Next to `seed`: `git clone --bare seed remote.git`, `git clone remote.git work`.
4. In `work`: `git switch -c feature/invoice-due-dates origin/develop`, then
   `git branch -f main origin/main` and `git remote set-head origin develop`.
5. Create `src/invoices/dueDate.ts`, change `src/invoices/format.ts` to its feature
   version, commit both as "Compute invoice due dates from payment terms", then `npm ci`.

The run starts in `work`.

`.gitignore`:

```
node_modules/
temp/
```

`package.json`:

```json
{
  "name": "invoicing-web",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "test": "vitest run"
  },
  "devDependencies": { "typescript": "5.6.3" }
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
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

`src/invoices/types.ts`:

```ts
export interface Invoice {
  id: string
  issuedAt: string
  paymentTermsDays: number
  total: number
}
```

`src/invoices/format.ts`, initial:

```ts
import type { Invoice } from './types'

export function formatInvoiceNumber(invoice: Invoice): string {
  return `INV-${invoice.id.padStart(6, '0')}`
}
```

`src/invoices/format.ts`, feature version:

```ts
import { dueDate } from './dueDate'
import type { Invoice } from './types'

export function formatInvoiceNumber(invoice: Invoice): string {
  return `INV-${invoice.id.padStart(6, '0')}`
}

export function formatDueLine(invoice: Invoice): string {
  return `Due ${dueDate(invoice).toISOString().slice(0, 10)}`
}
```

`src/invoices/dueDate.ts`, feature only:

```ts
import type { Invoice } from './types'

const DAY_MS = 24 * 60 * 60 * 1000

export function dueDate(invoice: Invoice): Date {
  return new Date(Date.now() + invoice.paymentTermsDays * DAY_MS)
}

export function isOverdue(invoice: Invoice, today: Date = new Date()): boolean {
  return today.getTime() > dueDate(invoice).getTime()
}
```

`src/customers/customerName.ts`, initial:

```ts
export interface Customer {
  legalName: string
  tradingName?: string
}

export function customerName(customer: Customer): string {
  return customer.legalName
}
```

`src/customers/customerName.ts`, develop version: the same file with the return line
`return customer.tradingName ?? customer.legalName`.

Rig check in `work`, before each run:

- `git branch --show-current` prints `feature/invoice-due-dates`, and `git status --short`
  prints nothing.
- `git symbolic-ref --short refs/remotes/origin/HEAD` prints `origin/develop`.
- `git diff --stat origin/develop...HEAD` lists only `src/invoices/dueDate.ts` and
  `src/invoices/format.ts`; `git diff --stat main...HEAD` also lists
  `src/customers/customerName.ts`, so the trap is live.
- `node_modules/.bin/tsc --version` prints a version; `node_modules/.bin/eslint` does not
  exist, `command -v eslint` prints nothing, and `npm run lint` exits 127 (on npm 10.9.2 it
  prints `sh: 1: eslint: not found`). An `eslint` reachable anywhere on `PATH` lets the lint
  script run, so the gate no longer reads as not installed.
- There is no `.claude/` directory. Plugin agents rank lowest in discovery, so a project's
  own `reviewer` would be measured instead of this one.
- The baseline arm's init event lists no `core` plugin. Record whether both arms ran with
  `--bare` or neither did; a pair that mixes the two is void.

## Scripted answers

None expected. A question the run asks anyway gets the option marked "(recommended)", else
the first option; record it, since this route should need none.

## Criteria

Passes if it does ALL of:
- A `Skill` call naming `reviewing-changes` appears before any review content.
- The change under review is measured from where the branch leaves `origin/develop`: the
  review's scope lists `src/invoices/dueDate.ts` and `src/invoices/format.ts`, and not
  `src/customers/customerName.ts`.
- The reading happens in dispatched `core:reviewer` workers: every finding in the report
  comes from a worker's output, and the main session adds none of its own.
- When the finding worker returns candidates, a separate worker checks them before the
  report is written, and the report carries its verdict on each.
- Gates are reported by status: typecheck with its result, lint and test as NOT RUN, and no
  gate as passing that did not run. The reason each NOT RUN carries is recorded, not scored
  (see the note).
- Writes the review to a file.
- The chat reply names how many findings there are, what did not run and the report's path,
  and restates no finding that is not in the report.
- Changes no tracked file, creates no file besides the review's own output — a report or a
  diff file, wherever it lands — and stages, commits, stashes or checks out nothing.
- Ends with no fix applied or started. An offer to fix, asked as a question, passes; a fix
  begun, or described as done, fails.

Fails if it does ANY of:
- Reads and critiques the diff in the main session, whether or not the skill fired. Two
  guarantees are lost that way: the review no longer happens in a fresh context, so it
  inherits the assumptions of whoever wrote the change; and the reviewing turn still holds
  edit tools, so "review this" can quietly become "fix this".
- Measures the change from `main`, `origin/main` or any other branch it has not established
  as the merge target. The target counts as established when the run reads it from
  `origin/HEAD`, from the project facts' `baseBranch`, or from the branch's upstream (as
  `git status` or `git rev-parse @{upstream}` shows it), or when the user names it.
- Edits, stages or commits anything, or starts fixing a finding. A new review file is not an
  edit.
- Reports a gate as passing that never ran.

A fails-if line overrides a satisfied pass line.

## Note for scoring

This grader decides a component, so record the mechanism per run, not just the verdict:

- **The skill fires, the review stays in workers, and the scope is right** → the
  description and the chain hold on this wording; change nothing.
- **No `Skill` call, and the main session reviews** → the description does not fire on
  pre-merge wording. Record the wording and weigh it against the description's trigger
  phrases before touching them.
- **Another skill fires instead** — most likely `describing-changes`, whose description
  also names merge-request wording → the two descriptions collide on this wording; nothing
  is missing from either on its own. Record which skill fired, and change how the two
  descriptions divide the wording rather than adding trigger phrases.
- **The skill fires, but the main session reads and critiques anyway** → the body's
  dispatch rule is not holding. That is a body defect, and a description change would not
  fix it.
- **The skill fires and workers review, but the scope is wrong** → the body's base
  resolution is not holding. That is a body defect too.

The gate line scores the status only. Record per run the reason each NOT RUN carries — lint
"not installed"; test "held", "not installed" or "tried and failed" — since only the plugin
has a word for a hold, and a baseline that reports test NOT RUN because vitest is missing is
honest. A with-plugin run that runs `npm test` anyway breaks the skill's hold: score the
status as the run reports it, and record the attempt as a body defect.

The planted defect — `dueDate` counts from the current clock instead of `issuedAt`, so
`isOverdue` can never be true — is reported, not scored. When no worker flags anything, the
verification line has nothing to check: score it not applicable, not passed.

Baseline: the no-plugin arm has no skill to call and no `core:reviewer` to dispatch, so the
`Skill`, dispatch and verification lines fail unaided by construction, and the first
fails-if line is what a review without the plugin does by default. None of these decides
retention on its own. Compare plugin against no plugin on the base line and the gate line.
The base line is expected to fail unaided — the local `main` is the trap — and so is the
gate line's status, which asks a review with no gate script to account for every gate
unprompted. On an unisolated machine the gate line is non-discriminating (see Run), and the
base line alone decides.
