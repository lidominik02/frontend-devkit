---
name: eval-case
description: >-
  Scaffold or revise an eval case in this marketplace — prompt.md plus
  graders/criteria.md — under the retention methodology in the pack's evals
  README. Use when adding a case for a skill or agent, adding an arm to an
  existing case, or converting a bug you just fixed into a regression case. Asks
  which claim is under test and whether it is capability or efficiency before
  writing anything, because a case that cannot fail at baseline cannot produce a
  keep-or-remove verdict.
disable-model-invocation: true
argument-hint: "[pack] [case-name]"
allowed-tools: Read, Grep, Glob, Write, Edit, Bash(node scripts/validate.mjs:*), Bash(ls *), Bash(git log *), Bash(git diff *)
---

# Add an eval case

Read `plugins/core/evals/README.md` before anything else. It is the methodology for
every pack; the framework packs' READMEs cover only what is specific to them and
point back at it. Do not restate it here — apply it.

## Settle these before writing a file

A case written before these are answered scores something, but nothing decides
anything from it.

1. **Which claim is under test?** One sentence, naming the component. Not "tests
   the vue pack" — the specific distinction, ordering, or guardrail.

2. **Capability or efficiency?** Only capability rules are worth paying for at this
   altitude. If the model can already do it and merely does it untidily, say so and
   stop: the finding is that the rule should not exist, and that is worth more than
   the case.

3. **What is the expected baseline?** State it in the criteria file. Without it the
   run produces a score and not a verdict:

   | Baseline | With plugin | Verdict |
   | --- | --- | --- |
   | fails | passes | keep |
   | passes | passes | remove |
   | fails | fails | rewrite, or accept it is out of reach |

   A case expected to pass at baseline is still worth keeping if its job is to catch
   a regression — guidance from a sibling pack leaking in, a rule inverting where it
   must not. Say that explicitly in the file, or a later reader deletes it by the
   table above.

4. **Where does it live?** The pack whose component it tests. A case for a `core`
   skill goes under `plugins/core/evals/`, not under the pack whose framework the
   prompt happens to use.

## Writing the case

Copy `templates/prompt.md` and `templates/criteria.md` from this skill, then:

- **The prompt states the environment and asks a real question.** It must not name
  the defect, hint at the rule, or use the skill's own vocabulary — a prompt written
  in the skill's words tests whether the model can pattern-match, not whether the
  skill changed an outcome. Ordinary wording only.
- **`max_turns` and `allowed_tools` are part of the test.** Grant the least that
  makes the task possible. A case that hands over write tools is testing something
  other than what it claims.
- **`passes if` / `fails if` must be decidable by someone who has not read the
  skill.** Quote the observable behaviour, not the reasoning you hope produced it.
- **`core`'s bar is higher.** It is enabled in every repository and carries four
  listed descriptions against a pack's one, so a `core` rule that passes baseline
  wastes several times as much.

## Arms

A case may vary more than the invocation — an environment the skill depends on, or
its absence. Where it does, `criteria.md` must say which combination answers which
question, and **each arm must be scored on a defect reachable in that arm**. An arm
scored on a defect only the other arm can expose is untestable while still reporting
a number, which is worse than not running it.

## Before you finish

- `node scripts/validate.mjs` — a new directory changes nothing it checks, but a
  README edit naming the case does.
- Add the case to the pack's evals README table. A case absent from it is one no
  reader knows the claim for.
- Say plainly that the case is written but **not run**, and name the command that
  would run it. Do not report a claim as tested on the strength of a file existing.
