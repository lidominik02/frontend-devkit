# 0018. A worker's model and effort change only with a measured pair

Status: Proposed 2026-10-16. Amends 0013.

## Context

`core` dispatches three kinds of worker — code research, the task implementer and the
reviewer — and the main thread runs `describing-changes`. Every request they make draws on
the user's own session and weekly limits, shared across models. On a frontier session model
the reviewer alone was 27–35% of a review's cost, the main thread most of the rest.

[0013](0013-no-hooks-no-facts-service-artifacts-without-a-protocol.md) runs the review on the
session's model. Before this record the research and the `mechanical` implementer were pinned
to `sonnet` by judgement, unmeasured, and each dispatching skill named its own model, so the
same role's model could differ by call site: a fresh fix-round implementer ran on the session's
model while the first round ran on `sonnet`.

The platform resolves a worker's model as: the model the dispatch names, the agent's
frontmatter `model`, `CLAUDE_CODE_SUBAGENT_MODEL`, the session's model; and its effort as
`CLAUDE_CODE_EFFORT_LEVEL`, the dispatch's `effort`, the frontmatter `effort`. A dispatch
`effort` needs Claude Code 2.1.292 or later. A plugin `userConfig` value reaches skill text,
but an option's `default` is not substituted until a value is saved (observed on 2.1.299 and
2.1.301).

## Decision

- Each worker role's model and effort stand in one line, in that role's dispatch template;
  every dispatch site points to it and names no model of its own.
- A line departs from the session's model, or names an effort, only with a measured pair: the
  same cases run on the session's model and on the cheaper arm, three runs each, the exact
  model ids and the CLI recorded. The cheaper arm must hold every criterion line the
  session's model holds in at least two runs of three, and every hard-gate line in all three.
  Among the arms that hold, the one with the lowest mean cost per whole run is chosen; when
  none holds, the line stays on the session's model.
- A skill's own frontmatter may set `effort`, on the same terms, and never `model`.
- A worker whose role has no measured case runs on the session's model.
- The devkit offers no switch of its own for these lines. Users override them with the
  platform's variables, which the installation guide documents.

Measured on Claude Code 2.1.299 under an Opus 5.5 session, the lines are:

| Role | Model · effort | Cases | Per-run cost vs the session's model |
| --- | --- | --- | --- |
| Reviewer (two-axis, verify, re-review) | `sonnet` · `low` | `reviewing-changes-trigger`, `review-spec-axis`, `review-uncommitted-scope` | −32% |
| Implementer, `mechanical` task | `sonnet` · not set | `executing-pause`, `formatter-from-docs`, `formatter-from-hook` | −15% |
| Implementer, `judgment` task and fix round 3 | the session's | none | — |
| Code research | `sonnet` · not set | `clarifying-frontier` | −26% |
| `describing-changes` (main thread) | the session's · `low` | `describing-changes`, `describing-changes-trigger` | −12% |

## Rationale

A cheaper model is only cheaper if the work still passes: a weaker worker that sends the main
thread round again costs more than it saves, which is why the cost is the whole run's. One
line per role means a change lands everywhere the role is dispatched, and a pin without a
measurement behind it cannot hide at one call site.

## Alternatives considered

- Every worker on the session's model: simplest, and it spends the user's limit where the
  measured cases show a cheaper model holds.
- A plugin profile option (`saver`, `balanced`, `quality`): its default does not reach skill
  text until saved, so a profile would arrive unset for users who installed without the dialog.
- A per-call heuristic router: unmeasured, and it would choose the model where no measurement
  stands behind the choice.

## Consequences

- Prices, models and the CLI move, so a line's measurement ages. A new model generation, a
  changed case, or a reported regression on a role reopens that line, and it is measured again
  the same way.
- The main thread does not always pass a dispatch's `effort` (observed in four of the measured
  runs, two of them on the research's `low` arm); where it is dropped, the worker runs at the session's effort, which is the
  pre-measurement behaviour.
- A user on a cheaper session model gains less, and one on Sonnet 5.5 sees no difference for
  `sonnet` lines.
- The `low` effort on `describing-changes` keeps the prompt cache on the 5.5 and Fable 5.1
  models with an API key or subscription, and not on Bedrock, Google Cloud or a gateway.

## Constraints and invariants

- No hook and no mod: the lines are text the dispatching skill reads
  ([0013](0013-no-hooks-no-facts-service-artifacts-without-a-protocol.md)).
- A measured line keeps its regression cases passing
  ([0017](0017-hard-gates-only-where-failure-does-harm.md)).
- `scripts/validate.mjs` rejects a frontmatter `model` or `effort` value the platform does not
  accept.

## Validation requirements

Before the release that ships this record: `node scripts/validate.mjs` and
`node --test "scripts/test/*.test.mjs"` pass, `claude plugin validate --strict` exits clean on
the pinned and the latest CLI, and every case named in the table passed on its chosen line.

## References

[0007](0007-context-cost-tiers-and-listing-ceiling.md),
[0011](0011-cross-platform-and-observed-platform-claims.md),
[0013](0013-no-hooks-no-facts-service-artifacts-without-a-protocol.md),
[0017](0017-hard-gates-only-where-failure-does-harm.md),
[installation](../installation.md#model-and-effort-of-the-workers).
