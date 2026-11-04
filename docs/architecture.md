# Architecture

How the parts of the devkit fit together, and the principles that shape them. Each section
links the decision record that holds the reasoning.

## A marketplace of packs

The devkit is a Claude Code marketplace of two plugins, called packs, and neither depends
on the other:

- **`core`** — domain-neutral, for any repository: the feature lifecycle, bug investigation
  and fixing in any layer, branch syncing, review, commit and merge request text, and
  repository preparation. Enabled in every repository.
- **`frontend`** — the framework rules and web verification. Enabled in frontend and mixed
  repositories; in a team repository at local scope.

```
core ──Skill tool, by name, optional──▶ frontend
                                        ├─ frontend-engineering: per workspace, package.json ──▶ one framework's rule set
                                        └─ verifying-ui: browser · design intent · Storybook
```

`core` knows exactly two names in `frontend`: `frontend:frontend-engineering` for the rules
of the workspace being changed, and `frontend:verifying-ui` for the web QA cases. When a
name is not listed, `core` says once "frontend plugin not enabled in this session" and goes
on without it, skipping those cases by name.
[ADR 0015](adr/0015-one-frontend-plugin.md)

`frontend-engineering` is a router. For each workspace the work touches, it reads that
workspace's `package.json`, selects one framework's set of references — a set that
specialises another is loaded after its base and wins a conflict — and loads nothing of the
others. A Vue workspace never sees Nuxt rules, and the listing carries one description
however many frameworks there are. The selection table in
[`frontend-engineering/SKILL.md`](../plugins/frontend/skills/frontend-engineering/SKILL.md)
is the only place a base and its delta are paired.
[ADR 0016](adr/0016-framework-rules-chosen-per-workspace.md)

## Facts are read at the moment of use

The devkit runs on top of an existing project and requires nothing to be added to it.
Every fact it needs — the tool that runs a manifest, quality gates, base branch, git
host, commit convention — is read at the moment of use from a file the project already
maintains: a manifest, its lockfile, the git remote, a commit-message linter's config,
`.gitlab/merge_request_templates/`. Nothing is cached, so nothing goes stale. It is read
by the skill that needs it, with the four rules in
[`project.md`](../plugins/core/skills/planning-features/references/project.md);
[ADR 0003](adr/0003-facts-read-at-moment-of-use.md) records why.

The one capability that is not self-contained is the browser: `frontend:verifying-ui`
drives an MCP server the consuming repository installs.
[ADR 0005](adr/0005-browser-mcp-not-bundled.md)

## Three tiers of context cost

What a component costs depends on when it loads:

| Tier | Loads | Belongs there |
| --- | --- | --- |
| Description | Always, in every session of every repository that enables the pack | The trigger: one capability clause, the phrasings a user types, the neighbour to use instead |
| Body | When the skill or agent is triggered | Guardrails and the order of work |
| Reference | Only when the body points at it | Lookup material |

The always-on descriptions have a ceiling, and a repository that does not enable `frontend`
pays nothing for it.
[ADR 0007](adr/0007-context-cost-tiers-and-listing-ceiling.md)

## Where a guardrail is enforced

A rule is stated where it is enforced, and the enforcement is layered:

1. **The skill body** states what the component must not do. On its own this is advisory.
2. **`allowed-tools`** pre-approves only what a body actually runs, to remove prompts; a
   command held behind approval is never granted.
3. **`disallowed-tools`** removes a tool from the invocation to the end of that turn, for a
   prohibition that is absolute.
4. **The user's permission and attribution settings**, which
   [Installation](installation.md#permissions-and-attribution) recommends, apply whoever
   runs the command: credential reads, lockfile and `.git/` writes, push, pull and merge are
   denied, and no attribution is added — the user pushes and merges.

[ADR 0006](adr/0006-guardrails-enforced-where-stated.md) records the model;
[Installation](installation.md#permissions-and-attribution) lists what the settings cover
and what they do not.

## The feature lifecycle

Work moves through a chain of separate skills — clarify, plan, execute, review, QA on
request, finish — and each writes its state to files under `temp/`, so a new session can
continue from them. [The feature lifecycle](feature-lifecycle.md) describes it;
[ADR 0009](adr/0009-feature-lifecycle-as-skill-chain.md) records why.

## Scope: the repository's own code

The skills fix the repository's own code in any layer once the user decides; code it only
consumes ends in a report for its owner.

## Principles

- **Systematic over ad hoc.** Work moves through the lifecycle chain in order, and every
  plan task carries a Done when that names the gates and the observation that must hold.
- **Less complexity, not more.** The reviewer's quality axis checks reuse, altitude and the
  deletion test; a plan records decisions, not code; and deleting a component is
  preferred to adding one.
- **Evidence over claims.** A gate that did not run is reported NOT RUN; the verifier holds
  a candidate refuted until its trigger is shown; a finding cites a `file:line` its reviewer
  opened; and a claim about CLI behaviour was observed, and carries the version.
  [ADR 0011](adr/0011-cross-platform-and-observed-platform-claims.md)
