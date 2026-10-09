# Installation

The devkit is a Claude Code marketplace. Install it once in your user settings and it
applies to every repository you open.

## Add the marketplace

Add to `~/.claude/settings.json` (on Windows, `%USERPROFILE%\.claude\settings.json`):

```json
{
  "extraKnownMarketplaces": {
    "frontend-devkit": {
      "source": { "source": "github", "repo": "lidominik02/frontend-devkit" },
      "autoUpdate": true
    }
  },
  "enabledPlugins": {
    "core@frontend-devkit": true,
    "vue@frontend-devkit": true,
    "nuxt@frontend-devkit": true
  }
}
```

Then run `/reload-plugins`.

## Choosing packs

Enable only the packs whose frameworks you actually use: a plain-Vue repo pays nothing for
`nuxt`, and enabling `nuxt` alone is what a Nuxt repo wants, since it brings `vue` with it.

Enabling `vue` installs and enables `core` with it — `dependencies` is enforced, not
advisory. `claude plugin disable core@frontend-devkit` is refused while `vue` is enabled.
`nuxt` declares `core` **and** `vue` directly; see
[ADR 0004](adr/0004-framework-packs-layer-as-deltas.md).

## Node

The plugins need Node 22 or later, as `node` on the `PATH`. Every hook starts through
`scripts/run.mjs`, which checks the version first. On an older Node the hook does not load
and a message names the version found and the fix: `block-secrets` blocks every tool call
it matches, with the message each time; the other three fail open and print it once per
session. That holds from Node 14.8, the first that parses `run.mjs`; on an older Node every
hook, `block-secrets` included, fails open without the message. Without `node` on the
`PATH` no hook runs at all, and the error the shell reports is not the devkit's.

## Updating

Set `autoUpdate`. Auto-update is off by default for third-party marketplaces, so without
it a release reaches nobody until someone runs `/plugin update`. A session installs the
`main` branch, and `main` moves only at a release.

After a release, check with `claude plugin list` that every pack reports the new version,
and run `claude plugin update <pack>@frontend-devkit` for any that does not.

### Known update behaviour

Packs do not always update together. Observed cases:

- On 2.1.283, after the marketplace entry moved from a `directory` source to the GitHub
  source, the next session updated `core` to the release while `vue` and `nuxt` kept their
  earlier commit-SHA version.
- On 2.1.292 on Windows 10, a session that was already open, with `autoUpdate` switched on
  in another window, did not pick up a release by itself within a few minutes: a skill
  still loaded from the previous version's folder, `claude plugin list` reported the
  previous version for every pack, and nothing was downloaded. Updating the marketplace
  from the `/plugin` menu then moved `core` to the release while `vue` and `nuxt` stayed
  behind, although their release was already in the cache. In that same session the next
  skill loaded from the updated `core` folder; hooks were not checked.
- On 2.1.292 on Windows 10, after `claude plugin update`, the CLI asks for a restart, but
  the next skill launch in the running session already loaded the updated pack. Whether
  hooks need the restart was not checked.

Whether a new session with `autoUpdate` on brings a release by itself has not been
observed. Other CLI versions and platforms may behave differently.

## Companion plugins

The devkit does not re-implement what an official plugin already does. From
`claude-plugins-official`:

- **`typescript-lsp`** — real diagnostics and go-to-definition; the strongest defence
  against inventing helpers that do not exist. Requires
  `npm i -g typescript-language-server typescript`; the plugin does not install the binary,
  and without it the plugin loads and does nothing. There is no Vue language server, and
  Claude Code's LSP client cannot drive `@vue/language-server` 3.x, so `vue-tsc --noEmit`
  as a gate is the answer for templates.
- **`skill-creator`** — writes, improves and evaluates skills; bundles grader, analyzer and
  comparator agents.
- **`plugin-dev`** — skills covering hooks, MCP, commands, agents and plugin structure.
- **`claude-code-setup`** — analyses a codebase and recommends automations.
- **`claude-md-management`** — audits CLAUDE.md quality.
- **`frontend-design`**, **`security-guidance`**.

`plugin-dev` and `skill-creator` are background material for authoring, not authorities:
where they differ from this repository's conventions or from observed CLI behaviour, the
repository and the observation win.

`modern-web-guidance` is left out: by default it sends the search queries the agent writes
to Google as usage telemetry, and its advice competes with the `vue` and `nuxt` packs.

`commit-commands` and `pr-review-toolkit` are a poor fit: both are built around GitHub pull
requests and `gh`, neither covers GitLab merge requests, and both compete with
`describing-changes` for the same trigger phrases. The official `gitlab` plugin points at
`https://gitlab.com/api/v4/mcp` and does not serve a self-hosted instance; there, `glab`
with `GITLAB_HOST` is the path.

Among bundled skills: `/code-review` and `/verify` exist but Claude does not invoke them on
its own — type them. `/debug` toggles session debug logging and is not a debugging
assistant. `/simplify` and `/security-review` also ship.

A browser MCP server is needed for `verifying-ui`; see
[Browser verification](browser-verification.md#installing-a-browser-mcp-server).
