---
type: llm
weight: 1
---

A negative test for the one-environment rule: a new `VITE_` variable holds an
environment-specific URL, but the prompt states that the pipeline builds once per
environment on purpose and never promotes a bundle. The pack rates a single-environment
build Critical only in a project that builds once and promotes that artifact; a project
that deliberately builds per environment is not a finding there. The defect is applying
the rule anyway: rating the new variable Critical or blocking because the build is
environment-specific, or requiring runtime configuration before the change can merge.

Expected baseline: pass. The baseline arm is `core` alone, as the vue evals README sets
it. The case is kept as a regression guard: it fails if the pack's one-environment rule
is applied to a project whose pipeline the prompt says builds per environment.
For the runner, not the grader: record which of the pack's files
the with-plugin arm read. A fail driven by `SKILL.md` or `references/env-and-config.md`
without a Read of `references/review-checklist.md` is still a fail; record it as the
unconditional text over-applying, not as a void run.

The fails-if lines measure the pack's rule. The passes-if lines are expected to pass on
both arms.

A fails-if hit fails the answer even when every passes-if clause is met.

Passes if it does ALL of:
- Gives a review of the diff that ends in a verdict: approve, approve with comments, or
  request changes, in those or equivalent words. A findings list with no verdict word
  reads as approve with comments when nothing in it is Critical or blocking, and as
  request changes otherwise.
- Does not rate the new `VITE_SEARCH_URL`, or the build being environment-specific, as
  Critical or blocking. Not mentioning it meets this. Saying that the build is
  environment-specific and that this is fine because the pipeline builds per
  environment is credited, but not required. So is a conditional — "Critical if bundles
  were promoted; they are not, so not a finding" — when the verdict does not block on it.

Fails if it does ANY of:
- Rates the new `VITE_` URL Critical, Blocking, or a finding that must be fixed before
  merge, because the build is environment-specific — under any name: "the artifact
  cannot be promoted", "build-time config for an environment-specific value", "one build
  per environment".
- Makes runtime configuration a requirement: says the URL must move to a `/config.json`
  or another file read at runtime, or that the pipeline must change to build once and
  promote, before the change can merge. A Warning or Info note is not this, including
  one that recommends runtime config or a build-once pipeline, as long as that note is
  not what holds the merge.
- Holds the verdict or the merge until the team confirms whether bundles are promoted.
  The prompt already says they are not. A question asked beside a verdict that does not
  block is not this.

Note for scoring: the diff has no other defect the case relies on. A finding about
something else — the new endpoint path, CORS for the new origin, `VITE_SEARCH_URL`
missing from a development env file, error handling, a missing test — neither passes nor
fails the answer, even when it is rated Critical and is about the same variable; score
only the clauses above.
