---
name: release
description: >-
  Release the devkit from the dev branch: list the commits since the latest v* tag,
  propose the version bump by the bump rule for the user to approve, then write the
  shared version into every plugin.json, add a CHANGELOG.md section, and — once the
  user accepts the release commit message — commit. Creates no tag and pushes nothing;
  it prints the push of dev, the push that moves main once CI is green, and the tag
  command the user runs on main, whose push creates the GitHub Release.
disable-model-invocation: true
allowed-tools: Read, Edit, Write, AskUserQuestion, Bash(git branch --show-current), PowerShell(git branch --show-current), Bash(git describe *), PowerShell(git describe *), Bash(git log *), PowerShell(git log *), Bash(git diff *), PowerShell(git diff *), Bash(git status *), PowerShell(git status *), Bash(node scripts/validate.mjs), PowerShell(node scripts/validate.mjs)
---

# Release the devkit

A release is one commit on `dev` carrying the new version in every
`plugins/*/.claude-plugin/plugin.json` and a new `CHANGELOG.md` section. Nothing is
tagged or pushed here: the user pushes `dev`, moves `main` only once CI is green on the
release commit, and then tags that commit. The release workflow runs on the pushed
`vX.Y.Z` tag and creates the GitHub Release from the CHANGELOG section.
Only committed work is released and checked; uncommitted changes are neither.

## 1. What is unreleased

Run `git branch --show-current`. Anything other than `dev`: say a release runs on `dev`
and stop.

```
git describe --tags --match 'v*' --abbrev=0
```

- **A tag exists:** list `git log --oneline <tag>..HEAD`. **No commits: say there is
  nothing to release since `<tag>` and stop.** Then run
  `git diff --quiet <tag> HEAD -- plugins .claude-plugin`; exit 0 means the commits touch
  nothing a user installs, so say "nothing shipped changed since `<tag>`" before step 2.
- **No `v*` tag:** nothing is released yet. List `git log --oneline` and release the
  version the manifests already carry, unbumped — skip step 2.

If `git status --porcelain` shows anything, name it and stop: step 3 validates the working
tree, which must then be exactly what the release commit holds, so the tree is clean before
the first form and nothing but the release's own files changes after it.

When the commits change something shipped — the `git diff --quiet` exited 1 — ask in one
form whether the manual release smoke at the end of this skill ran on this code. If it did
not, it is named NOT RUN in the message that hands the push to the user. It does not stop
the release.

## 2. The level

Apply the bump rule to the listed commits:

- **minor** for new or changed behaviour, breaking changes included;
- **patch** for fixes and wording only.

The number stays `0.x` while the devkit has one user; `1.0.0` comes when a second person
installs it, and only the user says so. Ask in one form: the proposed level with the
resulting version, the commits that justify it, and the other level as the
alternative. When nothing shipped changed, "No release (recommended)" comes first and
stops the run. The user approves or changes it. Do not write anything before the answer.

## 3. Write the release

1. Set `"version"` to the new `X.Y.Z` in every `plugins/*/.claude-plugin/plugin.json`.
2. Add a section to `CHANGELOG.md` directly under its introduction, above every earlier
   release:

   ```
   ## X.Y.Z - YYYY-MM-DD
   ```

   dated today, with `### Added`, `### Changed` and `### Fixed` groups, omitting an empty
   one. Each entry says what a user of the devkit notices, in plain words — not a copy
   of a commit subject.
3. Validate the working tree. First `git status --porcelain` must show only `CHANGELOG.md`
   and `plugins/*/.claude-plugin/plugin.json`; anything else changed means the tree is not
   what the release commit will hold, so name it and stop. Then run, without asking:

   ```
   node scripts/validate.mjs
   ```

   A non-zero exit or a finding fails it: report the output and stop. No commit, no tag.

## 4. Commit

Draft the release commit message with `core:describing-changes`, which reads this
repository's convention, and show it to the user. Commit only once they accept it, and
include only the release files, so nothing else already staged slips in.

With the Write tool, write the accepted message, exactly as accepted, to a file in the
system temp directory, outside the repository. git reads a file verbatim; a message
inside double quotes is rewritten by the shell first: PowerShell expands `$name` and
backtick escapes, and a POSIX shell runs a backtick span as a command.

Run these as two separate commands, the second only after the first exited 0. The
pathspec stays quoted: git expands it, the same way in every shell.

```
git add -- CHANGELOG.md "plugins/*/.claude-plugin/plugin.json"
```

```
git commit -F "<message file>" -- CHANGELOG.md "plugins/*/.claude-plugin/plugin.json"
```

Create no tag here. `CHANGELOG.md` is the readable history. Never merge. End by asking the
user to push in three steps, and push nothing yourself; that message names the manual release smoke NOT RUN
when section 1 found it had not run. First `dev`,
which runs CI on the release commit:

```
git push origin dev
```

Then, only once CI is green on the release commit, move `main` to it:

```
git push origin dev:main
```

Last, the tag on that commit; its push runs the release workflow, which validates again and
creates the GitHub Release. Give the command with the version and a one-line summary of the
release, written without `$` or backticks, since the shell reads the quotes:

```
git tag -a vX.Y.Z -m "vX.Y.Z — <one-line summary>" dev
git push origin vX.Y.Z
```

If CI is red, `main` stays where it is and no tag is made; the fix is a new release.

## Manual release smoke

Two sessions in a scratch repository, run by the user with the working tree's plugins loaded
(`claude --plugin-dir plugins/core`, and the same for a pack the scenario needs). Each passes
when the listed observations hold.

**A bounded change.** A tiny repository with a `.gitignore` holding `temp/`, a
`package.json` whose `lint` script prints `lint: ok`, and `src/format.js` exporting
`formatPrice(cents)` that returns `(cents / 100).toFixed(2)`. Ask, naming the skill in words:
"Use the core:clarifying-features skill for this change: formatPrice should put a dollar sign
in front of the amount, so formatPrice(1999) returns "$19.99". Nothing else changes." Answer
the approval form with Build it. Observe: `clarifying-features` is called, an approval form
appears, `src/format.js` returns a `$`-prefixed string, the lint gate is reported by name,
and `reviewing-changes` runs.

**An open task, then continue.** The same kind of repository, with a `lint` script that exits
1 while `src/greeting.js` exists, and an approved two-task feature under `temp/greet/`
(`PLAN.md` with the tasks "Add the greeting module" — create `src/greeting.js` exporting
`greet(name)` → "Hello, <name>!" — and "Add the version export" — `src/index.js` exports
`version = '1.0.0'`; `STATUS.md` at execute, task 1/2, subagent per task). Ask: "Use the
core:executing-plans skill to run the approved plan of the feature greet, from its first task.
If the run stops for me after a task, continue." Observe: the run never changes
`scripts/lint.mjs` on its own — it asks, before or after building task 1, how to resolve the
plan's contradiction (observed 2026-10-12: a form before the task); answered with the lint
change allowed, an implementer subagent runs each task, a reviewer follows it, the pause
offers Continue, Continue without pausing and Stop, `src/greeting.js` exists and
`src/index.js` exports `version`.
