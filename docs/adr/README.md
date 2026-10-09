# Decision records

Each record states one long-lived architectural decision: the forces behind it, the
decision, and what follows from it. The documentation says how things work; a record says
why they are that way and what would have to change to revisit it.

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-node-hooks-with-version-gate.md) | Hooks are Node, started through a version gate | Accepted |
| [0002](0002-no-runtime-dependencies.md) | No runtime dependencies and no build step | Accepted |
| [0003](0003-facts-read-at-moment-of-use.md) | Project facts are read at the moment of use | Accepted |
| [0004](0004-framework-packs-layer-as-deltas.md) | Framework packs layer as deltas | Accepted |
| [0005](0005-browser-mcp-not-bundled.md) | The browser MCP server is not bundled | Accepted |
| [0006](0006-guardrails-enforced-where-stated.md) | A guardrail is stated where it is enforced | Accepted |
| [0007](0007-context-cost-tiers-and-listing-ceiling.md) | Three tiers of context cost, and a ceiling on the always-on listing | Accepted |
| [0008](0008-verifying-ui-model-invocable-trial.md) | `verifying-ui` is model-invocable, as a trial | Trial |
| [0009](0009-feature-lifecycle-as-skill-chain.md) | The feature lifecycle is a chain of skills with an automatic review | Accepted |
| [0010](0010-shared-version-and-release-branch-model.md) | One shared version, and `main` moves only at a release | Accepted |
| [0011](0011-cross-platform-and-observed-platform-claims.md) | Every platform is supported, and platform claims are observed | Accepted |
| [0012](0012-tooling-values-in-config-not-prose.md) | Values the tooling reads live in a config file, never in prose | Accepted |

## Writing a record

Copy the shape of an existing record:

```markdown
# NNNN. Title in the indicative

Status: Accepted | Trial | Superseded by NNNN

## Context

The forces that hold today: constraints, costs, platform behaviour.

## Decision

What is done, stated as a rule.

## Consequences

What follows, including what it costs and what would reopen it.
```

- A record states the reason that still holds, not how the decision was reached.
- A record cites only what a reader of the repository can open: no session, phase,
  ticket or internal decision id.
- An accepted record is not rewritten when the decision changes: a new record supersedes
  it, and the old one's status names the new number.
- A `Trial` record names the evidence that ends the trial, either way.
- Only a decision that shapes the architecture for the long term gets a record. A rule for
  writing components belongs in [Authoring](../contributing/authoring.md).
