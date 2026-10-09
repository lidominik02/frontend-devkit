# 0010. One shared version, and `main` moves only at a release

Status: Accepted

## Context

The install source names no ref, so an install or update fetches the head of the default
branch. An existing install stays on its cached copy until `version` in `plugin.json`
changes. Every session of the devkit's user installs from that source, including sessions
running while the devkit itself is being changed.

A manifest's `version` overrides a marketplace entry's, and setting both draws a validator
mismatch warning.

## Decision

- Every pack carries the same `X.Y.Z` in its `plugin.json`, and only there;
  `marketplace.json` carries none.
- Work happens on the `dev` branch. `main` stays the default branch and moves only at a
  release, to a release commit CI has passed.
- `/release` is the only thing that bumps the version: it proposes the level from the
  commits since the last release, writes the versions and a `CHANGELOG.md` section, and
  commits on `dev`. The user pushes `dev`, then moves `main` once CI is green, then tags
  that commit; the tag's push creates the GitHub Release.
- The number stays `0.x` while the devkit has one user: a minor bump for new or changed
  behaviour, breaking changes included, a patch bump for fixes and wording. `1.0.0` comes
  when a second person installs it.

## Consequences

- Unreleased work reaches no installed session; it is tried with `--plugin-dir` or
  `/try-unreleased` ([Contributing](../../CONTRIBUTING.md#trying-an-unreleased-change)).
- A red CI leaves `main` where it is, and the fix is a new release.
- Packs can still be left behind by the CLI after a release
  ([Installation](../installation.md#known-update-behaviour)).
- The `versions` and `changelog` checks hold the version rules.
