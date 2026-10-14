# 0014. `core` is domain-neutral and runs only declared gates

Status: Proposed 2026-10-14. Amends 0003.

## Context

`core` is enabled in every repository, backends and this one included, but it assumes a
JavaScript frontend: its gates are `package.json` scripts, so in this repository every gate
reports NOT RUN; the bug flow edits only frontend code; web verification and Vue-specific
preparation live inside it.

A gate inferred by a heuristic gives false greens
([0013](0013-no-hooks-no-facts-service-artifacts-without-a-protocol.md)). A permission prompt
is no semantic check either: a pre-approved gate runs without one.

The repositories it serves include monorepos with several workspaces and repositories that
hold frontend and backend together. A worker that derives the gates again can pick a
different command than the baseline did when the derivation takes judgment.

## Decision

- `core` carries no framework, no web capability and no dev server.
- A gate is a command the project declares in a file it maintains, and every gate line names
  that source. Nothing else runs as a gate.
- The recipe and its prerequisites are read before the gate runs. A command that modifies
  the working tree — a fixer, a write-mode formatter, a generator, or a prerequisite that does
  — never runs as a gate. Tests and builds wait until the user releases them. In doubt, the
  gate is NOT RUN, naming the command.
- Gates and the baseline run per workspace, from that workspace's directory.
- The task and fix briefs carry each gate's command, directory, source and baseline, and the
  formatter command. The worker runs the brief and does not read the rules again.
- Code in this repository, in any layer, is the repository's own and may be fixed once the
  user decides. Code it only consumes is reported, not edited.
- What stays web- or JS-shaped is named, with the trigger that would change it: QA case
  types stay UI-shaped until the first backend QA run in a mixed repository, a non-JS
  lockfile without a header is not read, and pre-approved commands cover JS tooling only.

## Rationale

A component enabled everywhere has to be right everywhere. A declared command with a named
source can be checked by its reader; an inferred one cannot. One reading carried in the
brief removes the second derivation the worker would otherwise make.

## Alternatives considered

- Per-ecosystem detection rules in `core`: the facts heuristic 0013 removed.
- A validator over a command's flags: the same heuristic, and a false green when it misses a
  form.
- The permission prompt as the boundary: a pre-approved gate never shows it.

## Consequences

- In a backend repository and in this one, `core` reports the project's own gates. Here,
  `node scripts/validate.mjs` reports pass or FAIL, and `node --test` is NOT RUN until
  released.
- A project that declares no command gets NOT RUN, never a guess.
- The brief grows by two lines; the implementer reads no reference.
- A reported false green reopens this record.

## Trade-offs

Only declared commands run, so a project with undocumented gates gets fewer gates than an
inference would find. Per-workspace gates cost one run per touched workspace.

## Constraints and invariants

- NOT RUN is never a pass, and an unrun gate is never implied passed
  ([0011](0011-cross-platform-and-observed-platform-claims.md)).
- A brief is written from a reading taken when it is dispatched; it is a hand-off, not a
  cache ([0003](0003-facts-read-at-moment-of-use.md)).
- No facts service, no gate runner, no `dependencies`.

## Validation requirements

- Before the release: an eval case in which a declared gate runs, a gate that writes does
  not, and the working tree is unchanged passes in two runs out of two. If a writing gate
  still gets through, the skill compares the tree before and after with its own
  `snapshot.mjs` and reports "wrote files", never pass.
- The existing cases do not regress.
- Acceptance: a bug owned by this repository's backend is fixed after the user's decision,
  and the test runner comes from the declared command.
- A monorepo fixture shows gates and baseline per workspace.

## References

[0003](0003-facts-read-at-moment-of-use.md),
[0011](0011-cross-platform-and-observed-platform-claims.md),
[0013](0013-no-hooks-no-facts-service-artifacts-without-a-protocol.md),
[0015](0015-one-frontend-plugin.md),
[project.md](../../plugins/core/skills/planning-features/references/project.md),
[dispatch.md](../../plugins/core/skills/executing-plans/references/dispatch.md).
