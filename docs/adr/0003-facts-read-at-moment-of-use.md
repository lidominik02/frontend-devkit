# 0003. Project facts are read at the moment of use

Status: Accepted

## Context

The devkit is installed once and applies to every repository its user opens, each with its
own package manager, gates, base branch, git host and commit convention. Those facts change
while a session runs: a script is added, a branch moves.

Anything written into a host repository dirties `git status` wherever `.claude/` is
committed. A value cached at session start is stale the moment the project changes.

A skill body can run a command and inject its output, but a non-zero exit from an injected
command aborts the whole invocation.

## Decision

- Every project-specific fact is read by `plugins/core/scripts/project-facts.mjs` at the
  moment of use, from a file the project already maintains: `package.json`, the lockfile,
  the git remote, `commitlint.config.*`, `.gitlab/merge_request_templates/`. Nothing is
  cached.
- No pack carries a fact about an individual repository.
- There is no SessionStart hook and no UserPromptSubmit hook; context is injected only by
  the skill that needs it.
- Only a command that always exits 0 is injected. `project-facts.mjs` is injectable and is
  tested to exit 0 on malformed and missing input; `run-gates.mjs` is not, because it exits
  1 when a gate fails — the moment the skill is most needed.

## Consequences

- The devkit works in a fresh repository with nothing added to it.
- Detection can be wrong; `.claude/project.json` corrects it per project
  ([Scripts](../scripts.md#per-project-override)).
- Detection runs on every use. It is cheap file reads, and it is the price of never being
  stale.
- Gates are reported as `declared` until something runs them: a script name existing says
  nothing about whether its binary resolves.
