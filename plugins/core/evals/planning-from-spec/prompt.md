---
max_turns: 30
allowed_tools: [Read, Write, Edit, Glob, Grep, Skill, Bash, AskUserQuestion]
---

/core:planning-features plan multi-currency

We've finished working out what multi-currency invoicing has to do. The spec is saved at
`temp/multi-currency/planning/SPEC.md`; here it is:

```markdown
# Spec: multi-currency

## Sources
- The product owner, in the requirements session of 2026-09-18 — confirms: the product owner

## Outcome
Invoices and credit notes can be issued in the customer's currency, and each keeps the
exchange rate of its issue date, so customers abroad are billed in their own currency and
issued documents never change value.

## Constraints
- Rates come from the ECB daily reference feed, fetched by an existing backend job; the frontend reads them from `GET /api/rates`.
- Documents issued before this ships stay in EUR.

## Success criteria
- SAID — A new invoice preselects the customer's currency; the issuer can change it to any supported currency before issuing.
- SAID — An issued invoice shows the rate of its issue date and keeps it; a later rate change never alters an issued invoice.
- SAID — The invoice PDF shows amounts in the invoice currency, then the rate line, then the total in EUR.
- SAID — A credit note raised from an invoice is issued in that invoice's currency.
- SAID — The revenue dashboard totals every issued invoice in EUR, using each invoice's stored rate.
- EXTRA — The currency selector shows today's rate beside each option (D3).

## User flow
1. The issuer opens a new invoice for a customer; the customer's currency is preselected.
2. The issuer keeps or changes the currency, adds lines and issues the invoice — or cancels, which discards the draft.
3. The issued invoice and its PDF show the stored rate.
4. A credit note raised from that invoice opens in the invoice's currency.

## Business rules
- An invoice keeps the rate of its issue date — finance reconciles each invoice against the rate it was issued at, and revaluing issued invoices would reopen closed periods.
- A stored rate is never recomputed — re-fetching the feed can return the same rate with different rounding.

## States
- Loading: the currency selector is disabled until the day's rates load.
- Empty: no rate is published for the issue date yet — the previous business day's rate applies, and the invoice says which date's rate it used.
- Error: the rates request fails — issuing is blocked with "Exchange rates are unavailable. Try again in a few minutes."
- Permission: not applicable — every issuer may choose the currency.

## Design
Type: frames read through the design tool — location: the "Invoices — currency" page,
frames "New invoice", "Invoice PDF" and "Credit note". Coverage: partial — no frame shows
the rates error state; SPEC States settles it (D2).

## Global Constraints
- Supported currencies: EUR, USD, GBP — exactly these three, in this order.
- Base currency: EUR.
- Rates are stored with 6 decimal places; converted amounts are rounded half-even to 2 decimal places.
- A document issued before 16:00 CET uses the previous business day's ECB rate.
- Rate line copy: "Rate on issue date: 1 EUR = {rate} {currency}"
- Error copy: "Exchange rates are unavailable. Try again in a few minutes."

## Review Focus
- A draft issued after a rate change takes the new day's rate, while an already issued invoice keeps its own.
- The dashboard never adds amounts in different currencies.

## Architecture fit
- `src/invoices/InvoiceForm.vue` — the new-invoice form the selector goes into
- `src/invoices/invoicePdf.ts` — builds the PDF lines
- `src/creditNotes/CreditNoteForm.vue` — opens a credit note from an invoice
- `src/reports/revenue.ts` — the dashboard's totals
- `src/api/client.ts` — the API client; it has no rates call yet

## Contract
- `GET /api/rates?date=YYYY-MM-DD` — exists; returns `{ date, rates: { USD, GBP } }` against EUR, where `date` is the latest publication day on or before the one asked for.
- `POST /api/invoices` accepts `currency`, `rate` and `rateDate` — exists.
- `GET /api/invoices` returns `currency`, `rate` and `rateDate` on each invoice — exists; invoices issued before this ships return `EUR` with rate `1`. The frontend `Invoice` type has none of the three yet.
- `POST /api/credit-notes` accepts `currency` and `rate` — exists.

## Out of scope
- Currencies beyond the three.

## Deferred
- Editing a customer's default currency — trigger: a customer asks to change theirs.

## Verification seams
- Rate storage and rounding: the review and the typecheck.
- The PDF and the selector: the browser, once released.
- The copy: the user.
```

One thing is still open, and it's with the product owner — it's the only entry in
`temp/multi-currency/planning/OPEN-QUESTIONS.md`:

```markdown
- **OQ1** · Does a credit note use the rate of the invoice it credits, or the rate on its own issue date?
  - Owner: product owner
  - Blocks: the credit-note rate (SPEC Business rules)
```

It's a few weeks of work and I'll be picking it up and putting it down between other
things. Turn it into something I can work through.
