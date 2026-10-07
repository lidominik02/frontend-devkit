---
name: pack-parity
description: >-
  Check that every specialised pack still holds its delta contract against the
  pack it layers on — carrying only what its layer inverts or adds, naming the
  base rules that do not apply there, and duplicating nothing. Discovers the
  families from the manifests, so it covers any pack added later without being
  told about it. Use after editing either side of a family, when a rule is added
  to one sibling, before a release, or when a reviewer asks whether a split still
  earns its cost. Reports drift as unanswered inversions, leaked rules, duplicated
  text and one-directional pointers.
allowed-tools: Read, Grep, Glob, Bash(node scripts/pack-graph.mjs:*), PowerShell(node scripts/pack-graph.mjs:*), Bash(node scripts/validate.mjs:*), PowerShell(node scripts/validate.mjs:*), Bash(git log *), PowerShell(git log *), Bash(git diff *), PowerShell(git diff *)
---

# Pack parity

Packs in this marketplace layer rather than hedge. A pack that specialises another
carries **only** what its layer inverts or adds, names the base rules that do not
apply there, and the base points back at it. Nothing is duplicated, so nothing can
drift.

That contract is load-bearing and nothing enforces it. Nothing fails when one
sibling gains a rule and the other never hears about it.

## Start by discovering the families

```
node scripts/pack-graph.mjs
```

It reads the dependency declarations and reports, for every family, the paired
reference topics and the ones present on only one side. **Never assume which packs
form a family** — a pack's base is its non-`core` dependency, `core` is the
framework-agnostic floor and forms no family, and a chain is reported as
overlapping pairs so each pack is checked against its immediate base.

If it reports no families, no pack declares a non-core dependency and there is
nothing here to check. Say so and stop.

Run this skill against **every** family it reports, not the first one.

## What drift looks like

Four kinds, in order of how much damage they do:

1. **An unanswered inversion.** A rule added to the base that is false under the
   specialisation's layer, with no counterpart there. This is the one that produces
   confident, wrong output: a project on the specialised stack enables both packs,
   and the base rule applies unopposed.

2. **A leaked rule.** Guidance in the specialisation that is equally true of the
   base. It belongs in the base, where every consumer gets it — a project on the
   plain stack never sees it where it is.

3. **Duplicated text.** The same rule written out on both sides. Correct the day it
   is written, divergent on the first edit to one copy — and the divergence then
   reads to a later reader as a deliberate distinction.

4. **A one-directional pointer.** The base points at the specialisation for an
   inversion but the specialisation does not name the base rule it is inverting, or
   the reverse. A reader arriving from the other side never learns the rule is
   contested.

## Method

For each family the graph reports:

1. **Read the two review checklists as a pair.** They are the densest statement of
   each pack's verdicts and the fastest place to see a verdict stated only once.
   Count the verdicts that invert. If a pack's README states that count, it must
   still be right; report it if it has moved.

2. **Take the asymmetric references in turn.** The graph separates them into
   base-only and specialisation-only, and each carries its own question:
   - Base-only: does the specialisation's layer invert any of this? If yes and it
     is unanswered, that is kind 1.
   - Specialisation-only: is any of this true of the base too? If yes, that is
     kind 2.
   A reference with no counterpart is not automatically drift — a subject the layer
   does not touch legitimately lives on one side — but it is where you look first.

3. **Check recent edits on both sides.** A commit touching one sibling's checklist
   and not the other is the signature of kinds 1 and 2. Not proof; the thing to read.

4. **For every rule that inverts, confirm both directions.** The base names that it
   does not hold under the specialisation's layer; the specialisation names the base
   rule it replaces. Either missing is kind 4.

5. **Check the ablation pair still opposes.** A split earns its cost only if there is
   a matched pair of eval cases — the same code, reaching opposite verdicts on each
   side. The graph lists both packs' cases. Find the pair; if both now expect the
   same verdict, or no such pair exists, the split has quietly stopped being tested
   and that is the most important finding you can report.

## Output

Findings with `file:line` on **both** sides of each pair — a parity finding naming
only one file cannot be acted on. For each:

```
<kind>: <one sentence>
  <base pack>:           <path>:<line>
  <specialisation pack>: <path>:<line>   (or: absent)
  <the project where this produces a wrong answer>
```

Group by family when there is more than one. Report no finding you cannot tie to a
wrong answer in a real project. Read-only: propose the fix, do not write it.
