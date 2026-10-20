# Validation

`scripts/validate.mjs` is the single implementation of everything `claude plugin validate`
will not check. CI, the release workflow and `/release` all call that same file, so they
cannot drift. It runs in a terminal in well under a second. Why the one value it reads lives
in the script itself: [ADR 0012](../adr/0012-tooling-values-in-config-not-prose.md).

## Checks

| Check | Catches |
| --- | --- |
| `frontmatter` | In every shipped component and every skill and agent under `.claude/`: a missing description, one past the 1024-char packaging cap, a `<` or `>` in the description, a skill whose `name` is not kebab-case or does not match its directory, an agent without a `name` or with a `:` in it, any frontmatter field Claude Code does not read, and `permissionMode`, `hooks`, `mcpServers` or `initialPrompt` in a plugin agent (honoured for a project agent and ignored for a plugin agent: documented, and observed for `permissionMode` on 2.1.283) |
| `structure` | A directory under a pack's `skills/` or under `.claude/skills/` without a `SKILL.md`, and a `${CLAUDE_PLUGIN_ROOT}/` path in any `.md` under a pack's `skills/` or `agents/`, references included, that does not resolve inside that pack |
| `budget` | The always-on description total of the shipped packs over the ceiling, `BUDGET_CEILING` in `validate.mjs`. `--checks=budget` prints the total against the ceiling |
| `references` | A cited `.md` that does not resolve **from the file citing it** |
| `contents` | A reference under a pack's `skills/` longer than `CONTENTS_THRESHOLD` in `validate.mjs` without a `## Contents` list as its first section, and, at any length, a `## Contents` list that is not its first section or does not name its `##` sections, in order, one `- <heading>` line each; a heading inside a code fence is no section |
| `scripts` | A `.mjs` under `plugins/` or `scripts/` that does not parse |
| `versions` | A `plugin.json` without `version`, one not `X.Y.Z`, two packs disagreeing, a `marketplace.json` entry declaring `version`, no entries at all, or a `plugins/` directory with no entry |
| `changelog` | A plugin version with no `## X.Y.Z - YYYY-MM-DD` section in `CHANGELOG.md`, the heading the release workflow takes the notes from; `TBD` in place of the date is a finding |

Every check that reads a pack reads the packs `marketplace.json` lists, so a marketplace entry it cannot follow — a non-path source, a missing
or invalid `plugin.json` — is a finding in each of them, and a pack it does not list is
read by none of them until it is, apart from the `scripts` check's parse step, which
parses every `.mjs` under `plugins/` and `scripts/` whether its pack is listed or not.

Run a subset with `--checks=frontmatter,budget`; `node scripts/validate.mjs --checks=budget`
prints the current always-on total.

## What `claude plugin validate --strict` does and does not check

**`--strict` does not read component frontmatter.** It flags an unknown field in
`plugin.json` and a missing `description` in a `SKILL.md`, but a *misspelled* frontmatter
key passes clean — checked against 2.1.250, 2.1.276, 2.1.278, 2.1.283 and 2.1.301. That failure is
silent and expensive in both directions: misspell `disable-model-invocation` and a typed
skill starts auto-triggering in every repository, misspell `disallowed-tools` and a
guardrail stops being enforced with
the prose still claiming it is. What the validator will not check is owned by
`scripts/validate.mjs`, which runs in a terminal in well under a second — there is no
reason to reach for `act` or to keep those rules true by hand.

`--strict` turns an unrecognised field into an error, which is the only way to catch a typo
such as `mcpServer` for `mcpServers` — Claude Code ignores unknown fields at load time, so
without it the component silently never loads. Every manifest carries `version`, so it is
expected to exit clean here; CI fails a target on any finding or a non-zero exit.

## Named remainders

`core` is domain-neutral ([ADR 0014](../adr/0014-core-is-domain-neutral.md)), and no check
enforces that. A review reads it with one grep:

```
grep -rniE 'frontend|vue|nuxt|vitest|jest|npm|storybook|figma|browser|composable|screen|design token|component|\bapi\b' plugins/core docs
```

Every hit is either replaced or one of the remainders below, each kept for a stated reason
until the trigger that ends it. A hit that fits none of them is a finding.

| Remainder | Where | Why it stays | Ends when |
| --- | --- | --- | --- |
| K1: the held-check guardrail naming Storybook and a browser | the "must NOT" and rules lines of `clarifying-features`, `planning-features`, `executing-plans`, `reviewing-changes`, `finishing-features`, `syncing-branches`, `fixing-bugs`, `rules-block.md`, the `implementer` and `reviewer` agents | The web checks still live in `core`, and a guardrail must name what it holds back | Web verification and UI QA leave `core` ([ADR 0015](../adr/0015-one-frontend-plugin.md)) |
| Web verification and UI QA | `verifying-ui` and its references; `testing-changes`, `qa-test-list.md`, `design-intent.md`, `storybook-check.md`; the routing lines to `verifying-ui` in `reviewing-changes` and `testing-changes`; `preparing-a-repo`'s browser question; `docs/browser-verification.md` and its row in `docs/README.md`; the browser paragraph of `docs/architecture.md`; the `core` README rows; the `reviewer` agent's runtime-only, state and screen lines | They are UI capabilities that ship in `core` today | They move to the `frontend` plugin ([ADR 0015](../adr/0015-one-frontend-plugin.md)) |
| Framework routing | `project.md` `## Framework packs`; `preparing-a-repo`'s Vue type-check question | The framework packs are chosen from `package.json` until a workspace chooses its rules | A workspace chooses its framework rules ([ADR 0016](../adr/0016-framework-rules-chosen-per-workspace.md)) |
| UI repro rows | `fixing-bugs` `loop.md` "Repro by kind of bug" (component, store, route, layout rows), the component and store examples of "A correct seam", and section 5's "layout, focus, hydration, a real browser API" | Domain-neutral rows lead; the UI rows serve the UI repositories `core` still serves | The web knowledge leaves `core` ([ADR 0015](../adr/0015-one-frontend-plugin.md)) |
| JavaScript lockfile facts | `syncing-branches` `conflicts.md`: the four JavaScript rows of the lockfile table; the JavaScript lockfile examples in `project.md`, `preparing-a-repo` and `docs/installation.md` | Each row is a verified fact about one tool's lockfile; a lockfile the table does not list is never merged by hand, and a new tool gets its own row | Never: the table grows a row per verified tool |
| User and report vocabulary | `investigating-bugs`: the description's "is this a frontend or backend bug", "browser, native build" among where a report appears, and a screenshot among what a report holds | It is the user's wording and a report's environment, not a claim about the repository | The listing is measured again with the `frontend` plugin ([ADR 0015](../adr/0015-one-frontend-plugin.md)) |
| The framework packs and the marketplace name | `vue`, `nuxt` and `frontend-devkit` in `docs/architecture.md`, `docs/installation.md`, `docs/README.md`, the manifests and the evals README | The packs exist and the marketplace keeps its name | `vue` and `nuxt` become the `frontend` plugin ([ADR 0015](../adr/0015-one-frontend-plugin.md)); the name, by a rename decision |
| Observed tool and server names | `docs/contributing/authoring.md`: `figma`, `chrome-devtools`, browser MCP observations | Each records a behaviour observed against a named server and CLI version | The component that cites it moves or is removed |
| Design material in clarifying and planning | `clarifying-features`: the description's "build this screen", the bounded-size examples, `sources.md`'s design source, no-design proposal, design gap check and research question 2, `question-rounds.md`'s State row and empty-list example; the Design field in `artifacts.md` and `planning-features` | A UI feature's design is a requirement source while `core` plans UI work, and it is skipped for a change with no UI | The `frontend` plugin settles whether design material moves with it ([ADR 0015](../adr/0015-one-frontend-plugin.md)) |
| Code-unit words | "component" beside a helper and a shared module in `designing-architecture`, `codebase-design.md`, `syncing-branches` and the `reviewer` agent's Reuse line | One kind of unit among others, named by the repository's own word | Never |
| The devkit's and Claude Code's own terms | "component" for a skill or an agent in `docs/` and `preparing-a-repo`; "API key" and a server's URL in `docs/installation.md` | They name the devkit's and the CLI's own parts, not the repository's domain | Never |
| Decision records | `docs/adr/` | A record states the context it was decided in, and an accepted record is not rewritten | Never: a later record amends it |
| Eval fixtures | `plugins/*/evals/` | Fixture content is a test's input, not shipped behaviour | The case is retired |
