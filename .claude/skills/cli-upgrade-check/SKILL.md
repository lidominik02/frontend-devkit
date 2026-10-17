---
name: cli-upgrade-check
description: >-
  Revalidate this marketplace's platform claims against a newer Claude Code release and
  raise the pinned CLI. The merge gate runs a pinned CLI and canary.yml runs the latest
  weekly, so use this when the canary turns red, when a new Claude Code version ships, when
  a frontmatter field may have been added or removed upstream, or when the verified-on
  versions in comments, README.md, CONTRIBUTING.md and docs/ have fallen behind.
  Runs the strict validation on the pinned and the latest CLI, probes the frontmatter
  claim on a scratch fixture, and raises both pins and the verified-on notes in one pass.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(node scripts/validate.mjs:*), PowerShell(node scripts/validate.mjs:*), Bash(claude --version), PowerShell(claude --version), Bash(claude plugin validate:*), PowerShell(claude plugin validate:*), Bash(npm view *), PowerShell(npm view *), Bash(git log *), PowerShell(git log *), Bash(git diff *), PowerShell(git diff *)
---

# Check this marketplace against a newer CLI

The merge gate pins one CLI: `.github/workflows/validate.yml` and
`.github/workflows/release.yml` each install `@anthropic-ai/claude-code@<pin>`, so a red build
there means the commit changed something. `.github/workflows/canary.yml` runs the same
validation on the latest release every week; a red canary means upstream moved. That red run
is the signal to run this skill: find the upstream change, re-verify the claims that depend on
it, and raise the pin.

The comments recording *which version a behaviour was verified against* drift independently
of any build, so check them even when the canary is green.

## What is actually load-bearing

1. **The clean strict exit.** The gate runs `claude plugin validate --strict` and reads only
   its exit code; on 2.1.301 a warning exits 1. A release that adds a new finding turns the
   canary red on a commit that changed nothing.
2. **The claim that `--strict` does not read component frontmatter, and the allowlists it
   justifies.** `scripts/validate.mjs` owns `KNOWN_SKILL`, `KNOWN_AGENT` and
   `IGNORED_IN_PLUGIN_AGENT` because of it. A field added upstream is reported here as unknown
   and blocks a legitimate edit; a field removed upstream is silently accepted and does
   nothing; a release that starts validating frontmatter makes the comments asserting
   otherwise false.

## Method

1. **Strict validation on both CLIs.** `claude --version` for what is installed,
   `npm view @anthropic-ai/claude-code version` for the latest, and the pin in the two
   workflows. On the pinned and on the latest CLI, run `claude plugin validate . --strict` and
   the same on `plugins/core`, `plugins/vue` and `plugins/nuxt` (every directory
   `marketplace.json` lists). Record each exit code and the finding text. If the canary failed,
   reproduce its output locally before explaining it.

2. **Probe the frontmatter claim on a scratch fixture.** Outside the repository, write a
   minimal plugin: a `.claude-plugin/plugin.json` with `name` and `version`, and a
   `skills/x/SKILL.md` whose frontmatter carries a misspelled field such as
   `disable-model-invokation: true`. Run `claude plugin validate <dir> --strict` and the same on
   its `skills/` directory, and observe. Never edit a real `SKILL.md` for this. Do not infer
   the result from release notes: the comments here assert an observed behaviour and are
   replaced only by another observed behaviour. Then compare the three allowlists in
   `scripts/validate.mjs` with the fields the new version documents, additions and removals
   reported separately.

3. **Raise the pins and the verified-on notes.** Set the new version in both pin places,
   `.github/workflows/validate.yml` and `.github/workflows/release.yml`, together. Grep for
   every version number in comments, `README.md`, `CONTRIBUTING.md` and `docs/`; change a
   number only for a claim re-observed in this pass, and name the version just observed.

## Before you finish

- `node scripts/validate.mjs` and `node --test "scripts/test/*.test.mjs"` both clean.
- Explain a red canary by its upstream cause: which release, which finding or field changed,
  and what in the repo changed in response.
- Say which claims you **observed** and which you only read.
- If the new version changes nothing, say so and still raise the pins and the verified-on
  notes for the claims re-checked: "checked and unchanged at 2.1.x" is the useful record.
