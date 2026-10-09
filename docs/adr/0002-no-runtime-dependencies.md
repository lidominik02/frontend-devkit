# 0002. No runtime dependencies and no build step

Status: Accepted

## Context

A plugin is copied into `~/.claude/plugins/cache` (on Windows
`%USERPROFILE%\.claude\plugins\cache`) and executed directly. There is no build step at
install time and no guaranteed TypeScript runtime on a consumer's machine.

A `package.json` in a plugin root does not by itself trigger a dependency install; that
also requires a lockfile, and `yarn.lock` and `pnpm-lock.yaml` are skipped. A dependency a
plugin relies on may therefore be missing at run time with nothing reporting it.

## Decision

- The devkit needs Node and the `claude` CLI alone. No `package.json`, no lockfile, no
  npm package, no `node_modules`.
- Scripts are `.mjs` with JSDoc types: readable, and ready for `tsc --noEmit` if the logic
  ever grows enough to justify a toolchain.
- If a toolchain ever becomes necessary, `tsconfig.json` belongs at the repository root,
  never inside a plugin.

## Consequences

- Cloning the repository is the whole setup; every script runs as it is.
- Anything a dependency would provide is written by hand, which keeps the scripts small and
  their behaviour testable by exit code.
- Typing is checked by convention and review, not by a compiler.
