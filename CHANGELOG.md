# Changelog

Each section records one release of every pack in the marketplace, which share one
version: what it added, changed and fixed for someone using the devkit, newest first.

## 0.1.1 - 2026-10-07

### Added

- The hooks and the gate runner work on Windows as well as on macOS and Linux, with no
  bash involved.
- A gate that runs too long is stopped together with every process it started, and the
  Stop hook keeps the gates within the time it has, so nothing is left running behind it.
- When a gate fails, its last output lines appear in the result, so you can read the
  failure without running it again.

### Changed

- When implementing a plan, a gate failure is judged against the gate's result before
  the task started: a gate that passed before makes every new failure the task's, and an
  unclear case stops the run and asks you.
- Asking for a commit message runs only the fast gates unless you allow more, and every
  gate it held back is listed as NOT RUN.
- A gate whose script rewrites files, such as a lint with `--fix`, is never run; it is
  reported as not run, with a request for a check-only script.
- A Nuxt typecheck that would check nothing is not run, and the report points at
  `nuxt typecheck`.
- Below Node 22 the hooks name the version they need: the secrets check blocks, the
  others warn once per session and let the call through.

### Fixed

- A mistyped gate, stage or flag is reported as a usage error instead of quietly
  running the fast stage and passing.
- A gate that ran and failed is always reported as failed; a "not found" anywhere in
  its output no longer turns it into "not run".
- A missing tool is recognised as not installed on Windows too, including PowerShell 7's
  coloured error line.
- Project facts are read correctly when the plugin sits under a path with a space, a
  non-ASCII character or a symlink.

## 0.1.0 - 2026-10-03

The first versioned release. An install from GitHub now updates only when a new release
is published, never on an unreleased change.

### Added

- A feature lifecycle that carries work from a ticket or a design to a commit: clarify
  the requirements into a spec, plan small tasks, implement them task by task, review
  the result automatically, check it against a QA list, and close it out with a commit
  message and merge request text in the repository's own convention.
- Bug work: diagnose a bug to its root cause and the layer that owns it, then fix a
  frontend bug with a regression test that fails before the fix and passes after.
- Branch syncing: rebase your branch onto main, mid-work or across stacked branches,
  behind a backup ref, with each side's intent kept in every conflict.
- Browser verification of a UI change, and a repository-preparation skill that reports
  what a repository is missing before it changes anything.
- `/core:designing-architecture`: settle an architectural question with evidence from
  the codebase, two or three options with their cost and a recommendation, or survey
  the codebase for what is worth restructuring. It never writes code.
- Design judgement during ordinary work: reviews, planning and implementation flag an
  abstraction that does not earn its keep, or an existing mechanism being rebuilt,
  instead of acting on it.
- `vue` and `nuxt` packs with engineering and review knowledge for Vue single-page apps
  and server-rendered Nuxt, checked against the versions a project actually installs.
- Hooks that block committed secrets, keep commit messages free of private references,
  and leave pushing and merging to you.
