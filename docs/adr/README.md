# Decision records

Each record states one long-lived architectural decision: the forces behind it, the
decision, and what follows from it. The documentation says how things work; a record says
why they are that way and what would have to change to revisit it.

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-node-hooks-with-version-gate.md) | Hooks are Node, started through a version gate | Superseded by 0013 |
| [0002](0002-no-runtime-dependencies.md) | No runtime dependencies and no build step | Accepted |
| [0003](0003-facts-read-at-moment-of-use.md) | Project facts are read at the moment of use | Accepted |
| [0004](0004-framework-packs-layer-as-deltas.md) | Framework packs layer as deltas | Accepted; superseded by 0015 and 0016 once they ship |
| [0005](0005-browser-mcp-not-bundled.md) | The browser MCP server is not bundled | Accepted |
| [0006](0006-guardrails-enforced-where-stated.md) | A guardrail is stated where it is enforced | Accepted |
| [0007](0007-context-cost-tiers-and-listing-ceiling.md) | Three tiers of context cost, and a ceiling on the always-on listing | Accepted |
| [0008](0008-verifying-ui-model-invocable-trial.md) | `verifying-ui` is model-invocable, as a trial | Trial |
| [0009](0009-feature-lifecycle-as-skill-chain.md) | The feature lifecycle is a chain of skills with an automatic review | Accepted, amended by 0013 |
| [0010](0010-shared-version-and-release-branch-model.md) | One shared version, and `main` moves only at a release | Accepted |
| [0011](0011-cross-platform-and-observed-platform-claims.md) | Every platform is supported, and platform claims are observed | Accepted |
| [0012](0012-tooling-values-in-config-not-prose.md) | Values the tooling reads live in a config file, never in prose | Accepted, amended by 0013 |
| [0013](0013-no-hooks-no-facts-service-artifacts-without-a-protocol.md) | No hooks, no facts service, feature files without a protocol | Accepted, amended by 0018 |
| [0014](0014-core-is-domain-neutral.md) | `core` is domain-neutral and runs only declared gates | Proposed; amends 0003 |
| [0015](0015-one-frontend-plugin.md) | One `frontend` plugin holds framework knowledge and web verification | Proposed; supersedes 0004 with 0016, amends 0005 and 0008 |
| [0016](0016-framework-rules-chosen-per-workspace.md) | A router skill picks one framework's rules per workspace | Proposed, to ship as a Trial; supersedes 0004 with 0015, amends 0007 |
| [0017](0017-hard-gates-only-where-failure-does-harm.md) | Hard gates only where a failure does harm | Proposed; amends 0013 |
| [0018](0018-worker-model-and-effort-by-measured-pair.md) | A worker's model and effort change only with a measured pair | Accepted; amends 0013 |

## Writing a record

Copy the shape of an existing record:

```markdown
# NNNN. Title in the indicative

Status: Proposed YYYY-MM-DD | Accepted | Trial | Superseded by NNNN

## Context

The forces that hold today: constraints, costs, platform behaviour.

## Decision

What is done, stated as a rule.

## Consequences

What follows, including what it costs and what would reopen it.
```

Context, Decision and Consequences are required. Add any of these sections, in this order
around them, only when it carries something the three do not: Rationale and Alternatives
considered after Decision; Trade-offs, Constraints and invariants, Validation requirements
and References after Consequences.

- A record states the reason that still holds, not how the decision was reached.
- A record cites only what a reader of the repository can open: no session, phase,
  ticket or internal decision id.
- A `Proposed` record is a decision taken and not yet shipped. Its status line names the
  records it supersedes or amends, and it states its validation requirements. It becomes
  `Accepted`, or `Trial`, with the release that ships it; only then do the records it
  supersedes or amends get their status line. Until then they describe what is in the tree.
- A new record may overturn an accepted one; it says so in its status line rather than
  bending to the old decision.
- An accepted record is not rewritten when the decision changes: a new record supersedes
  it, and the old one's status names the new number.
- A `Trial` record names the evidence that ends the trial, either way.
- Only a decision that shapes the architecture for the long term gets a record. A rule for
  writing components belongs in [Authoring](../contributing/authoring.md).
