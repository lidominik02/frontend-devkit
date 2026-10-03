---
name: release
description: >-
  Release the devkit from the dev branch: list the commits since the latest v* tag,
  propose the version bump by the bump rule for the user to approve, then write the
  shared version into every plugin.json, add a CHANGELOG.md section, and — once the
  user accepts the release commit message — commit and create an annotated vX.Y.Z
  tag. Pushes nothing; it prints the push command that moves main for the user.
disable-model-invocation: true
allowed-tools: Read, Edit, AskUserQuestion, Bash(git branch --show-current), Bash(git describe *), Bash(git log *), Bash(git diff *), Bash(git status *)
---

# Release the devkit

A release is one commit on `dev` carrying the new version in every
`plugins/*/.claude-plugin/plugin.json` and a new `CHANGELOG.md` section, marked by an
annotated `vX.Y.Z` tag. Nothing is pushed: the user pushes `dev`, and `main` with it.
Only committed work is released and checked; uncommitted changes are neither.

## 1. What is unreleased

Run `git branch --show-current`. Anything other than `dev`: say a release runs on `dev`
and stop.

```
git describe --tags --match 'v*' --abbrev=0
```

- **A tag exists:** list `git log --oneline <tag>..HEAD`. **No commits: say there is
  nothing to release since `<tag>` and stop.** Then run
  `git diff --quiet <tag> HEAD -- plugins/`; exit 0 means the commits touch nothing a
  user installs, so say "nothing shipped changed since `<tag>`" before step 2.
- **No `v*` tag:** nothing is released yet. List `git log --oneline` and release the
  version the manifests already carry, unbumped — skip step 2.

If `git status` shows uncommitted changes to `CHANGELOG.md` or a
`plugins/*/.claude-plugin/plugin.json`, name those files and stop: the release commit
would carry them. Uncommitted changes anywhere else: name them; they are not part of this
release, which contains only the commits listed, and they do not stop it.

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
   ## X.Y.Z — YYYY-MM-DD
   ```

   dated today, with `### Added`, `### Changed` and `### Fixed` groups, omitting an empty
   one. Each entry says what a user of the devkit notices, in plain words — not a copy
   of a commit subject.
3. Validate what the release commit will hold, not the working tree: a temporary checkout
   of HEAD outside the repository, with the release files copied over it.

   ```
   tmp="$(mktemp -d)"
   git archive HEAD | tar -x -C "$tmp"
   tar -c CHANGELOG.md plugins/*/.claude-plugin/plugin.json | tar -x -C "$tmp"
   node "$tmp/scripts/validate.mjs"; code=$?
   rm -rf "$tmp"
   exit "$code"
   ```

   If it fails, report the findings and stop: no commit, no tag.

## 4. Commit and tag

Draft the release commit message with `core:describing-changes`, which reads this
repository's convention, and show it to the user. Commit only once they accept it, and
include only the release files, so nothing else already staged slips in. The tag is
created only when the commit succeeded:

```
git add -- CHANGELOG.md plugins/*/.claude-plugin/plugin.json &&
git commit -m "<accepted message>" -- CHANGELOG.md plugins/*/.claude-plugin/plugin.json &&
git tag -a vX.Y.Z -m "vX.Y.Z — <one-line summary of the release>"
```

The tag annotation marks the release commit with its version and summary;
`CHANGELOG.md` is the readable history. Never merge. End by asking the user to push
`dev`, move `main` to the release commit and push the tag, all at once, and push nothing
yourself:

```
git push origin dev dev:main --follow-tags
```
