# 0011. Every platform is supported, and platform claims are observed

Status: Accepted. Amended 2026-10-12: the gate runs a pinned CLI and `canary.yml` watches
the latest (ADR 0013).

## Context

The devkit is used on Linux, Windows and macOS. Much of what it relies on is platform
behaviour no documentation fully covers: which frontmatter fields Claude Code reads, how
`disallowed-tools` removes a tool, where the listing truncates a description, how a shell
reports a missing binary. That behaviour changes between CLI versions.

A pinned CLI in CI drifts from what users run, and an unpinned one turns the merge gate red
on a commit that changed nothing. A claim copied from a changelog may describe
something other than what the installed CLI does.

## Decision

- The shipped plugins and the development tooling run on Linux, Windows and macOS, and CI
  runs on all three.
- The gate runs a pinned CLI; `canary.yml` watches the latest; a red canary is the
  `/cli-upgrade-check` signal, which re-observes the claims and raises the pin.
- A claim about CLI, validator or MCP behaviour records the version, and where it matters
  the OS, it was observed on. It is replaced only by another observation, never by a
  reading of a changelog.
- A gate is reported as `declared` until something runs it, and an unrun gate as NOT RUN.

## Consequences

- A CLI release can turn the canary red with no change in the repository; that is the
  signal to re-observe.
- Observed-on versions age, and `/cli-upgrade-check` exists to renew them.
- Some behaviour stays unobserved on some platforms, and the documentation says so rather
  than implying it.
