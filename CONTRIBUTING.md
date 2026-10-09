# Working on the devkit

How to change, check and release this marketplace. The rules every change must hold are in
[`CLAUDE.md`](CLAUDE.md); the reasoning behind them is in the
[decision records](docs/adr/README.md).

## Requirements

Node and the `claude` CLI, nothing else: no `package.json`, no `node_modules`, no install
step ([ADR 0002](docs/adr/0002-no-runtime-dependencies.md)). The development tooling needs
Node 22.18, or 24.2 on the 24 line — higher than the Node 22 the shipped plugins need. On an
older Node, `validate.mjs` and `pack-graph.mjs` print the version they need and exit 1, so
the `Stop` hook fails rather than passing silently.

## Branches

Work happens on the `dev` branch, pushed freely. `main` moves only at a release, because a
session installs `main` ([ADR 0010](docs/adr/0010-shared-version-and-release-branch-model.md)).

## Gates

```bash
node scripts/validate.mjs                       # the static checks CI runs
node --test "scripts/test/*.test.mjs"           # the tests on the guarantees
node scripts/pack-graph.mjs                     # pack layering, derived from the manifests
claude plugin validate . --strict               # marketplace + entries
claude plugin validate ./plugins/core --strict  # manifest fields, hooks.json
claude plugin validate ./plugins/nuxt --strict  # and ./plugins/vue
node plugins/core/scripts/project-facts.mjs     # what detection sees here
claude plugin details core@frontend-devkit      # inventory + token cost
```

The first two are the gate; run both before pushing. What each static check catches, and
the keys of `devkit.config.json` the checks read, are in
[Validation](docs/contributing/validation.md).

**`pack-graph.mjs`** derives the layering from the manifests rather than restating it. A
pack's non-`core` dependency is its base, and that pair is what the delta contract
governs; `core` is the framework-agnostic floor and forms no family. It reports each
family's paired reference topics and the ones present on only one side, so adding a pack
later needs no edit to `/pack-parity` — the relationship is read, not written down.

## The repository's own tooling

Everything under `.claude/` is tooling for working **on** this marketplace. It is not
shipped to consumers, is not part of any pack, and costs a consuming repository nothing.
Each tool is listed with one line in [`CLAUDE.md`](CLAUDE.md#repo-local-tooling); its own
file is its full description.

### Which tool when

| Situation | Run |
| --- | --- |
| You changed a skill, an agent or a reference under `plugins/` | [`component-reviewer`](.claude/agents/component-reviewer.md) |
| You wrote or reworded a description | [`trigger-tester`](.claude/agents/trigger-tester.md) |
| A body grew, or the always-on cost came up | [`/body-vs-reference-audit`](.claude/skills/body-vs-reference-audit/SKILL.md) |
| You changed either side of a pack family (`vue`, `nuxt`) | [`/pack-parity`](.claude/skills/pack-parity/SKILL.md) |
| You changed an artifact shape — a ledger entry, brief field, HANDOFF section or script output | [`contract-auditor`](.claude/agents/contract-auditor.md) |
| You are adding support for a new framework | [`/new-pack`](.claude/skills/new-pack/SKILL.md) |
| You are adding or changing an eval case | [`/eval-case`](.claude/skills/eval-case/SKILL.md), then [`eval-grader`](.claude/agents/eval-grader.md) on its criteria |
| You want to see an unreleased change work end to end | [`/try-unreleased`](.claude/skills/try-unreleased/SKILL.md) — a real `claude -p` run, billed to your quota |
| You want to know why past sessions went wrong | [`/diagnosing-sessions`](.claude/skills/diagnosing-sessions/SKILL.md) |
| A Claude Code release shipped, or CI turned red with no change | [`/cli-upgrade-check`](.claude/skills/cli-upgrade-check/SKILL.md) |
| A release that changes `plugins/` is coming, on Windows | [`/windows-check`](.claude/skills/windows-check/SKILL.md) |
| The work is ready to release | [`/release`](.claude/skills/release/SKILL.md) |

### The repository's hooks

`.claude/settings.json` runs three hooks without being asked. All three are Node for the
reason the shipped hooks are ([ADR 0001](docs/adr/0001-node-hooks-with-version-gate.md)).

| Hook | Event | Speaks when |
| --- | --- | --- |
| `scripts/hooks/frontmatter-on-write.mjs` | PostToolUse on a write | The component just written — a pack's, or one under `.claude/skills/` or `.claude/agents/` — fails the frontmatter rules |
| `scripts/hooks/budget-on-write.mjs` | PostToolUse on a write | After a component or `devkit.config.json` write, the always-on total is over its ceiling, the ceiling is unusable, or no pack could be read |
| `scripts/hooks/on-stop.mjs` | Stop | A path under `stopHook.watch` or `docs.roots` changed and `validate.mjs` fails, a path under `stopHook.testWatch` changed and the test suite fails, or either watch list is unusable |

`.mcp.json` declares a browser MCP server so `verifying-ui`'s eval can actually run its
browser arm here; without it that half of the case is untestable in this checkout.

## Trying an unreleased change

A live trial loads the working tree for one session with `--plugin-dir`, once for each pack
it needs (the flag is repeatable, per `claude --help` on 2.1.283):

```bash
claude --plugin-dir <working tree>/plugins/core --plugin-dir <working tree>/plugins/vue
```

`--plugin-dir ./plugins/vue` on its own leaves the plugin disabled with an unsatisfied
dependency; pass both directories. No installed source serves the working tree, so the
trial reaches no other session.

That session runs each hook from the file on disk at the moment of the call: a hook caught
mid-edit can fail to parse, and a Node hook that throws exits 1 and fails open, so the
trial runs without the guarantee it is meant to exercise. Leave the hooks unedited while it
runs.

For a scripted trial instead — a non-interactive session in a scratch repository, its forms
answered from a scenario and its outcome checked against the scenario's expectations — run
`/try-unreleased`.

## Tests

A test that launches a script does so through `runScript` in `scripts/test/helpers.mjs`
where it can, which runs `node --check` on the script first and fails with a syntax error
of its own. A script with a syntax error and a script that deliberately blocks can share an
exit code, so without that check a broken script reads as a block. Tests that import a
module, or spawn `node` with flags of their own, skip that check, so
`scripts/test/parse.test.mjs` parses every `.mjs` under `plugins/`, `scripts/` and each
`.claude/skills/<skill>/scripts/` on its own — the same files `validate.mjs`'s `scripts`
check covers.

The ablation cases that decide whether a component earns its cost are in
`plugins/*/evals/`; the methodology is in
[`plugins/core/evals/README.md`](plugins/core/evals/README.md).

## Writing components

The rules for skills, agents, tool grants and descriptions are in
[Authoring](docs/contributing/authoring.md).

## Releasing

**Every pack shares one `version`, set in its `plugin.json` and nowhere else.** By the
plugins reference (read from the documentation, CLI 2.1.283), an existing install stays on
its cached copy until that string changes;
[Installation](docs/installation.md#known-update-behaviour) records observed cases where
only some packs updated. The version decides only whether an update happens: the install
source names no ref, so any install or update fetches the head of `main`.
`marketplace.json` carries no `version`: the manifest's value overrides an entry's, and
setting both draws a validator mismatch warning (same reference). The `versions` check
holds all of this.

The number stays `0.x` while the devkit has one user, starting at `0.1.0`: a minor bump for
new or changed behaviour, breaking changes included, a patch bump for fixes and wording,
and `1.0.0` when a second person installs it.

`/release` is the only thing that bumps it. It runs on `dev`, lists the commits since the
last release, proposes the level and, once approved, rewrites the version in every pack's
`plugin.json`, adds a [`CHANGELOG.md`](CHANGELOG.md) section and makes the release commit.
It never merges and creates no tag. The user then pushes in three steps:

1. `git push origin dev`, which runs CI on the release commit.
2. Only once CI is green, `git push origin dev:main`, which moves `main` to the release
   commit. `main` stays the GitHub default branch, so the install source stays
   `lidominik02/frontend-devkit` with no ref.
3. The user tags that commit (`git tag -a vX.Y.Z`) and pushes the tag, which runs the
   release workflow: it validates again and creates the GitHub Release from the CHANGELOG
   section.

A red CI leaves `main` where it is and makes no tag, and the fix is a new release. CI runs
on pushes to both branches. Commits on `dev` since the latest tag are not an error; CI
prints a warning that `plugins/` or `.claude-plugin/` holds unreleased changes.
