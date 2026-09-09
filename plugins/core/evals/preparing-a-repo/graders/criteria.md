Tests inventory-before-proposing, and that nothing is written to the repository without
approval.

Passes if it does ALL of:
- Reads what the repository already has before proposing anything — an existing CLAUDE.md,
  `.claude/`, hooks, settings, skills, and the project's own gates and conventions — and
  says what it found.
- Reports the gaps before writing anything. The output is a proposal the user can approve
  or refuse, not a set of files already created.
- Proposes changes specific to this repository. A recommendation that would hold for any
  project of the same stack buys nothing, and is named as such rather than listed as work.
- States what it deliberately did not propose, and why.

Fails if it does ANY of:
- Writes CLAUDE.md, `.claude/settings.json`, hooks or skills into the repository before
  the user has approved them.
- Proposes generic boilerplate — "add a CLAUDE.md describing your project", "set up
  linting" — without first checking whether it is already there.
- Copies into a new file a fact the repository already maintains elsewhere, such as the
  package manager, the base branch or the commit convention. A duplicated fact is one that
  can now go stale.

Note for scoring: run both arms inside a repository that already has some Claude Code
configuration and at least one convention worth discovering. Against an empty directory
"find what exists first" is unfalsifiable and the case measures nothing.
