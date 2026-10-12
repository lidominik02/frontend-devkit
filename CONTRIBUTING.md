# Working on the devkit

How to change, check and release this marketplace. The rules every change must hold are in
[`CLAUDE.md`](CLAUDE.md); the reasoning behind them is in the
[decision records](docs/adr/README.md).

## Requirements

Node and the `claude` CLI, nothing else: no `package.json`, no `node_modules`, no install
step ([ADR 0002](docs/adr/0002-no-runtime-dependencies.md)). The development tooling needs
Node 22.18, or 24.2 on the 24 line — higher than the Node 22 the shipped plugins need. On an
older Node, `validate.mjs` prints the version it needs and exits 1 rather than passing
silently.

## Branches

Work happens on the `dev` branch, pushed freely. `main` moves only at a release, because a
session installs `main` ([ADR 0010](docs/adr/0010-shared-version-and-release-branch-model.md)).

## Gates

```bash
node scripts/validate.mjs                       # the static checks CI runs
node --test "scripts/test/*.test.mjs"           # the tests on the scripts
claude plugin validate . --strict               # marketplace + entries
claude plugin validate ./plugins/core --strict  # manifest fields
claude plugin validate ./plugins/nuxt --strict  # and ./plugins/vue
claude plugin details core@frontend-devkit      # inventory + token cost
```

The first two are the gate; run both before pushing. What each static check catches is in
[Validation](docs/contributing/validation.md).

## The repository's own tooling

Everything under `.claude/` is tooling for working **on** this marketplace. It is not
shipped to consumers, is not part of any pack, and costs a consuming repository nothing.
Each tool is listed with one line in [`CLAUDE.md`](CLAUDE.md#repo-local-tooling); its own
file is its full description.

### Which tool when

| Situation | Run |
| --- | --- |
| You changed a skill, an agent or a reference under `plugins/` | [`component-reviewer`](.claude/agents/component-reviewer.md) |
| You are adding or changing an eval case | [`eval-grader`](.claude/agents/eval-grader.md) on its criteria |
| You want to know why past sessions went wrong | [`/diagnosing-sessions`](.claude/skills/diagnosing-sessions/SKILL.md) |
| A Claude Code release shipped, or the weekly canary turned red | [`/cli-upgrade-check`](.claude/skills/cli-upgrade-check/SKILL.md) |
| The work is ready to release | [`/release`](.claude/skills/release/SKILL.md) |

## Trying an unreleased change

A live trial loads the working tree for one session with `--plugin-dir`, once for each pack
it needs (the flag is repeatable, per `claude --help` on 2.1.283):

```bash
claude --plugin-dir <working tree>/plugins/core --plugin-dir <working tree>/plugins/vue
```

`--plugin-dir ./plugins/vue` on its own leaves the plugin disabled with an unsatisfied
dependency; pass both directories. No installed source serves the working tree, so the
trial reaches no other session.

## Tests

A test that launches a script does so through `runScript` in `scripts/test/helpers.mjs`.
`validate.mjs`'s `scripts` check parses every `.mjs` under `plugins/` and `scripts/`, so a
script with a syntax error fails the gate before any behaviour test is read.

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
on pushes to both branches. Commits on `dev` since the latest tag are not an error; `/release`
checks whether anything shipped changed with `git diff --quiet <tag> HEAD -- plugins .claude-plugin`.
