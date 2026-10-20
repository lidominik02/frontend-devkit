# 0015. One `frontend` plugin holds framework knowledge and web verification

Status: Proposed 2026-10-14. Supersedes 0004 together with 0016; amends 0005, 0008 and 0014.

## Context

Plugins are enabled per project: `core` at user scope in every repository, frontend
knowledge only in frontend and mixed repositories. A skill inside a plugin cannot be
disabled on its own, so a web skill in `core` costs its description in every backend
repository.

The framework packs layer through `dependencies` (`nuxt` names `core` and `vue`), and
`core`'s `project.md` holds the table that calls them, so every new framework is a change
to `core`. Next.js, and possibly a React SPA, are coming.

The web QA material is split: the browser cycle lives in `verifying-ui`, while the
design-intent and Storybook checks live in `testing-changes`' references, and
`preparing-a-repo` asks Vue-specific and browser questions. Called from `testing-changes`,
which fixes nothing until the user approves, `verifying-ui` runs its own fix-and-observe
loop.

## Decision

- `core` carries no framework, no web capability and no dev server; they live in
  `frontend`.
- Two plugins: `core` and `frontend`, neither depending on the other. `vue` and `nuxt` are
  removed; `marketplace.json` renames `vue` to `frontend` and `nuxt` to `null`.
- `frontend` is enabled in frontend and mixed repositories; in a team repository at local
  scope (`.claude/settings.local.json`), so the committed settings do not change.
- `frontend` holds the framework knowledge ([0016](0016-framework-rules-chosen-per-workspace.md))
  and `verifying-ui` with the whole web QA unit: the browser tools, runtime checks, design
  intent and Storybook check. Verification is framework-agnostic.
- `verifying-ui` has three modes — browser, design intent, Storybook — and checks and skips
  each one's prerequisite on its own, with a reason. "No browser, stop" applies to the
  browser mode only.
- `core` calls two names through the Skill tool: `frontend:frontend-engineering` and
  `frontend:verifying-ui`. When they are not listed, it says once that the frontend plugin
  is not enabled in this session and skips those cases by name.
- `testing-changes` stays in `core` and hands web cases over by name. Called that way,
  `verifying-ui` reports and fixes nothing. Its QA case types stay UI-shaped until the first
  backend QA run in a mixed repository.
- Each fact has one owner: gates belong to `core`; the dev server, the Storybook command and
  the framework choice belong to `frontend`. The one deliberate duplicate is the line that
  maps a lockfile to a package manager.
- The design tool's write tools are withheld wherever design intent runs
  ([0006](0006-guardrails-enforced-where-stated.md)).

## Rationale

With per-project enablement, the saving is real: a backend repository lists no web skill.
A new framework stays a change inside `frontend`. Moving the QA unit whole keeps every mode's
path that needs no browser, and it ends the conflict between fixing and reporting.

## Alternatives considered

- Framework packs with `dependencies`, as today: does not fit per-project enablement, and
  every framework edits `core`.
- `verifying-ui` stays in `core`: `core` carries frontend content in every repository.
- `frontend` depends on `core`: only an enablement convenience, since `core` is on
  everywhere, and it pulls in the CLI's dependency machinery.
- Reading references across plugins: a path does not reach another plugin's directory.

## Consequences

- A backend repository and this one list only `core`; a frontend repository lists `core`
  and `frontend`. The listing ceiling does not change
  ([0007](0007-context-cost-tiers-and-listing-ceiling.md)).
- The release that ships it breaks installs, and it can only be fixed forward: once renamed,
  the `vue` name does not come back.
- The rename also rewrites the key in a committed `.claude/settings.json`; check
  `git status` after the update.
- A version skew between the two plugins during an update is covered by the skip by name.
- The `verifying-ui` trial ([0008](0008-verifying-ui-model-invocable-trial.md)) continues in
  `frontend`, and its case moves with it.
- The eval harness loads only the plugin under test, so an ablation of a rule set is a
  worktree copy without that set, run by hand.
- A web interface outside JavaScript (Django, Rails) is frontend work as well; extending the
  dev-server rule to it is deferred.

## Constraints and invariants

- `core` knows exactly two `frontend` names, both optional. `frontend` runs no gate.
- No `dependencies` between the plugins, no hook, no MCP server
  ([0005](0005-browser-mcp-not-bundled.md)), one shared version
  ([0010](0010-shared-version-and-release-branch-model.md)).

## Validation requirements

- Before the release: `renames` passes `claude plugin validate --strict` on the pinned CLI
  and on the local one, with the versions recorded. If the pinned CLI rejects it,
  `/cli-upgrade-check` raises the pin first.
- Before the release: the update is observed on a real install. Either the rename rewrites
  the enabled key, or the documented fallback steps work.
- Before the release: the existing cases do not regress, and a delegation case passes both
  with and without `frontend`, with the Storybook check run statically and no browser.
- Once: at local scope, `claude plugin list` shows `frontend` active only in that
  repository.

## References

[0004](0004-framework-packs-layer-as-deltas.md), [0005](0005-browser-mcp-not-bundled.md),
[0006](0006-guardrails-enforced-where-stated.md),
[0008](0008-verifying-ui-model-invocable-trial.md),
[0010](0010-shared-version-and-release-branch-model.md),
[0014](0014-core-is-domain-neutral.md),
[0016](0016-framework-rules-chosen-per-workspace.md),
[Installation](../installation.md#choosing-packs).
