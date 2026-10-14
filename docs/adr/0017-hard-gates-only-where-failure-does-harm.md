# 0017. Hard gates only where a failure does harm

Status: Proposed 2026-10-14. Amends 0013.

## Context

[0013](0013-no-hooks-no-facts-service-artifacts-without-a-protocol.md) admits a new hook,
script, skill or agent only with the reported failure it prevents. Applied to every
addition, that mostly delayed structural changes the maintainer had already decided with
their cost stated. The eval harness cannot measure every addition in advance either: it
loads only the plugin under test.

Some failures do harm that is silent or cannot be undone: a false green gate, a migration
that breaks an installed consumer, a regression in a measured case, one framework's rule
loaded in another framework's project.

## Decision

- Four things are hard gates and must pass before a release: gate safety (no false green),
  migration, regression of the existing cases, and framework isolation.
- Anything else — a skill, an agent, a reference, a script, new content — is admitted by
  the maintainer's decision, with its cost stated, and measured after it ships. It need not
  first pass an eval that fails without it.
- Deletion stays the default: content the baseline handles without it is removed at cleanup.
- The hook rule of 0013 is unchanged.

## Rationale

Gates belong where damage is silent or can only be fixed forward
([0010](0010-shared-version-and-release-branch-model.md)). Everywhere else, measuring after
and deleting is cheaper than proving before.

## Alternatives considered

- Evidence first for every addition: slows decided changes and asks for measurements the
  harness cannot make up front.
- No hard gates: false greens and broken migrations reach installed sessions.

## Consequences

- Content can ship unmeasured, so cleanup has to happen. A measured-after case the baseline
  passes is removed along with the content it measured.
- An unmeasured addition that causes a reported regression reopens this record.

## Constraints and invariants

- A hard gate is reported pass, FAIL or NOT RUN, never implied
  ([0011](0011-cross-platform-and-observed-platform-claims.md)).
- The devkit still ships no hook and runs no project code automatically.

## Validation requirements

Before every release, each of the four hard gates that the release touches has a recorded
result.

## References

[0010](0010-shared-version-and-release-branch-model.md),
[0011](0011-cross-platform-and-observed-platform-claims.md),
[0013](0013-no-hooks-no-facts-service-artifacts-without-a-protocol.md),
[0014](0014-core-is-domain-neutral.md), [0015](0015-one-frontend-plugin.md),
[0016](0016-framework-rules-chosen-per-workspace.md).
