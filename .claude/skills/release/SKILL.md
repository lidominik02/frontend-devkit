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
allowed-tools: Read, Edit, Write, AskUserQuestion, Bash(git branch --show-current), PowerShell(git branch --show-current), Bash(git describe *), PowerShell(git describe *), Bash(git log *), PowerShell(git log *), Bash(git diff *), PowerShell(git diff *), Bash(git status *), PowerShell(git status *), Bash(node .claude/skills/release/scripts/release-check.mjs), PowerShell(node .claude/skills/release/scripts/release-check.mjs), Bash(node scripts/ci/release-warning.mjs), PowerShell(node scripts/ci/release-warning.mjs)
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
  `node scripts/ci/release-warning.mjs`, the check CI runs, which owns the list of shipped
  paths; output ending in "unchanged since `<tag>`" means the commits touch nothing a
  user installs, so say "nothing shipped changed since `<tag>`" before step 2.
- **No `v*` tag:** nothing is released yet. List `git log --oneline` and release the
  version the manifests already carry, unbumped — skip step 2.

If `git status` shows uncommitted changes to `CHANGELOG.md` or a
`plugins/*/.claude-plugin/plugin.json`, name those files and stop: the release commit
would carry them. Uncommitted changes anywhere else: name them; they are not part of this
release, which contains only the commits listed, and they do not stop it.

When the commits change something shipped — `release-warning.mjs` did not end in
"unchanged since `<tag>`" — ask in one form whether `/windows-check` and `/try-unreleased`
ran on this code. Each that did not run is named NOT RUN in the message that hands the push
to the user. Neither stops the release.

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
3. Validate what the release commit will hold, not the working tree. Run, without asking:

   ```
   node .claude/skills/release/scripts/release-check.mjs
   ```

   It checks out HEAD into a temporary directory without touching the index, copies the
   release files over it and runs that tree's `validate.mjs`. A non-zero exit, a finding
   or a run that did not report every check as passed, fails it: report the output and
   stop. No commit, no tag.

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
user to push in three steps, and push nothing yourself; that message names as NOT RUN each
of `/windows-check` and `/try-unreleased` that section 1 found had not run. First `dev`,
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
