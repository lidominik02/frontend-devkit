---
type: llm
weight: 1
---

Tests the `checkpoint` mode specifically: ad-hoc work with no roadmap, no `MASTER-PLAN.md`,
no phase — a shape `new` and `plan` do not cover at all. The claim under test is that the
skill has *somewhere* to put this rather than forcing the user into a roadmap they
explicitly said they do not have, or silently doing nothing durable and leaving the state
only in the transcript.

Passes if it does ALL of:
- Writes a durable, on-disk handoff file for this work — not only a chat summary — without
  requiring or inventing a full roadmap, `MASTER-PLAN.md`, or phase structure the user
  never asked for.
- The file records: what was done (the fix — object-URL streaming instead of a blob string
  for large CSVs), what is verified (existing tests still pass) versus what is not (no
  manual check yet), and what is left (the manual verification tomorrow).
- States plainly whether this is safe to pick up in a fresh session or better finished now,
  and says why — not merely a status dump with no judgment.
- Does not invent a phase number, a roadmap name, or a `MASTER-PLAN.md` for one bug fix.

Fails if it does ANY of:
- Refuses, or asks the user to first set up a roadmap, before it will checkpoint anything.
- Produces only a chat-visible summary with nothing written to disk.
- Invents a full roadmap structure (phases, a master plan) for what is explicitly a single,
  already-fixed bug with no further planned phases.
- Claims the fix is fully verified when the user said only that existing tests pass and
  manual verification is still pending.

Note on scope: despite the case name, this tests `checkpoint` only, not `resume` — a
single-turn harness run cannot authentically test resuming with no memory of the session
that just ran, since the same context that wrote the checkpoint is still present to read
it back. Resume's own new behaviour (checking the artifacts against the actual repository
state before trusting them) needs a genuine cross-session setup and should be verified by
hand, the way this pack's own README already asks for `optimizing-prompts` and
`verifying-ui`'s harness-incompatible cases.

Note for scoring: no baseline expectation is claimed — plausible that a bare model already
writes *some* file when asked to "checkpoint," so the discriminating question is whether it
resists inventing roadmap structure for a one-off fix and stays honest about what is and
is not verified. Compare arms rather than assuming a result.
