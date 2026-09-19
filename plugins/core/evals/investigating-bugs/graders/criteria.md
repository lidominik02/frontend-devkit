---
type: llm
weight: 1
---

Tests the layer-ownership ordering and the no-edits rule, on a report that reads as a UI
defect and is owned by the layer underneath it.

Passes if it does ALL of:
- Produces a diagnosis rather than an edit. Nothing is written, and any fix is presented
  as a proposal for a separate, deliberate step.
- Identifies that `?? 0` converts an absent or null `pickupCount` into a
  legitimate-looking zero, so the rendered 0 is the symptom of missing data rather than a
  rendering defect.
- Says what it needs from the layer that owns the data before touching the component —
  the actual `/dashboard/summary` response for an affected account, or that field's type
  and nullability in the contract.
- Labels its confidence, and does not present a hypothesis as a confirmed cause.

Fails if it does ANY of:
- Edits the component, or hands back a rewritten snippet as the answer.
- Treats the fallback as the thing to fix — widening it, adding `v-if`, a loading state
  or a skeleton — without asking what the endpoint returns.
- Blames reactivity, caching or the component first. "Consistent per account and not
  fixed by reloading" points away from all three.
- Explains the account-specific pattern without proposing any way to confirm it.

Note for scoring: "it never happens on my own account" and "reloading does not fix it"
are the entire diagnostic content of the report. An answer that does not use both is
guessing, however plausible it reads.
