# frontend-devkit

A private Claude Code marketplace: a framework-agnostic `core` plugin plus per-framework
packs. Install it once and it applies to every repository you open.

The devkit runs on top of an existing project. It requires nothing to be added to a repo
and writes nothing into one. Every fact it needs — package manager, quality gates, base
branch, git host, commit convention — is read at the moment of use from a file the project
already maintains: `package.json`, the lockfile, the git remote, `commitlint.config.*`,
`.gitlab/merge_request_templates/`. Nothing is cached, so nothing goes stale.

The one exception is the `preparing-a-repo` skill, whose purpose is to add those files. It
reports before it writes and writes nothing without approval.

## Install

Add to `~/.claude/settings.json`:

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
    "vue@frontend-devkit": true
  }
}
```

Then run `/reload-plugins`.

Set `autoUpdate`. Auto-update is off by default for third-party marketplaces, so without
it a push reaches nobody until someone runs `/plugin update`.

Enabling `vue` installs and enables `core` with it: `dependencies` is enforced, not
advisory. `claude plugin disable core@frontend-devkit` is refused while `vue` is enabled,
and `--plugin-dir ./plugins/vue` alone leaves the plugin disabled with an unsatisfied
dependency — pass both directories.

## Plugins

| Plugin | Contents |
| --- | --- |
| `core` | `reviewer` agent · `investigating-bugs` · `planning-features` · `describing-changes` · `optimizing-prompts` · `preparing-a-repo` · 3 hooks · 3 scripts |
| `vue` | `vue-engineering` (+ 8 reference files, including a review checklist and a version-gate table) |

Always-on cost is about 1.5k tokens (`core` ~1,300, `vue` ~260). Skill bodies load on
trigger; reference files load only when the body points at them.

`vue` covers plain Vue on Vite. Nuxt is out of scope: roughly half the guidance inverts
between the two — module-scope reactive state is an ordinary singleton in a client-only
SPA and a cross-request leak under SSR — so Nuxt needs its own pack rather than shared
guidance that hedges.

## Scripts

**`project-facts.mjs`** describes a project from its own files: package manager (the
Corepack field, else the lockfile), gates (`package.json` scripts, with aliases resolved —
`typecheck`, `type-check` and `test:unit` all occur in the wild), base branch
(`origin/HEAD`), git host (the remote plus `.gitlab/` markers, so a self-hosted GitLab is
recognised), commit convention (points at the commitlint config rather than paraphrasing
it) and merge-request templates.

Gates are reported as `declared`. A script name existing says nothing about whether its
binary resolves, so `available` stays `null` until something runs it.

**`run-gates.mjs`** runs those gates and separates three outcomes:

| Status | Means |
| --- | --- |
| `pass` | ran, clean |
| `fail` | ran, found a defect **in the code** |
| `not-run` + `blocking: true` | could not run — a defect **in the setup** |

Classification reads the exit code and the captured output, not `proc.error`: under
`shell: true` a missing binary returns `{ status: 127, error: null }`, because the shell
itself started fine. Probing `node_modules/.bin` is not a workaround — in a pnpm workspace
a binary such as `vue-tsc` lives in the workspace package and never at the root, so a root
probe reports every workspace binary missing.

Stages: `fast` (typecheck, lint) · `full` (+ test) · `release` (+ build). `build` is
outside the review path because on a gate-poor repo it is often the only gate present, and
a review that runs a production build verifies nothing about the diff. Every gate has a
timeout, and a script that starts a watcher is refused rather than left to hang.

## Hooks

| Hook | Event | Guarantee |
| --- | --- | --- |
| `block-secrets.mjs` | PreToolUse | Exit 2 on credential material, regardless of permission mode. Covers **file tools and `Bash`** — a `deny` rule does nothing about reading a dotenv file in a shell. Blocks exfiltration (upload flags, piping into a network client), interpreter one-liners, `source`, environment dumps and a download piped into a shell. Refuses hand-edits to lockfiles and `.git/`. Exempts `.example` / `.sample` / `.template` |
| `format-on-write.mjs` | PostToolUse | Formats what was just written with the project's own formatter, located by walking up from the file so workspace installs are found. Never blocks — the edit has already happened, and PostToolUse cannot block |
| `verify-before-done.mjs` | Stop | Runs the `fast` gates before the turn can end and returns the real failure output. Silent when the repo has no gates, when nothing has changed, or when `verifyOnStop: false`. Honours `stop_hook_active` so it cannot loop |

All three are Node, not bash. Bash exits `2` on a syntax error, and `2` is also the hook
protocol's "block", so a shell hook with a syntax error blocks every tool call — including
the edit that would repair it. Node exits `1` on a `SyntaxError`, a non-blocking error, so
a broken Node hook fails open while a deliberate `exit 2` still blocks. Fail closed on a
policy decision; fail open on a broken interpreter.

Two coverage holes no matcher can close: an `@file` reference in a prompt inserts file
contents with no tool call at all, and a file written by Bash never fires a PostToolUse
hook. Close the first with a `Read(...)` deny rule in project settings.

There is no SessionStart hook. Writing a capabilities file into a host repo dirties
`git status` wherever `.claude/` is committed, and detection at the moment of use is
fresher than anything cached at session start.

## Optional per-project override

`.claude/project.json` is honoured when a project has one, purely to correct what detection
gets wrong. It is never required.

```json
{ "gates": { "test": "pnpm test:ci" }, "baseBranch": "develop", "verifyOnStop": false }
```

`gates.format` accepts only known formatters. The value is a string from a checked-out file
handed to a subprocess, and the allowlist is what keeps it a convenience rather than an
execution primitive.

## Install rather than author

From `claude-plugins-official`:

- **`typescript-lsp`** — real diagnostics and go-to-definition; the strongest defence
  against inventing helpers that do not exist. Requires
  `npm i -g typescript-language-server typescript`; the plugin does not install the binary,
  and without it the plugin loads and does nothing. There is no Vue language server, and
  Claude Code's LSP client cannot drive `@vue/language-server` 3.x, so `vue-tsc --noEmit`
  as a gate is the answer for templates.
- **`skill-creator`** — writes, improves and evaluates skills; bundles grader, analyzer and
  comparator agents.
- **`plugin-dev`** — seven skills covering hooks, MCP, commands, agents and plugin
  structure.
- **`claude-code-setup`** — analyses a codebase and recommends automations.
- **`claude-md-management`** — audits CLAUDE.md quality.
- **`frontend-design`**, **`modern-web-guidance`**, **`security-guidance`**.

`commit-commands` and `pr-review-toolkit` are a poor fit: both are built around GitHub pull
requests and `gh`, neither covers GitLab merge requests, and both compete with
`describing-changes` for the same trigger phrases. The official `gitlab` plugin points at
`https://gitlab.com/api/v4/mcp` and does not serve a self-hosted instance; there, `glab`
with `GITLAB_HOST` is the path.

Among bundled skills: `/code-review` and `/verify` exist but Claude does not invoke them on
its own — type them. `/debug` toggles session debug logging and is not a debugging
assistant. `/simplify` and `/security-review` also ship.

## No build step, no dependencies

Clone it and everything runs with Node and the `claude` CLI. No `package.json`, no
`node_modules`, no install.

Scripts are `.mjs` with JSDoc types — readable, and ready for `tsc --noEmit` if the logic
ever grows enough to justify a toolchain. They are not TypeScript because plugins are
copied into `~/.claude/plugins/cache` and executed directly: there is no build step at
install and no guaranteed TS runtime on a consumer's machine.

A `package.json` in a plugin root does not by itself trigger a dependency install; that also
requires a lockfile, and `yarn.lock` and `pnpm-lock.yaml` are skipped. If a toolchain ever
becomes necessary, `tsconfig.json` belongs at the repo root, never inside a plugin.

## Authoring conventions

**Skill by default, agent by exception.** An agent earns its place with verbose output that
would pollute the main context, or a tool restriction that must hold structurally. Skills
support `context: fork`, so isolation alone does not justify one. Plugin `agents/` also rank
lowest in discovery precedence, so a same-named agent in a consuming repo shadows one
shipped here.

**Every component ships a written "what this must not do."**

**Prefer deleting a component to adding one.** If Claude delegates to the wrong component,
there are too many — prune before adding.

**Bodies under ~200 lines, front-loaded.** After compaction an invoked skill body is
re-attached truncated to its first 5,000 tokens, so the important part goes at the top.
Detail belongs in `references/` — the Agent Skills spec directory, alongside `scripts/` and
`assets/` — exactly one level deep, because Claude partial-reads anything reached through a
second hop.

**Descriptions are the entire triggering mechanism**, and the cap to author against is
**1,024 characters**: the spec's hard validation limit and the only portable ceiling.
(Claude Code truncates its listing at 1,536, counting `description` plus `when_to_use`
together, but a description over 1,024 cannot be packaged.) Write them in the third person,
front-loaded, using the literal words a user would type. Claude undertriggers, so lean
pushy.

**A skill's `name` must match its parent directory**, per the spec.

## Working on the devkit

```bash
claude plugin validate . --strict               # marketplace + entries
claude plugin validate ./plugins/core --strict  # frontmatter, hooks.json
bash scripts/test-hooks.sh                      # 84 assertions on the guarantees
node plugins/core/scripts/project-facts.mjs     # what detection sees here
claude plugin details core@frontend-devkit      # inventory + token cost
```

`--strict` turns an unrecognised field into an error, which is the only way to catch a typo
such as `mcpServer` for `mcpServers` — Claude Code ignores unknown fields at load time, so
without it the component silently never loads. It also treats the absent `version` as an
error, so it exits 1 here even when everything is correct; CI runs it and allows exactly
that one finding.

In `scripts/test-hooks.sh` the parse check runs before any behavioural assertion. A script
with a syntax error and a script that deliberately blocks are indistinguishable by exit
code, so without that ordering every result below it is unreadable.

`version` is omitted from every manifest, so version resolution falls through to the git
commit SHA — the documented mode for internal plugins under active development. The version
string is the update cache key, so a static `"1.0.0"` that nobody bumps would pin every
install indefinitely. `claude plugin validate` warns about the omission; that warning is the
intended state.
