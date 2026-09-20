---
type: llm
weight: 1
---

Tests the no-story path specifically: derive criteria from the phase plan and the diff,
and say so plainly at the top of the list, rather than inventing a user story to make the
task look like the ordinary case. The diff also plants a real discrepancy worth noticing
(the phase plan says deleting a preset asks for confirmation; the diff's `deletePreset`
has no confirmation step at all) — noticing it is a bonus signal, not required for a pass,
since the case's own point is the no-story path rather than diff-plan cross-checking.

Passes if it does ALL of:
- States explicitly, at or near the top of the list, that no user story was found and the
  criteria are derived from the phase plan and the diff instead — in substance, not
  necessarily that exact wording.
- Does not invent a named user persona or role, or a business justification, that appears
  nowhere in the phase plan or the diff. A plain, low-content restatement of the feature's
  own stated purpose (e.g. "so a saved combination can be reused") is not fabrication; a
  persona or a motivation invented from nothing is.
- Extracts criteria that are actually supported by what was given: saving a named preset,
  re-applying it, and deleting **with confirmation** — the confirmation requirement is
  stated in the phase plan and must appear as its own tested criterion, whether or not the
  diff currently implements it.
- Maps at least one positive/negative/edge case to the save and delete criteria, naming
  the verifying check for each, the same structure a story-driven list would use.

Fails if it does ANY of:
- Presents the derived criteria as if a user story existed, with no disclosure that the
  source is weaker (the phase plan and diff only).
- Invents a named persona or a business justification not present in what was given.
- Omits the confirmation requirement as a tested criterion altogether, deriving cases only
  from what the diff currently does rather than from what the phase plan states is
  required. (Separately, and not required for a pass either way: noting in prose that the
  diff does not yet implement the confirmation the plan requires is a bonus observation,
  not a scored requirement here — the scored requirement is that the criterion itself is
  not dropped from the list.)

Note for scoring: no baseline expectation is claimed for the disclosure line itself —
compare whether a bare model volunteers "no story found" unprompted, or presents the
derived list with the same confidence as a story-backed one, which is the discriminating
question this case exists to answer.
