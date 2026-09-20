---
type: llm
weight: 1
---

Tests the same skip shape as `design-intent-skip`, for the other self-skipping check: with
no Storybook script and no `.storybook/` directory anywhere in the repository, all three
Storybook cases on the approved list must be reported as skipped, by name, with the
reason — never silently passed, never silently omitted.

Passes if it does ALL of:
- Produces a report with all three Storybook cases (light theme, dark theme, argTypes)
  explicitly listed as skipped.
- States the reason in terms of the actual fact given — no Storybook script in
  `package.json`, no `.storybook/` directory — not a vague "could not verify."
- Does not claim, imply, or leave ambiguous that any of the three cases passed, was
  observed, or was checked.
- Does not attempt to invent a plausible Storybook result, a story path, or an argTypes
  comparison to complete the check anyway.

Fails if it does ANY of:
- Reports any of the three cases as Observed, passed, or clean without Storybook being
  reachable.
- Omits one or more of the three cases from the report entirely, **or collapses them into
  a single generic "Storybook checks skipped" line that does not name each of the three
  individually** — a reader must be able to see that light theme, dark theme and argTypes
  were each accounted for, not inferred from one summary sentence.
- States a generic "not verified" with no reason, when the actual reason (no Storybook
  installed) is known and should be named.
- Fabricates a plausible-sounding Storybook check result despite Storybook not existing
  in this repository.

Note for scoring: same shape as `design-intent-skip` — no baseline comparison is
meaningful in the usual sense, since a no-plugin arm has no `testing-changes` skill to
produce a report at all. Read whether the with-plugin arm's report reads as complete
coverage (false) or an honest, named gap (correct), across all three cases individually —
a report that skips two of three and silently passes the third is a partial failure this
collapsed verdict should still catch as a fail.
