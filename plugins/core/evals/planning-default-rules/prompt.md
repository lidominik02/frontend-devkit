---
max_turns: 25
allowed_tools: [Read, Write, Edit, Glob, Grep, Skill, Bash, AskUserQuestion]
---

/core:planning-features plan self-serve-refunds

The spec for self-serve refunds is settled — I went through it with the product owner
yesterday and saved it at `temp/self-serve-refunds/planning/SPEC.md`. This is what's in it:

```markdown
# Spec: self-serve-refunds

## Sources
- Call with the product owner, 2026-09-20, written up as this spec — confirms: the product owner

## Outcome
A customer can request a refund for a recent order from the order page without contacting
support, so support stops handling routine refunds by hand.

## Constraints
- The refunds endpoint already exists: `POST /api/orders/{id}/refunds`.
- No new dependencies.

## Success criteria
- SAID — An order placed 30 days ago or less shows a "Request refund" action on its order page.
- SAID — An order placed more than 30 days ago shows no refund action, and the page says "Refunds close 30 days after purchase."
- SAID — The refund amount cannot exceed the order's paid amount; a larger amount is rejected with "Refunds can't exceed what you paid."
- SAID — A submitted request shows "Refund requested" on the order page, and the action disappears.

## User flow
1. The customer opens an order from their order history.
2. The customer chooses "Request refund", enters an amount and a reason, and submits — or cancels, which returns to the order page unchanged.
3. The order page shows "Refund requested".

## Business rules
- 30-day window — the payment provider refunds automatically only within 30 days of capture; anything older needs a manual bank transfer by finance.
- Capped at the paid amount — a refund above what was paid is a payout, which needs finance approval.

## States
- Loading: the submit button is disabled with a spinner while the request is in flight.
- Empty: not applicable — the form always belongs to one order.
- Error: a failed request keeps the form open with the entered values and shows "We couldn't submit your refund. Try again."
- Permission: not applicable — only the customer who placed an order can open its page, and the page already enforces that.

## Design
Type: a proposal the user approved — location: this section. One dialog built like
`src/orders/CancelOrderDialog.vue`: an amount field prefilled with the paid amount, a
reason field, Submit and Cancel. Coverage: complete.

## Global Constraints
- Refund window: 30 days from the order date, inclusive.
- Refund reason: required, 10 to 500 characters.
- Copy: "Request refund", "Refund requested", "Refunds can't exceed what you paid.", "Refunds close 30 days after purchase.", "We couldn't submit your refund. Try again."

## Review Focus
- An order exactly 30 days old still shows the action.
- A double submit must not create two refund requests.

## Architecture fit
- `src/orders/OrderPage.vue` — the order page the action goes on
- `src/orders/CancelOrderDialog.vue` — the closest existing dialog: same layout, same submit and error handling
- `src/api/orders.ts` — the API client; it has no refund call yet

## Contract
- `POST /api/orders/{id}/refunds` with `{ amount, reason }` — exists; returns the refund with `status: "requested"`.
- `paidAmount` and `placedAt` on `GET /api/orders/{id}` — exist.
- `refund` on `GET /api/orders/{id}` — exists; the order's refund with its `status`, or `null` when none was requested. Not on the frontend `Order` type yet.

## Out of scope
- Refunding individual order lines.

## Deferred
- Refund status after the request (approved, paid) — trigger: finance turns on refund webhooks.

## Verification seams
- The window and the cap: the review, then the browser once released.
- The copy: the user.
```

I haven't set any ground rules for how this one gets built — go with whatever's normal.
Write up how we'd build it.
