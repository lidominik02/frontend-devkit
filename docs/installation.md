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

## Permissions and attribution

The devkit ships no hook, and a plugin cannot install permission rules (docs, read
2026-10-12), so without these settings nothing stops a credential read or a push. Add them
to your user settings next to the marketplace:

```json
{
  "attribution": { "commit": "", "pr": "", "sessionUrl": false },
  "permissions": {
    "deny": [
      "Read(.env)", "Read(.env.*)", "Read(!.env.example)",
      "Read(~/.ssh/**)", "Read(~/.aws/**)", "Read(~/.gnupg/**)",
      "Edit(package-lock.json)", "Edit(pnpm-lock.yaml)", "Edit(yarn.lock)", "Edit(bun.lock)", "Edit(bun.lockb)",
      "Edit(.git/**)",
      "Bash(git push:*)", "Bash(git pull:*)", "Bash(git merge:*)", "Bash(git commit-tree:*)",
      "Bash(gh pr merge:*)", "Bash(glab mr merge:*)",
      "PowerShell(git push:*)", "PowerShell(git pull:*)", "PowerShell(git merge:*)", "PowerShell(git commit-tree:*)",
      "PowerShell(gh pr merge:*)", "PowerShell(glab mr merge:*)"
    ]
  }
}
```

What these rules cover, and what they do not:

- A `Read` deny applies to the file tools, Grep, Glob, `@file`, the file commands Claude Code
  recognises in Bash and Bash redirections. It does not apply to a command that does not
  name the file (`grep -r KEY .`) or to a script that opens the file itself; for those, the
  sandbox (macOS, Linux, WSL2) and the OS are the boundary (docs, read 2026-10-12).
- An `Edit(...)` rule covers `Write` too; a `Write(...)` rule is never consulted. On a CLI
  newer than 2.1.281, `attribution: false` does what the object does (docs, read 2026-10-12).
- `git -C . push` is not matched by the deny rules; the devkit's skills never write it.
- No native rule covers an upload (`curl -d @.env`), `printenv` or `curl | sh`; the sandbox
  covers the network on macOS and Linux, and nothing does on native Windows.
- **The PowerShell tool is not covered:** `Get-Content`, `gc` and `type` read `.env` despite
  the deny (observed, below). On native Windows, prefer WSL2 if credentials must stay unread.

**Observed on 2.1.292, Windows 10 Pro 10.0.19045, 2026-10-12** — `claude -p` in a throwaway
repository with this snippet passed through `--settings`, user settings and hooks left out
(`--setting-sources project`), each row checked against a run without the snippet, where
every call went through. Denied: `Read .env` (1); Grep on `.env`, and `@.env` not attached —
a Grep over the directory returns no dotenv match, `.env.example` included (3); Bash
`cat`, `head -1`, `wc -l <` and `grep KEY` on `.env` (4, 5); `Write` and `Edit` of
`package-lock.json` (7); `git push` and `npm test && git push` in Bash, `git push` in
PowerShell (8); `git pull --rebase` (10). Allowed: `Read .env.example` (2); `git merge-base`
under the merge rule (9); `snapshot.mjs take` under `Edit(.git/**)` (11). Not covered:
PowerShell `Get-Content`, `gc`, `type` on `.env` (6). A commit carried no `Co-Authored-By`
trailer, where the control added one (12).

## Choosing packs

Enable only the packs whose frameworks you actually use: a plain-Vue repo pays nothing for
`nuxt`, and enabling `nuxt` alone is what a Nuxt repo wants, since it brings `vue` with it.

Enabling `vue` installs and enables `core` with it — `dependencies` is enforced, not
advisory. `claude plugin disable core@frontend-devkit` is refused while `vue` is enabled.
`nuxt` declares `core` **and** `vue` directly; see
[ADR 0004](adr/0004-framework-packs-layer-as-deltas.md).

## Node

Node 22 or newer on `PATH`; the one shipped script, `snapshot.mjs`, needs nothing else.

## Platforms

The script and the tooling run on Linux, Windows and macOS, on the Node version above.
Windows is observed: Windows 10 Pro 10.0.19045 (build 10.0.19045.6466) with Node 22.23.3
and Claude Code 2.1.292; on 2026-10-12, after the hooks and scripts were removed,
`scripts/validate.mjs` and the test suite pass there
([Known update behaviour](#known-update-behaviour)). Linux was observed before that change:
Ubuntu 24.04.5 LTS (kernel 6.8.0) with Node 22.23.3 and Claude Code 2.1.283 on 2026-10-10. macOS is exercised by CI (`macos-latest`, Node 22), which runs the test suite on
every push to `main` and `dev` and on every pull request; it is not observed in a Claude
Code session.

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
  skill loaded from the updated `core` folder.
- On 2.1.292 on Windows 10, after `claude plugin update`, the CLI asks for a restart, but
  the next skill launch in the running session already loaded the updated pack.

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
