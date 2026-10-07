# Changelog

Each section records one release of every pack in the marketplace, which share one
version: what it added, changed and fixed for someone using the devkit, newest first.

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
