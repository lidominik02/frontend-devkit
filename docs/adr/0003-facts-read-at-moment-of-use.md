# 0003. Project facts are read at the moment of use

Status: Accepted. Amended 2026-10-12: the reader is the skill, not a script; the rules are
in planning-features/references/project.md (ADR 0013). Amended 2026-10-20: a gate is only a
command the project declares, read per workspace, and a manifest's target runs with the tool
that owns the file (ADR 0014).

## Context

The devkit is installed once and applies to every repository its user opens, each with its
own package manager, gates, base branch, git host and commit convention. Those facts change
while a session runs: a script is added, a branch moves.

Anything written into a host repository dirties `git status` wherever `.claude/` is
committed. A value cached at session start is stale the moment the project changes.

A skill body can run a command and inject its output, but a non-zero exit from an injected
command aborts the whole invocation.

## Decision

- Every project-specific fact is read by the skill that needs it, at the moment of use, from a file the project already maintains: `package.json`, the lockfile,
  the git remote, `commitlint.config.*`, `.gitlab/merge_request_templates/`. Nothing is
  cached.
- No pack carries a fact about an individual repository.
- There is no SessionStart hook and no UserPromptSubmit hook; context is injected only by
  the skill that needs it.
- Nothing is injected into a skill body: a non-zero exit would abort the invocation, and a
  gate fails exactly when the skill is most needed. The skill runs the project's own
  scripts and reports each gate as pass, FAIL or NOT RUN.

## Consequences

- The devkit works in a fresh repository with nothing added to it.
- A reading can be wrong; the fix is one line in `project.md`, not an override file.
- Detection runs on every use. It is cheap file reads, and it is the price of never being
  stale.
- Gates are reported as `declared` until something runs them: a script name existing says
  nothing about whether its binary resolves.
