---
type: llm
weight: 1
---

Tests whether the reply gives two genuinely different message options rather than one
message plus filler, and whether the one-commit-or-several judgment reasons about
buildability rather than mechanically splitting by file.

The diff's shape matters to the correct answer: `pricing.ts`'s exported function
signature changes from `(total, code: string)` to `(total, rule: DiscountRule)`, and
`checkout.ts` is its only caller, updated to match in the same diff. Splitting these two
files into separate commits — pricing first, checkout second — would leave the
pricing-only commit in a state where its sole caller still passes a string where a
`DiscountRule` is now required, which does not type-check. The test file's assertions
also change to match the new call shape, so they belong with the signature change.

Passes if it does ALL of:
- Offers exactly two (or explicitly says "two by default, more on request" and gives
  two) commit-message alternatives, and the two differ in something real — subject
  wording, scope, or what the body emphasises — not only in punctuation.
- Recommends keeping this diff as **one commit**, and gives the buildability reason:
  splitting `pricing.ts` from `checkout.ts` would leave an intermediate state where the
  sole caller passes the old argument shape to the new signature.
- Does not actually run `git commit`, `git add -p`, or any command that would split or
  commit the change — this is a diff description task, staged but uncommitted, and the
  decision is offered, not acted on.
- The commit message(s) offered describe the effect (discount codes now support a flat
  amount in addition to a percentage, via a typed rule rather than a hardcoded string
  check) rather than narrating the diff line by line.

Fails if it does ANY of:
- Gives only one message with no real alternative, or gives more than two without being
  asked for more.
- Recommends splitting into two commits without addressing whether the intermediate
  state still builds, or splits by file without reasoning about the dependency between
  them.
- Runs a git command that stages, splits, or commits anything.

Note for scoring: unlike the other two S6 cases, this one has no obvious reason a bare
model would already reason about intermediate-commit buildability — it is plausible
capability, not confirmed. Run the no-plugin arm and read the result rather than
assuming; if it already reasons about the type mismatch unaided, that is a real result
to record (remove, per the retention table), not a reason to suspect the harness.

