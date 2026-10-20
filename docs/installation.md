# Installation

The devkit is a Claude Code marketplace. Install it once and it applies to every repository
you open.

## Install

From your shell, install the pack your repository needs:

```
claude plugin install nuxt --marketplace lidominik02/frontend-devkit
```

The first time, the command adds the marketplace; then it installs the pack at user scope
with every pack it depends on: `nuxt` brings `vue` and `core`, `vue` brings `core`, and
`core` alone suits a repository with no framework pack. Run it again with another pack name
to add one; the marketplace is reused. In a session that is already open, run
`/reload-plugins`; inside a session, `/plugin install nuxt --marketplace
lidominik02/frontend-devkit` does the same and asks for the scope.

Then turn auto-update on, because a marketplace added this way has it off: run `/plugin`,
open the **Marketplaces** tab, select `frontend-devkit` and choose **Enable auto-update**.
Without it a release reaches no one ([Updating](#updating)).

## Permissions and attribution

The devkit ships no hook, and a plugin cannot install permission rules (docs, read
2026-10-12), so without these settings nothing stops a credential read or a push. Add them
to your user settings, `~/.claude/settings.json` (on Windows,
`%USERPROFILE%\.claude\settings.json`):

```json
{
  "attribution": { "commit": "", "pr": "", "sessionUrl": false },
  "permissions": {
    "deny": [
      "Read(.env)", "Read(.env.*)", "Read(!.env.example)",
      "Read(~/.ssh/**)", "Read(~/.aws/**)", "Read(~/.gnupg/**)",
      "Edit(package-lock.json)", "Edit(pnpm-lock.yaml)", "Edit(yarn.lock)", "Edit(bun.lock)", "Edit(bun.lockb)",
      "Edit(go.sum)", "Edit(Gemfile.lock)", "Edit(Cargo.lock)", "Edit(poetry.lock)", "Edit(uv.lock)", "Edit(composer.lock)",
      "Edit(.git/**)",
      "Bash(git push:*)", "Bash(git pull:*)", "Bash(git merge:*)", "Bash(git commit-tree:*)",
      "Bash(gh pr merge:*)", "Bash(glab mr merge:*)",
      "PowerShell(git push:*)", "PowerShell(git pull:*)", "PowerShell(git merge:*)", "PowerShell(git commit-tree:*)",
      "PowerShell(gh pr merge:*)", "PowerShell(glab mr merge:*)"
    ]
  }
}
```

The lockfile lines are one `Edit` rule per lockfile your repositories keep: drop the ones you
never use, and add any other your tools write.

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

Install only the packs whose frameworks you actually use: a plain-Vue repo pays nothing for
`nuxt`, and installing `nuxt` alone is what a Nuxt repo wants, since it brings `vue` and
`core` with it.

Enabling `vue` installs and enables `core` with it — `dependencies` is enforced, not
advisory. `claude plugin disable core@frontend-devkit` is refused while `vue` is enabled.
`nuxt` declares `core` **and** `vue` directly; see
[ADR 0004](adr/0004-framework-packs-layer-as-deltas.md).

## Model and effort of the workers

`core` dispatches three kinds of worker — code research, the task implementer and the
reviewer — and each kind's model and effort stand in one place: the **Model and effort** line
of its dispatch template (`clarifying-features/references/sources.md`,
`executing-plans/references/dispatch.md`, `reviewing-changes/references/formats.md`). A line
names a cheaper model only with a measured pair behind it, which the line itself states;
anything unmeasured runs on your session's model. `describing-changes` also sets
`effort: low` in its own frontmatter, on the same terms. Your main session's model and effort
are never set by the devkit.

**Minimum CLI.** A dispatch that names an `effort` needs Claude Code 2.1.292 or later; the
defaults were measured on 2.1.299. On an older CLI the reviewer's `effort: low` is not
observed — read 2026-10-15 from the sub-agents page, not run.

**Overriding them.** Everything here is your own setting; the devkit ships no switch for it.
Claude Code resolves a worker's model in this order (sub-agents page, read 2026-10-15): the
model the dispatch names, then the agent's frontmatter `model`, then
`CLAUDE_CODE_SUBAGENT_MODEL`, then your session's model.

- `CLAUDE_CODE_SUBAGENT_MODEL=<model>` fills in only where nothing earlier names a model. On
  its own it does not change the built-in `Explore` and `Plan` agents.
- `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` (2.1.257 or later), with the variable above, overrides
  the dispatch and frontmatter models too: every worker runs on the model you name.
- `CLAUDE_CODE_EFFORT_LEVEL=<level>` wins over both the dispatch's `effort` and a skill's or
  agent's frontmatter `effort`.
- An `Explore` agent of your own, in `~/.claude/agents/` or the project's `.claude/agents/`,
  replaces the built-in one the research dispatch uses. Its `model` applies only where the
  dispatch names none — the research dispatch names one, so change that model with the
  variables above.

To see what the workers cost, `/usage` breaks spending down by skill, subagent and plugin
under **Attribution** (2.1.222 or later; its figures are approximate).

**The prompt cache.** `describing-changes`' `effort: low` replaces the session effort while
the skill runs. On Opus, Sonnet and Haiku 5.5 and Fable 5.1, with an API key or a Claude
subscription, changing effort keeps the cache intact; on Bedrock, Google Cloud, an LLM
gateway, with `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS`, or under HIPAA it does not (prompt
caching page, read 2026-10-15).

**No profile option.** A plugin `userConfig` choice between a cheaper and a stronger profile
was tried and left out: an option's `default` is not substituted into skill text until a value
is saved, so a profile would arrive unset for anyone who installed without the dialog
(observed on 2.1.299 and 2.1.301).

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

Turn auto-update on ([Install](#install)). It is off by default for third-party
marketplaces, so without it a release reaches nobody until someone runs `/plugin update`. A session installs the
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
- On 2.1.292 on Windows 10, from 0.1.2 to 0.2.0 on 2026-10-12,
  `claude plugin marketplace update frontend-devkit` followed by
  `claude plugin update <pack>@frontend-devkit` for each pack moved all three packs to the
  release together. The running session kept running the previous version's hooks until
  it was restarted.

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
