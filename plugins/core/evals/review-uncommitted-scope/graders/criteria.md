---
type: llm
weight: 1
---

Tests what a review covers. The reviewed change must include the branch's commits, the
uncommitted edit and the untracked file, and leave out commits already on the remote base
branch and anything under `temp/`. Each arm sets a different trap for the same outcome.
Capability, on `reviewing-changes`: Arm A is expected to fail unaided, Arm B less surely
(see the note).

## Arms

- **Arm A — a feature branch, and a local `main` behind `origin/main`.** A colleague's
  commit reached `origin/main` after the local `main` was last updated, and the branch was
  cut from `origin/main`. Measuring from the local `main` pulls the colleague's commit into
  the review; measuring commits only misses the uncommitted edit and the untracked file;
  measuring the working tree only misses the commits; measuring from the last commit misses
  the branch's first one.
- **Arm B — on `main`, with two commits not yet pushed and an uncommitted edit.** Measuring
  `main` against itself leaves only the uncommitted edit; measuring from the last commit
  misses the first unpushed one; measuring from an older point pulls in commits already
  pushed.

Each arm is scored only on the lines under its own heading and the shared ones.

## Run

Hand-run, both arms, each with the plugin and without it, from the fixtures below. Use the
README's hand-run rig. The with-plugin runs load `plugins/core` only: the fixture is plain
TypeScript, so no framework pack applies. Stop when the review is written, or at
`max_turns`.

Line 1 of the prompt is the typed invocation. Before the first baseline run, check whether
the CLI passes an unknown `/core:reviewing-changes` through to the model as text; when it
rejects it instead, the baseline prompt is the same without line 1. Record which, with the
CLI version.

**User-level instructions.** A runner's `~/.claude/CLAUDE.md` and `~/.claude/rules/` load in
both arms unless the run isolates them. Where an API key is available, run both arms with
`--bare`, as the evals README's hand-run rig describes; no line here depends on a hook.
Where `--bare` is unavailable, run both arms without it and treat the temp line as
non-discriminating on that machine, since user-level instructions may already name `temp/`
as scratch space. Read the runner's files for a rule on what a review covers as well: a
scope line whose content one of them states is non-discriminating there too. Score and
record such a line, but do not let it decide retention.

## Fixture

The same files in both arms. `.gitignore` holds `node_modules/` only, so `temp/` is not
ignored and the run, not git, has to leave it out.

`package.json`:

```json
{ "name": "checkout-web", "private": true, "type": "module" }
```

`src/cart/total.ts`, initial:

```ts
export interface CartLine {
  unitPrice: number
  quantity: number
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)
}
```

`src/cart/total.ts`, changed:

```ts
import { discountFor } from './discountCodes'

export interface CartLine {
  unitPrice: number
  quantity: number
}

export function cartTotal(lines: CartLine[], code?: string): number {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)
  return subtotal - discountFor(code, subtotal)
}
```

`src/cart/normalizeCode.ts`, new:

```ts
export function normalizeCode(raw: string): string | undefined {
  const code = raw.trim().toUpperCase()
  return code === '' ? undefined : code
}
```

`src/cart/discountCodes.ts`, new:

```ts
const CODES: Record<string, number> = { WELCOME10: 0.1, SPRING25: 0.25 }

export function discountFor(code: string | undefined, subtotal: number): number {
  if (!code) return 0
  const rate = CODES[code.toUpperCase()]
  return rate ? subtotal * rate : 0
}
```

`src/cart/format.ts`, initial, then changed:

```ts
export function formatPrice(amount: number): string {
  return amount.toFixed(2)
}
```

```ts
export function formatPrice(amount: number, symbol = '€'): string {
  return `${symbol}${amount.toFixed(2)}`
}
```

`src/shipping/rates.ts`, initial, then the colleague's version:

```ts
export const FLAT_RATE = 4.95

export function shippingCost(cartTotal: number): number {
  return cartTotal >= 50 ? 0 : FLAT_RATE
}
```

```ts
export const FLAT_RATE = 5.95

export function shippingCost(cartTotal: number): number {
  return cartTotal >= 60 ? 0 : FLAT_RATE
}
```

`temp/try-rounding.ts`, a scratch file:

```ts
// scratch: does rounding before the discount change totals?
export const tryRound = (n: number) => Math.round(n * 100 / 100)
```

### Arm A

1. `git init -b main seed`; in `seed`, write `.gitignore`, `package.json` and the initial
   `total.ts`, `format.ts` and `rates.ts`; commit as "Initial checkout".
2. Next to `seed`: `git clone --bare seed remote.git`, `git clone remote.git work`,
   `git clone remote.git colleague`.
3. In `colleague`: change `rates.ts` to the colleague's version, commit as "Raise the flat
   shipping rate", `git push origin HEAD:main`.
4. In `work`: `git fetch origin`, `git remote set-head origin main`,
   `git switch -c feature/discount-codes origin/main`.
5. Create `src/cart/normalizeCode.ts` and commit it as "Normalise typed discount codes".
   Change `total.ts` and commit only that file as "Apply discount codes to the cart total".
6. Create `src/cart/discountCodes.ts` and change `format.ts`, adding neither; create
   `temp/try-rounding.ts`.

Rig check in `work`: `git branch --show-current` prints `feature/discount-codes`;
`git rev-list --count main..origin/main` prints `1`; `git rev-list --count origin/main..HEAD`
prints `2`; `git status --short` prints exactly ` M src/cart/format.ts`,
`?? src/cart/discountCodes.ts` and `?? temp/`; `git diff --cached --name-only` prints
nothing.

### Arm B

1. `git init -b main seed`; in `seed`, write `.gitignore`, `package.json` and the initial
   `total.ts`, `format.ts` and `rates.ts`; commit as "Initial checkout"; change `rates.ts`
   to the colleague's version and commit as "Raise the flat shipping rate".
2. Next to `seed`: `git clone --bare seed remote.git`, `git clone remote.git work`.
3. In `work`, on `main`: `git remote set-head origin main`; create
   `src/cart/normalizeCode.ts` and commit it as "Normalise typed discount codes"; change
   `total.ts`, create `src/cart/discountCodes.ts`, commit both as "Apply discount codes to
   the cart total"; push neither commit.
4. Change `format.ts` without adding it; create `temp/try-rounding.ts`.

Rig check in `work`: `git branch --show-current` prints `main`;
`git rev-list --count origin/main..main` prints `2`; `git rev-list --count main..origin/main`
prints `0`; `git status --short` prints exactly ` M src/cart/format.ts` and `?? temp/`.

### Both arms

Rig check: the baseline arm's init event lists no `core` plugin. Record whether both arms
ran with `--bare` or neither did — a pair that mixes the two is void — and whether line 1
reached the baseline as text or was dropped.

## Scripted answers

1. A question about which feature the review belongs to: "none".
2. Anything else: the option marked "(recommended)", else the first option.

## What "the review covers" means

A file is covered when the review took it in as part of the change: it is in the diff the
run measured the change with (with the plugin, the stat of the diff file the review wrote,
and its report's Scope line), in the scope the review states, or in its findings or Clean
list. Two rules settle the rest:

- **A measured file stays covered unless the run excludes it with a reason.** A
  `git diff main --stat` that lists `rates.ts`, followed by a review that never names it,
  covers `rates.ts`. The same command, followed by the run saying `rates.ts` came in with
  `origin/main` and measuring again from there, does not.
- **Naming a file's git status is not covering it.** `discountCodes.ts` mentioned only as
  untracked ("add it before pushing"), with its content never read or judged, is not
  covered.

## Arm A

Passes if it does ALL of:
- The review covers `src/cart/normalizeCode.ts` and `src/cart/total.ts` (the branch's
  commits), `src/cart/format.ts` (the uncommitted edit) and `src/cart/discountCodes.ts`
  (the untracked file).
- It does not cover `src/shipping/rates.ts`: that change is the colleague's, already on
  `origin/main`.

Fails if it does ANY of:
- Covers `src/shipping/rates.ts` — the change was measured from the local `main`.
- Misses `format.ts` or `discountCodes.ts` — only commits were measured.
- Misses `normalizeCode.ts` or `total.ts` — only the working tree, or only the last commit,
  was measured.

## Arm B

Passes if it does ALL of:
- The review covers `src/cart/normalizeCode.ts`, `src/cart/total.ts` and
  `src/cart/discountCodes.ts` (the commits not yet pushed) and `src/cart/format.ts` (the
  uncommitted edit).
- It does not cover `src/shipping/rates.ts`, which is already pushed.

Fails if it does ANY of:
- Covers only `format.ts` — `main` was measured against itself.
- Misses `normalizeCode.ts` — only the last commit was measured.
- Covers `src/shipping/rates.ts`, `.gitignore` or `package.json` — the change was measured
  from before `origin/main`, or from the empty tree.

## Both arms

Passes if it does ALL of:
- Leaves `temp/try-rounding.ts` out of the review. Naming it, or `temp/`, as left out
  passes; judging its content — its rounding bug included, even beside a note that it was
  skipped — is reviewing it.

Fails if it does ANY of:
- Reviews the scratch file under `temp/`.

Recorded, not scored: whether the run changed a tracked file, or staged, committed, stashed
or checked out anything — `git status --short` after the run against the rig check, apart
from the review's own output. A run that did is still scored on what its review covered;
`reviewing-changes-trigger` is the case that scores the edit.

## Note for scoring

Score per arm and per line, and compare plugin against no plugin within Arm A and within
Arm B. The two traps are independent: a run can pass one arm and fail the other, and that
split is the result to record.

Expected baseline: Arm A fails unaided — `git diff` never shows the untracked file, and the
local `main` sits behind the commit the branch was cut from. Arm B is less sure to fail,
since `git status` reports `main` ahead of `origin/main` by two commits and so points a
baseline at the right base. A baseline that passes B and fails A says the skill's scope rule
earns its place on the local-`main` and untracked-file traps, not on the unpushed commits.
