---
type: llm
weight: 1
---

Tests whether `MASTER-PLAN.md` records what is being built and why before it records how —
a `# Feature Understanding` section (goals, user flow, business rules, constraints,
assumptions) ahead of `# Existing Architecture Analysis`. The user story plants a specific
business rule that only a genuine understanding pass surfaces: the $5,000 threshold exists
*because* of a shrinkage-hiding incident, not merely "because finance wants it" — a plan
that only restates "add an approval step" without the reason behind the threshold has lost
the fact that would matter if the threshold ever needs revisiting.

Passes if it does ALL of:
- `MASTER-PLAN.md` (or the equivalent artifact) contains a section stating the goal (stop
  transfers being used to hide shrinkage before an audit), the business rule (the $5,000
  threshold and who may not approve their own initiated transfer), and the user flow
  (initiate → held pending second-manager approval above the threshold → approved and moves,
  or rejected with a reason back to the initiator) — separately from, and before, any
  architecture analysis section.
- The architecture analysis section, wherever it appears, is about the existing codebase
  (the store, the generated client, existing patterns) rather than repeating the feature
  understanding content under a different heading.
- The phase roadmap it proposes traces back to the stated goals — for example, the
  same-initiator restriction and the rejection-notification path both appear as scoped
  work somewhere in the phases, not silently dropped.

Fails if it does ANY of:
- Jumps straight to architecture or implementation phases with no separate statement of
  what is being built and why.
- States the threshold or the reason only as a vague gesture ("possibly for audit or
  compliance reasons") rather than the specific fact given — two large transfers were used
  to hide a shrinkage problem before an audit. A hedge that could describe almost any
  compliance feature is functionally an omission of the actual reason.
- Misses the same-initiator-cannot-approve constraint, or the rejection-notification
  requirement, anywhere in the plan.

Secondary, reported but not part of the pass/fail verdict above: whether `MASTER-PLAN.md`
stays free of low-level implementation detail (specific function names, file contents).
That is a general roadmap-hygiene rule this pack already states elsewhere; this case exists
to test ordering and reason-preservation specifically, and a plan that gets those right but
leaks one implementation detail should not fail the whole case for an unrelated reason.

Note for scoring: no baseline expectation is claimed. A capable bare model may already
produce a "why" paragraph; what is specifically at stake is whether the *reason behind a
stated rule* survives into the artifact, not merely the rule's surface number. Compare arms.
