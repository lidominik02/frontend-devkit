# frontend-devkit

A Claude Code marketplace for frontend work: a framework-agnostic `core` plugin plus
per-framework packs. Install it once and it applies to every repository you open.

It runs on top of an existing project and requires nothing to be added to it. Every fact it
needs — package manager, quality gates, base branch, git host, commit convention — is read
at the moment of use from files the project already maintains, so nothing goes stale.

## What it does

- **A feature lifecycle** — clarify what to build, plan it task by task, implement it,
  review it automatically, run a QA list on request, and close it out — with its state in
  files, so any session can pick it up.
- **Bugs** — diagnose a bug to its root cause and owning layer without touching code, then
  fix it with a regression test that is red before the fix and green after.
- **Branch syncing** — rebase a branch onto main or across stacked branches behind a backup
  ref, keeping both sides' intent in every conflict.
- **Review** — independent reviewers and a verification pass over everything the branch
  changed, against the spec and the repository's own rules.
- **Commit and merge request text** in the repository's own convention.
- **Browser verification** — check a UI change in a real browser instead of asserting it
  works.
- **Framework knowledge** for Vue 3 on Vite and for Nuxt, checked against the installed
  versions.
- **Guard hooks** that block credential reads and exfiltration through file tools and
  shell commands, commit messages naming a private artifact, and the git push and merge
  forms they can parse; that format what was written; and that stop a turn ending on
  failing gates. What they do not cover is listed in [Hooks](docs/hooks.md).

## Packs

| Pack | For | Depends on |
| --- | --- | --- |
| [`core`](plugins/core/README.md) | Every repository: lifecycle, bugs, review, hooks | — |
| [`vue`](plugins/vue/README.md) | Vue 3 single-page apps on Vite | `core` |
| [`nuxt`](plugins/nuxt/README.md) | Server-rendered Nuxt apps; a delta on `vue` | `core`, `vue` |

Enable only the packs whose frameworks you use.

## Install

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

Then run `/reload-plugins`. The plugins need Node 22 or later as `node` on the `PATH`.
After a release, check with `claude plugin list` that every pack reports the new version.
More, including updating and the plugins worth installing alongside:
[Installation](docs/installation.md).

## Quick start

Most skills fire on ordinary wording; every skill also answers to `/<plugin>:<skill-name>`.

| Say | What runs |
| --- | --- |
| `/core:clarifying-features`, "new feature", a pasted user story | The feature lifecycle |
| "review my changes", "is this safe to merge" | `reviewing-changes` |
| "investigate this bug", "find the root cause" | `investigating-bugs` |
| "write the commit message", "MR description" | `describing-changes` |
| `/core:preparing-a-repo` | An audit of what the repository lacks |

Every skill, and what it answers to, is listed in the [`core` README](plugins/core/README.md).

## What it writes to your repository

- Lifecycle artifacts under `temp/` — never `git add`ed, and you are told once when `temp/`
  is not ignored.
- Code, only after you approved a plan, a design or a fix.
- A commit, only with a message you accepted. You push and merge; a hook denies Claude the
  push and merge forms it can parse.
- Configuration, only through `preparing-a-repo`, and only the fixes you approved.

The browser for `verifying-ui` is an MCP server you install; the devkit detects what is
there and says plainly when there is nothing to drive.

## Documentation

| | |
| --- | --- |
| [Installation](docs/installation.md) | Install, choose packs, update, companion plugins |
| [The feature lifecycle](docs/feature-lifecycle.md) | From an idea to a commit |
| [Browser verification](docs/browser-verification.md) | UI checks, QA lists, browser MCP setup |
| [Scripts](docs/scripts.md) | What the devkit detects, and how gates run |
| [Hooks](docs/hooks.md) | What each hook blocks, and what no hook covers |
| [Architecture](docs/architecture.md) | How the parts fit, and the principles behind them |
| [Decision records](docs/adr/README.md) | Why it is built this way |

The full map, including the documentation for working on the devkit itself:
[docs/README.md](docs/README.md).

## Contributing

Work happens on the `dev` branch; `main` moves only at a release. Setup, gates and the
release process: [CONTRIBUTING.md](CONTRIBUTING.md).

## Acknowledgements

Parts of the lifecycle design draw on ideas from
[obra/superpowers](https://github.com/obra/superpowers) and
[mattpocock/skills](https://github.com/mattpocock/skills); the wording and the components
here are this repository's own.
