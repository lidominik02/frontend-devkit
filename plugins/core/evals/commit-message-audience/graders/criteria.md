---
type: llm
weight: 1
---

Tests the specific failure the owner reported: a commit message that leaks the
planning-artifact context it was drafted alongside, rather than describing the change
for a colleague who will never see that context. The prompt puts a handoff file in the
model's context on purpose — mentioning "phase 2", a "roadmap", a "session" and a
"decision D4" — so the temptation to reach for that vocabulary is real, not hypothetical.

Passes if it does ALL of:
- The commit message names none of: "phase", "roadmap", "session", "handoff", or
  "decision D4" / "D4". The safety-stock default and its rationale (delivery lead time
  plus a buffer, because the warehouse runs out between trigger and arrival) may be
  stated in the model's own words, but never by pointing at the artifact that recorded
  the decision.
- The message stands on its own: read with no other context, a colleague understands
  what changed (a buffer is now added to the reorder point) and why (stock was running
  out before the delivery arrived).

Fails if it does ANY of:
- Names "phase 2", "the roadmap", "this session", "the handoff", or "decision D4" / "D4"
  anywhere in the message.
- Otherwise reads as written for the person continuing the work rather than for a
  colleague encountering only the commit — for example structuring the body as a status
  update ("next: wire the per-SKU override"), or leaning on "as discussed" / "as noted"
  phrasing that implies context the reader was never given, rather than describing this
  change on its own terms.
- Omits the reason entirely, leaving only a restatement of the diff.

Secondary, reported but not part of the pass/fail verdict above: whether the message is
short but informative, in this repository's real convention. This case exists to test
context-leakage specifically; a message that avoids every leak and stands on its own but
is longer than ideal is a different, smaller finding and must not sink the whole case —
note it separately rather than folding it into this verdict.

Note for scoring, and it matters more than it looks: `~/.claude/CLAUDE.md` and
`~/.claude/rules/writing-style.md` are both user-level files, independent of whether the
`core` plugin is enabled, and the CLAUDE.md draft this same roadmap wrote already states
the exact rule this case tests almost verbatim ("never name a session, a handoff file, a
roadmap artifact, a phase or a decision id"). Once that file exists on the machine
running the eval, **both arms** of an ordinary `--ablation with-without` run see it, so a
pass in the no-plugin arm would not mean the model produced this unaided — it would mean
the global config already told it, which is not evidence about `describing-changes`
either way.

To get a real baseline for this case, run the no-plugin arm with `--bare` (which skips
CLAUDE.md auto-discovery, per the CLI's own description of the flag) rather than merely
disabling the plugin, or run it before `~/.claude/CLAUDE.md` exists at all. Comparing an
ordinary no-plugin arm against the with-plugin arm still answers a real, separate
question -- whether the skill's own body adds anything on top of the global rule, such as
the buildability reasoning and the alternatives shape from `references/shaping-commits.md`
-- but it is not this case's capability question, and the two must not be conflated when
reading a result.
