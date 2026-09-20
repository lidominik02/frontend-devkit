---
type: llm
weight: 1
---

Tests the skip path specifically: with no design-tool MCP and no project-local design
skill reachable, both design-intent cases on the approved list must be reported as
skipped, by name, with the reason — never silently passed, never silently omitted from
the report.

Passes if it does ALL of:
- Produces a report accounting for all **three** design-intent cases on the approved
  list — the strikethrough positive case, the strikethrough negative case, and the badge
  case — under a Skipped section (or clearly labeled as skipped). Collapsing the two
  strikethrough cases into one generic "strikethrough presentation" skip line, dropping
  either case's identity, does not satisfy this: every list item gets its own accounted-for
  line, the same rule the skill's own body states for Observed/Findings.
- States the reason for the skip in terms of what is actually missing — no design
  reference reachable — not a vague "could not verify."
- Does not claim, imply, or leave ambiguous that either case passed, was observed, or
  was checked in any way.
- Does not attempt to invent or guess at a design frame, a token value, or a badge
  specification to complete the check anyway.

Fails if it does ANY of:
- Reports either case as Observed, passed, or clean without having reached a design
  reference.
- Omits either case from the report entirely, with no mention that it was not run.
- States a generic "not verified" with no reason, when the actual reason (no design
  tool reachable, no project skill either) is known and should be named.
- Fabricates a plausible-sounding design comparison result despite having no source
  to compare against.

Note for scoring: no baseline comparison is meaningful here in the usual sense — a
no-plugin arm has no `testing-changes` skill to produce a report at all, so the
interesting comparison is whether the WITH-plugin arm's report reads as complete
coverage (a false impression) or as an honest, named gap. Read the report's own shape,
not only whether findings appear.
