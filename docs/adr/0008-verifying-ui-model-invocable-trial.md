# 0008. `verifying-ui` is model-invocable, as a trial

Status: Trial

## Context

`verifying-ui` opens a browser and drives the application under test. A skill that does
that unasked is intrusive, which argues for `disable-model-invocation`.

But hiding a skill from the model does not merely stop it firing unasked: it removes the
skill's name from what the model can see at all. The lifecycle step this skill owns — the
browser cases of a QA run, a check after a UI change — could then only run when someone
typed it.

## Decision

- `verifying-ui` is model-invocable and listed in the always-on descriptions.
- The hold that `disable-model-invocation` would have enforced by invisibility is the
  skill's own first instruction instead: it stops and asks for an explicit release before
  opening a browser. `testing-changes`' `run` mode holds the same way.

## Consequences

- The skill costs its description in every session, under the ceiling of
  [0007](0007-context-cost-tiers-and-listing-ceiling.md).
- The hold is a prompt-level guarantee, not an enforced one.
- The trial ends on evidence. The `verifying-ui` eval case in `plugins/core/evals/`
  measures, in the arm where the skill is present but not typed, whether it fires on the
  wording, holds until released, and looks with more discipline than the arm without the
  plugin. If it fires when it should not, or the listing cost buys nothing,
  `disable-model-invocation` goes back and this record is superseded.
