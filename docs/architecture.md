# Architecture

How the parts of the devkit fit together, and the principles that shape them. Each section
links the decision record that holds the reasoning.

## A marketplace of packs

The devkit is a Claude Code marketplace of three plugins, called packs:

- **`core`** — framework-agnostic: the feature lifecycle, bug investigation and fixing,
  branch syncing, review, commit and merge request text, browser verification, and the
  hooks. Enabled in every repository.
- **`vue`** — Vue 3 engineering and review knowledge for single-page apps on Vite.
- **`nuxt`** — what server rendering inverts or adds on top of `vue`.

The framework packs layer instead of hedging:

```
nuxt  ──depends on──▶  vue  ──depends on──▶  core
```

`vue` holds the component-model truth that is identical everywhere. `nuxt` carries only
what server rendering inverts or adds, names every `vue` rule that does not apply there,
and `vue` points back at it. `project-facts.mjs` reports which packs serve a project as
`stack.packs`, ordered general to specific — the later pack wins a conflict.
[ADR 0004](adr/0004-framework-packs-layer-as-deltas.md)

## Facts are read at the moment of use

The devkit runs on top of an existing project and requires nothing to be added to it.
Every fact it needs — package manager, quality gates, base branch, git host, commit
convention — is read at the moment of use from a file the project already maintains:
`package.json`, the lockfile, the git remote, `commitlint.config.*`,
`.gitlab/merge_request_templates/`. Nothing is cached, so nothing goes stale.
[Scripts](scripts.md) describes what is read;
[ADR 0003](adr/0003-facts-read-at-moment-of-use.md) records why.

The one capability that is not self-contained is the browser: `verifying-ui` drives an MCP
server the consuming repository installs.
[ADR 0005](adr/0005-browser-mcp-not-bundled.md)

## Three tiers of context cost

What a component costs depends on when it loads:

| Tier | Loads | Belongs there |
| --- | --- | --- |
| Description | Always, in every session of every repository that enables the pack | The trigger: one capability clause, the phrasings a user types, the neighbour to use instead |
| Body | When the skill or agent is triggered | Guardrails and the order of work |
| Reference | Only when the body points at it | Lookup material |

The always-on descriptions have a ceiling, and a repository that enables only the pack for
its framework pays only for that pack.
[ADR 0007](adr/0007-context-cost-tiers-and-listing-ceiling.md)

## Where a guardrail is enforced

A rule is stated where it is enforced, and the enforcement is layered:

1. **The skill body** states what the component must not do. On its own this is advisory.
2. **`allowed-tools`** pre-approves only what a body actually runs, to remove prompts; a
   command held behind approval is never granted.
3. **`disallowed-tools`** removes a tool for the invocation, for a prohibition that is
   absolute.
4. **Hooks** are deterministic and apply whoever runs the command, on the tool calls their
   matchers select: they block credential reads and exfiltration, a commit message with a
   private reference, and the push and merge forms they can parse — the user pushes and
   merges.

[ADR 0006](adr/0006-guardrails-enforced-where-stated.md) records the model;
[Hooks](hooks.md) lists what each hook does and what no hook covers.

## The feature lifecycle

Work moves through a chain of separate skills — clarify, plan, execute, review, QA on
request, finish — and each writes its state to files under `temp/`, so a new session can
continue from them. [The feature lifecycle](feature-lifecycle.md) describes it;
[ADR 0009](adr/0009-feature-lifecycle-as-skill-chain.md) records why.

## Scope: the frontend

The skills work on frontend code. A diagnosis may follow a bug into the backend or the
identity layer to find the layer that owns it, but only a frontend fix is made; a cause
elsewhere ends in a report for its owner, and a frontend guard against it needs the user's
approval.

## Principles

- **Systematic over ad hoc.** Work moves through the lifecycle chain in order, and every
  plan task carries a Done when that names the gates and the observation that must hold.
- **Less complexity, not more.** The review's `architecture` lens checks reuse, altitude and
  the deletion test; a plan records decisions, not code; and deleting a component is
  preferred to adding one.
- **Evidence over claims.** A gate that did not run is reported NOT RUN; the verifier holds
  a candidate refuted until its trigger is shown; a finding cites a `file:line` its reviewer
  opened; and a claim about CLI behaviour was observed, and carries the version.
  [ADR 0011](adr/0011-cross-platform-and-observed-platform-claims.md)
