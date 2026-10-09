# 0011. Every platform is supported, and platform claims are observed

Status: Accepted

## Context

The devkit is used on Linux, Windows and macOS. Much of what it relies on is platform
behaviour no documentation fully covers: which frontmatter fields Claude Code reads, how
`disallowed-tools` removes a tool, where the listing truncates a description, how a shell
reports a missing binary. That behaviour changes between CLI versions.

A pinned CLI in CI drifts from what users run. A claim copied from a changelog may describe
something other than what the installed CLI does.

## Decision

- The shipped plugins and the development tooling run on Linux, Windows and macOS, and CI
  runs on all three.
- CI installs the latest Claude Code CLI rather than a pinned one. When the validator's
  output changes, `/cli-upgrade-check` is the step to take.
- A claim about CLI, validator or MCP behaviour records the version, and where it matters
  the OS, it was observed on. It is replaced only by another observation, never by a
  reading of a changelog.
- A gate is reported as `declared` until something runs it, and an unrun gate as NOT RUN.

## Consequences

- A CLI release can turn CI red with no change in the repository; that is the signal to
  re-observe.
- Observed-on versions age, and `/cli-upgrade-check` and `/windows-check` exist to renew
  them.
- Some behaviour stays unobserved on some platforms, and the documentation says so rather
  than implying it.
