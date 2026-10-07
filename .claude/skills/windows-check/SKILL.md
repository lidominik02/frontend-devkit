---
name: windows-check
description: >-
  Run the devkit's pre-release Windows check on a Windows machine: the static checks and
  the test suite with their durations, the missing-binary gate probes under cmd.exe,
  PowerShell 5.1 and 7, Yarn Berry, pnpm and Git Bash, and a real Stop hook blocking on a
  failing lint gate, reported in the chat with the OS, Node, CLI and shell versions.
disable-model-invocation: true
allowed-tools: Read, AskUserQuestion, Bash(node .claude/skills/windows-check/scripts/probes.mjs *), PowerShell(node .claude/skills/windows-check/scripts/probes.mjs *), Bash(node scripts/validate.mjs), PowerShell(node scripts/validate.mjs), Bash(node --test *), PowerShell(node --test *), Bash(node .claude/skills/try-unreleased/scripts/driver.mjs *), PowerShell(node .claude/skills/try-unreleased/scripts/driver.mjs *)
---

# Windows check

CI runs the static checks and the test suite on Windows, but never Claude Code there, and
never a real PowerShell, Yarn Berry, pnpm or Git Bash script shell. The classification of a
missing binary in `plugins/core/scripts/run-gates.mjs` is tested against synthetic text for
those; this skill observes the real text, before a release that changes `plugins/`.

It writes nothing into the repository: no report file, and no edit to README's observed-on
lines. The result is the table in the chat.

## 1. Probes

Say first that the probes start, one scratch project each, and that they can take several
minutes.

```
node .claude/skills/windows-check/scripts/probes.mjs
```

Exit 2 off Windows: say that this check runs only on Windows, name the OS, and stop.
Otherwise it prints one JSON report, which holds the versions — `os` (the `ver` build), `node`, `cli` and each
PowerShell — and one entry per probe. Each probe is a scratch project whose `lint` script
calls a binary that does not exist, run once by its package manager directly (the real
`stderr` and `exitCode`) and once by `run-gates.mjs --stage fast --json` (its
`classification` and `reason`):

- cmd.exe, through npm;
- PowerShell 5.1 and PowerShell 7 as npm's script shell (`npm_config_script_shell`);
- Yarn Berry and pnpm, each through its own `run`; Berry's project is installed first
  (`yarn install` over an empty `yarn.lock`), because Berry refuses to run a script in a
  project it has not installed;
- Git Bash as npm's script shell;
- a stdout line with no newline ahead of cmd.exe's message.

A probe whose shell or package manager is missing, or whose project cannot be set up, is
`available: false`; one whose run-gates run did not finish is classified `not-observed`.
Both are reported NOT RUN with the reason. An available probe passes when the missing binary is classified `not-run`
as not installed; anything else is a fail, reported with its real stderr verbatim, since
that text is what a fix to the classification needs. Exit 1 means at least one failed.

## 2. Static checks and tests

Say first that the static checks and the full test suite start.

```
node scripts/validate.mjs
node --test "scripts/test/*.test.mjs"
```

Report each with its result and, for the tests, the `# tests`, `# pass`, `# fail`,
`# skipped` and `# duration_ms` lines. A test skipped on Windows is listed by name, never
counted as a pass.

## 3. The Stop hook, for real

This step starts a real `claude -p` session, billed to the user's subscription quota. Ask
first with one AskUserQuestion form whose question names the model and the cost ceiling,
read from the scenario's Options (default model `sonnet`, default ceiling 2 USD), and the
billing: Run it (recommended), Skip it — reported NOT RUN. Say what started before it runs.

```
node .claude/skills/try-unreleased/scripts/driver.mjs .claude/skills/try-unreleased/scenarios/stop-hook-failing-gate.md --json
```

Run it with the Bash tool's `run_in_background` and wait for its completion notice. The
driver loads only this working tree's `core` (`--plugin-dir` with
`--setting-sources project,local`) and voids the run if the installed devkit loaded beside
it. The step passes on the driver's exit 0: the run `completed` and every expectation of the
scenario was met, the two `hook-blocked Stop` ones among them — the hook blocked, and its
reason carries the lint gate's own output. Exit 1 with status `completed` is a fail, naming
each expectation not met; any other status is a fail or NOT RUN with the driver's reason,
never a pass. A Claude Code installed through npm is a `claude.cmd` shim, which the driver
does not start without a shell: that is NOT RUN with the driver's reason, which names the
`--claude` way around it. Name the run directory it leaves.

## 4. Report

One table in the chat, one row per item — each probe, validate, the test suite, the Stop
hook — with pass, fail or NOT RUN and its detail. Above it, the versions every row was
observed on: `Claude Code <x.y.z>`, `Node <v>`, the OS build, and each PowerShell version
or NOT FOUND. Under it, each fail's stderr or reason verbatim.

## What this must not do

- Run anywhere but Windows, or report a NOT RUN item as passing.
- Write a file into the repository or edit README.md.
- Start the Stop-hook session without the user's answer to the form in step 3.
