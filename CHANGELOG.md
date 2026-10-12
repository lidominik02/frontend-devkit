# Changelog

Each section records one release of every pack in the marketplace, which share one
version: what it added, changed and fixed for someone using the devkit, newest first.

## 0.2.0 - 2026-10-12

### Added

- The installation guide has a "Permissions and attribution" section with a settings
  snippet. It denies reads and edits of credentials, lockfiles and `.git/`, and denies
  push, pull, merge and plumbing commits from both Bash and PowerShell. It also leaves
  commit attribution empty. The guide states what those rules do and do not cover, and
  `preparing-a-repo` recommends the same snippet.
- Each pack has a README listing its skills and agents.

### Changed

- **Breaking:** the devkit ships no hooks. Secret blocking, commit hygiene,
  format-on-write and the verify-before-done Stop hook are gone. Protection now comes
  from your own permission settings. Without the snippet above, nothing stops a
  credential read or a push.
- **Breaking:** a feature's state is kept in up to four plain files in its `temp/`
  folder: `PLAN.md` (the spec and the tasks), `STATUS.md` (where the feature stands and
  what comes next), `DECISIONS.md` (append-only), and `CONTRACT-GAPS.md` when an API is
  involved. The archive and reopen protocol and the separate handoff formats are gone.
  A feature started on an earlier version is carried over by hand.
- Skills read the package manager, the framework packs, the gates and the base branch
  from the project's own files when they need them, and run the project's scripts
  directly. The gate runner and the facts script are removed.
- `reviewing-changes` runs one reviewer that checks both the spec and the code, followed
  by one verification pass, instead of a set of separate reviewers. The reviewer agent
  has no shell.
- `designing-architecture` evaluates a design you propose instead of surveying options
  and drafting alternatives with three agents.
- `fixing-bugs` asks `investigating-bugs` for a diagnosis instead of ranking hypotheses
  itself. `investigating-bugs` no longer has a batch mode.
- `syncing-branches` asks you to commit uncommitted work instead of stashing it
  automatically, and restores a backup only by reset.
- The project's formatter runs on the touched files before the gates on every editing
  path.
- `optimizing-prompts` is removed.

### Fixed

- `finishing-features` shows the full commit message and merge request text in the form
  that asks you to accept them.
- The review diff no longer runs the project's textconv driver, which could hide a
  source change, and it reads a file marked assume-unchanged as it is on disk.
- A restarted run or a retried revert proof no longer fails on a diff name that is
  already taken.
- `syncing-branches` no longer stops on its own `temp/` folder or on the files of the
  operation it is finishing. Its abort option promises back only what the in-progress
  tree holds.
- The Vue rule about hooks after an `await` names where the component instance is really
  lost, and exempts a top-level `await` in `<script setup>` under Suspense.
- A missing tool is reported as NOT RUN. A gate's result is its own exit code, never the
  exit code of a pipe it ran in.
- Reviewers cite only lines from files they opened, and without an intent source they
  report no missing-behaviour findings.

## 0.1.2 - 2026-10-08

### Changed

- Closing out a feature asks before archiving it: "Archive now" or "Later — work is
  left". Later is recommended when a task is Blocked or work is handed to you beyond
  pushing and opening the merge request. On Later the feature folder stays in place, the
  handoff names the work left, and a later "close it out" asks which held items are
  still left and recommends archiving once none is.
- `resume <feature>` finds a feature that was already archived, asks, moves it back and
  records that it was reopened.

### Fixed

- The install notes no longer claim that a release reaches the next session with
  autoUpdate on; they record what was observed on Claude Code 2.1.292 on Windows 10 and
  say that `claude plugin list` is worth checking after any release, since packs can be
  left on the old version.
- The 0.1.1 notes no longer promise that a gate stopped for running too long leaves no
  process behind.

## 0.1.1 - 2026-10-07

### Added

- The hooks and the gate runner work on Windows as well as on macOS and Linux, with no
  bash involved.
- A gate that runs too long is stopped together with every process still reachable
  through it (on Windows, not one whose parent shell has already exited), and the Stop
  hook keeps the gates within the time it has.
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
