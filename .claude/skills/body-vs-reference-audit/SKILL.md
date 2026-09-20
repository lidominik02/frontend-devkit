---
name: body-vs-reference-audit
description: >-
  Audit which parts of a skill's SKILL.md body have earned their place there
  rather than in a reference file, since a body loads on every trigger while a
  reference loads only when the body points at it. Use when a SKILL.md has grown,
  when the always-on or per-trigger cost of a pack comes up, before promoting a
  skill to the always-on listing, or when a body has outgrown the references it
  cites. Reports movable sections with the trigger-time cost of each and what the
  body must keep to stay followable.
allowed-tools: Read, Grep, Glob, Bash(node scripts/validate.mjs:*), Bash(wc *), Bash(ls *)
---

# Body versus reference

This marketplace's cost model has three tiers, and they are not close in price:

| Tier | Loaded |
| --- | --- |
| Description | Always, in every session that enables the pack |
| Body | On every trigger |
| Reference | Only when the body points at it |

`scripts/validate.mjs --checks=budget` measures the first tier. Nothing measures
the second, and it is where bodies quietly grow past their own references.

## What must stay in the body

Moving the wrong thing out is worse than leaving it in, because the body stops
being followable on its own and the model acts before it reads the reference.

Keep in the body:

- **Every guardrail.** A rule about what the skill must not do is not in context
  when it lives in a reference. If the skill must refuse something, the body refuses.
- **The order of operations.** What to do first, and what must be settled before
  writing anything.
- **The decision that routes to a reference.** The body must say enough for the
  model to know *which* reference it needs and *when* — a pointer with no criterion
  is either always followed or never.
- **Anything that changes the outcome of the first action taken.**

## What is a candidate to move

Material consulted rather than followed, and not on the path of every invocation:

- Version matrices and compatibility tables.
- Exhaustive enumerations where the body needs only the distinction.
- Worked examples beyond the first.
- Per-case detail behind a branch most invocations do not take.
- Background explaining *why* a rule holds, where the rule itself is stated.

## Method

1. **Measure first.** `wc -l` every `SKILL.md` and every file under its
   `references/`. A body larger than any of its own references is the signal to look
   — it means the most-loaded file is also the biggest.

2. **Classify each section of the body** as keep or candidate, by the two lists
   above. Do this per section, not per file: the finding is which part moves, and a
   whole-file verdict cannot be acted on.

3. **For each candidate, name its destination.** An existing reference, or a new
   one. A candidate with nowhere to go usually turns out to be a guardrail.

4. **Check the pointer survives.** After a move, the body must still say when to
   read the reference. Write the replacement sentence as part of the finding — if it
   cannot be written in one line, the material was load-bearing and stays.

5. **Report the saving as a number.** Lines moved out of the body, and what fraction
   of it that is. A recommendation to restructure a file without a number attached is
   not worth acting on.

## What this is not

Not a style review. Do not report a body as too long because it reads long — report
a section that loads on every trigger and is consulted on few. If a body is large
because every part of it is followed every time, say so and report nothing.

Read-only. Propose the moves and do not make them: a move changes what a reference
check resolves, so it belongs in a change with `node scripts/validate.mjs` run after.
