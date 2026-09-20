---
type: llm
weight: 1
---

Tests firing, not writing quality. `describing-changes`' description matches this kind of
request when judged on its frontmatter alone, but observed usage showed the skill going
long stretches with no `Skill` tool call at all despite matching phrasing appearing
repeatedly — something between "the description matches" and "the Skill tool gets called"
was not happening. This case exists to catch that going forward.

The prompt deliberately uses an informal, realistic register ("give me a commit msg, keep
it short but informative") rather than an invented phrasing — the one case in this pack
where matching real usage is the point, not a contamination risk, because the question
under test is whether this exact register fires the skill, not whether the model can
write a good message unaided.

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
times to distinguish "occasionally does not fire" from "reliably does not fire." If a
repository also has its own personal or project-local skill claiming the same informal
register, re-run this case after removing it — a competing skill of the same shape can
suppress this one's firing even when this one's own fires, when they happen, are never
contested by another `core` description.
