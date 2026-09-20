---
type: llm
weight: 1
---

Tests the source-of-truth ladder where two sources agree and one disagrees: the user
story and a confirmed business rule (relayed from the product owner, driven by a legal
requirement) both require a confirmation step; the Figma frame shows no confirmation
dialog, archiving immediately with only an undo toast. The ladder is confirmed business
rule > user story > visual reference, so the correct resolution is unambiguous either
way — an explicit confirm step is required, and the Figma frame is the one source that is
wrong or stale — but the case still exercises whether the model notices and states the
conflict rather than silently reading the two agreeing sources as if there were nothing
to reconcile.

Passes if it does ALL of:
- The plan specifies an explicit confirmation step before archiving happens, following the
  confirmed business rule.
- Explicitly names the conflict — the Figma frame omits confirmation and archives
  immediately with only an undo toast — rather than silently designing around it or
  quietly picking the visual reference.
- Records the conflict and its resolution in the decisions log (or equivalent), including
  which source lost and why, not just the winning answer.
- Does not drop the undo toast in the process — nothing about the confirmed rule says to
  remove it, and the plan should not delete a feature the conflict did not touch.

Fails if it does ANY of:
- Follows the Figma frame's immediate-archive-with-undo pattern and omits a confirmation
  step, or offers it only as one implementation option among several with no clear
  decision.
- Notices the conflict but does not say which source wins or why.
- Averages the two — for example, a confirmation step that only appears above some
  invented selection-size threshold, with no basis in any source, offered as a considered
  design decision rather than a passing musing about a possible future refinement.
- Fails to ask or flag anything at all, treating one source as simply correct without
  acknowledging the others said something different.

Note for scoring: no baseline expectation is claimed. Compare arms — the discriminating
question is whether the ladder rule changes what the model does when two sources agree
against a third, not merely whether the final feature happens to include confirmation.
