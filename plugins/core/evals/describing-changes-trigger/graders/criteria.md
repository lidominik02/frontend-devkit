---
type: llm
weight: 1
---

Tests firing, not writing quality — this is the case Q2 flagged as unresolved: the
description fires correctly on the owner's real phrasings when judged in isolation
(confirmed by `trigger-tester` against the frontmatter alone), yet the skill had still
never fired in this repository across two days it was listed and eleven commits were
authored. Something between "the description matches" and "the Skill tool gets called"
was not happening, and this case exists to catch it going forward rather than re-argue
Q2's open question.

The prompt deliberately uses the owner's own informal register ("give me a commit msg,
keep it short but informative") rather than an invented phrasing — the one case in this
pack where matching real usage is the point, not a contamination risk, because the
question under test is whether this exact register fires the skill, not whether the
model can write a good message unaided.

Passes if it does ALL of:
- A `Skill` tool call naming `describing-changes` (or `core:describing-changes`) appears
  in the transcript before the commit message is produced.
- The produced message is a real commit message shaped by the skill's process — it
  attempts to establish or state the repository's convention rather than silently
  assuming Conventional Commits with no acknowledgement of where that came from.

Fails if it does ANY of:
- No `Skill` tool call appears at all, and the reply still produces a commit message —
  this is the specific failure under test: the description matches but nothing invoked
  it, or the model answered from the conversation alone.
- The `Skill` tool call is present but for a different skill.
- The reply asks a clarifying question that the skill's own body does not call for,
  stalling before producing anything. This is a distinct failure from not firing at
  all: the harness gives one weighted verdict per grader file, which cannot separate
  the two, so **read the transcript by hand** and record which of the two happened
  rather than reporting only the collapsed pass/fail — per this pack's own eval
  methodology, a number from a collapsed grader is a number about the whole file, not
  about the specific line under test.

Note for scoring: run this in the **with-plugin arm only** — there is no baseline
question here, since a no-plugin arm has no skill to fire. What this measures across
repeated runs is the fire rate itself; a single pass or fail says little; run it enough
times to distinguish "occasionally does not fire" from "reliably does not fire outside
`trigger-tester`'s isolated judgment," and re-run this case after S12 archives the
personal components — Q3 found every one of this skill's real fires uncontested by
another `core` description, but the fact of firing at all may still be suppressed by a
personal component claiming the same informal register first.
