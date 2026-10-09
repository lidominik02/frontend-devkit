# Documentation

## Using the devkit

| Document | Read it when |
| --- | --- |
| [Installation](installation.md) | Installing, choosing packs, updating, and the plugins worth installing alongside |
| [The feature lifecycle](feature-lifecycle.md) | Working through a feature, a bug or a branch sync with the `core` skills, and what they write into a repository |
| [Browser verification](browser-verification.md) | Checking a UI change in a real browser, running a QA list, or setting up a browser MCP server |
| [Scripts](scripts.md) | Seeing what the devkit detects in a project, how gates are run and classified, or correcting detection |
| [Hooks](hooks.md) | Finding out what a hook blocked and why, or what no hook covers |
| [Architecture](architecture.md) | Understanding how the packs, the hooks and the lifecycle fit together |

Each pack's README lists its components: [`core`](../plugins/core/README.md),
[`vue`](../plugins/vue/README.md), [`nuxt`](../plugins/nuxt/README.md).

## Working on the devkit

| Document | Read it when |
| --- | --- |
| [Contributing](../CONTRIBUTING.md) | Setting up, running the gates, trying an unreleased change, releasing |
| [Authoring](contributing/authoring.md) | Writing or changing a skill, an agent or a reference file |
| [Validation](contributing/validation.md) | A static check failed, or a value in `devkit.config.json` needs changing |
| [Evals](../plugins/core/evals/README.md) | Deciding whether a component earns its cost |

## Decisions

[Decision records](adr/README.md) explain why the devkit is built the way it is.
