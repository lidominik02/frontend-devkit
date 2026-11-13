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

## The behaviour smoke

Every check above reads files; none runs a skill. The `behaviour-smoke` job of
`canary.yml` runs one: a `claude -p` with `core` and `frontend` loaded from the checkout by
`--plugin-dir`, in a temporary directory whose only file is a `package.json` declaring
`nuxt` and `vue`, invoking `/frontend:frontend-engineering`. The step fails unless the
output carries the router's Nuxt selection, `vue-* + nuxt-*`.

It runs only on a manual dispatch of the canary, never on its weekly schedule, and skips
itself with a notice when the `CLAUDE_CODE_OAUTH_TOKEN` repository secret is not set. The
maintainer generates that token with `claude setup-token`; the run is billed to the
maintainer's Claude subscription, not to an API key. code.claude.com documents the token
for CI ("Authentication precedence"), says an OAuth-authenticated run uses the
subscription instead of API billing (GitHub Actions, "Manage costs"), and says `--bare`
never reads OAuth credentials, so the smoke does not pass `--bare` (fetched 2026-11-05).
The job installs the latest CLI, like the rest of the canary; its flags were checked
against 2.1.310. `claude --help` there does not list `--max-turns`, but a `claude -p` run
on 2.1.310 accepted `--max-turns 15` and ended at 14 turns, so the smoke passes that limit
too. It also passes `--max-budget-usd`; whether that cap binds a subscription-billed run is
not observed.

The result is recorded here per release, from a run dispatched before that release.

| Release | CLI | Result | Run |
| --- | --- | --- | --- |
| 0.6.0 | 2.1.318 | pass | `canary` run 41937372415 |

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
| The `frontend` plugin in the docs | `docs/architecture.md`, `docs/installation.md`, `docs/browser-verification.md`, `docs/feature-lifecycle.md` and `docs/README.md`; "Adding a framework", and `frontend:verifying-ui` in "Bodies and references", in `docs/contributing/authoring.md`; "The behaviour smoke" on this page | `docs/` documents every pack of the marketplace, `frontend` included, where `core` hands over to it, and the plugins worth installing beside it | Never: `docs/` covers every pack |
| Handoffs to the `frontend` plugin | `project.md` `## Frontend rules` and the "frontend rules" and `Frontend:` lines of the lifecycle skills, `dispatch.md`, `formats.md` and both agents; the calls to `frontend:verifying-ui` in `clarifying-features`, `testing-changes`, `fixing-bugs` and `loop.md`, and the routing line in `reviewing-changes`; the sentence "frontend plugin not enabled in this session"; the `web:` check types of `testing-changes` and `qa-test-list.md`, and the browser in a QA finding's Environment line; the `core` README's opening | `core` hands framework rules and web checks to the `frontend` plugin by name, and says so when that plugin is not enabled | `core` stops naming the `frontend` plugin ([ADR 0015](../adr/0015-one-frontend-plugin.md)) |
| UI repro rows | `fixing-bugs` `loop.md` "Repro by kind of bug" (component, store, route, layout rows), the component and store examples of "A correct seam", and section 5's "layout, focus, hydration, a real browser API" | Domain-neutral rows lead; the UI rows serve the UI repositories `core` still serves | The web knowledge leaves `core` ([ADR 0015](../adr/0015-one-frontend-plugin.md)) |
| JavaScript lockfile facts | `syncing-branches` `conflicts.md`: the four JavaScript rows of the lockfile table; the JavaScript lockfile examples in `project.md`, `preparing-a-repo` and `docs/installation.md` | Each row is a verified fact about one tool's lockfile; a lockfile the table does not list is never merged by hand, and a new tool gets its own row | Never: the table grows a row per verified tool |
| User and report vocabulary | `investigating-bugs`: the description's "is this a frontend or backend bug", "browser, native build" among where a report appears, and a screenshot among what a report holds | It is the user's wording and a report's environment, not a claim about the repository | The listing is measured again with the `frontend` plugin ([ADR 0015](../adr/0015-one-frontend-plugin.md)) |
| The marketplace name and the 0.5.x pack names | `frontend-devkit` in the docs, the manifests and each pack README's install line; `vue` and `nuxt` in "Upgrading from 0.5.x" of `docs/installation.md` and as the keys of `renames` in `marketplace.json`; `vuejs-ai/skills` credited in the evals README; the `renames` observations in "Decisions in, evidence out" of `docs/contributing/authoring.md` | The marketplace keeps its name; an install from 0.5.x still names the old packs, and `renames` maps them to `frontend` | The name, by a rename decision; the old pack names, when the upgrade from 0.5.x is no longer supported; the credit, never |
| Observed tool and server names | `docs/contributing/authoring.md`: `figma`, `chrome-devtools`, browser MCP observations, and the `verifying-ui` grants in "Tool grants" built on them | Each records a behaviour observed against a named server and CLI version | The component that cites it moves or is removed |
| Design material in clarifying and planning | `clarifying-features`: the description's "build this screen", the bounded-size examples, `sources.md`'s design source and research question 2, `question-rounds.md`'s State row; the Design field in `artifacts.md` and `planning-features` | A UI feature's design is a requirement source while `core` plans UI work, and it is skipped for a change with no UI | The `frontend` plugin settles whether design material moves with it ([ADR 0015](../adr/0015-one-frontend-plugin.md)) |
| Boundary-version examples | "stable since Vue 3.2" in "Decisions in, evidence out" of `docs/contributing/authoring.md` | It illustrates a version boundary the project decides, the one kind of version shipped text keeps | Never: the example illustrates the rule |
| Code-unit words | "component" beside a helper and a shared module in `designing-architecture` | One kind of unit among others, named by the repository's own word | Never |
| The devkit's and Claude Code's own terms | "component" for a skill or an agent in `docs/`, `preparing-a-repo` and `testing-changes`; "API key" and a server's URL in `docs/installation.md` | They name the devkit's and the CLI's own parts, not the repository's domain | Never |
| Decision records | `docs/adr/` | A record states the context it was decided in, and an accepted record is not rewritten | Never: a later record amends it |
| Eval fixtures | `plugins/*/evals/` | Fixture content is a test's input, not shipped behaviour | The case is retired |
