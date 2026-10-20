# 0014. `core` is domain-neutral and runs only declared gates

Status: Accepted. Amends 0003.

## Context

`core` is enabled in every repository, backends and this one included, but it assumed a
JavaScript frontend: its gates were `package.json` scripts, so in this repository every gate
reported NOT RUN; the bug flow edited only frontend code; its words — composables, an API,
the package manager — named one stack.

A gate inferred by a heuristic gives false greens
([0013](0013-no-hooks-no-facts-service-artifacts-without-a-protocol.md)). A permission prompt
is no semantic check either: a pre-approved gate runs without one.

The repositories it serves include monorepos with several workspaces and repositories that
hold frontend and backend together. A worker that derives the gates again can pick a
different command than the baseline did when the derivation takes judgment.

## Decision

- A gate is a command the project declares in a file it maintains, and every gate line names
  that source. Nothing else runs as a gate. A manifest or task runner's file that describes
  its targets declares them; a tool's implicit lifecycle task (`cargo test`, `go test`) is a
  gate only when the project's `CLAUDE.md`, `AGENTS.md` or `CONTRIBUTING.md` names it.
- A manifest's target runs with the tool that owns the file. Where more than one tool could,
  the project's own declaration decides, then the lockfile beside the manifest, then the
  manifest's default tool.
- The recipe and its prerequisites are read before the gate runs. A command that modifies
  the working tree — a fixer, a write-mode formatter, a generator, or a prerequisite that does
  — never runs as a gate. Tests and builds wait until the user releases them. In doubt, the
  gate is NOT RUN, naming the command.
- Gates and the baseline run per workspace, from that workspace's directory.
- The task and fix briefs carry each gate's command, directory, source and baseline, and the
  formatter command. The worker runs the brief and does not read the rules again.
- No `core` skill pre-approves a test runner or a package manager's command: a gate runs
  behind the permission prompt or the user's own allowlist.
- Code in this repository, in any layer, is the repository's own and may be fixed once the
  user decides. Code it only consumes is reported, not edited. A directory the project names
  as vendored or generated is consumed; otherwise git decides — tracked, or untracked and not
  ignored, is own; ignored, a submodule or outside the repository is consumed. A generated
  file is never fixed by hand: the fix goes to its generator's source.
- A bug's regression test runs with the declared test command in its single-file form. With
  no declared command the repro is NOT RUN, and the fix is not called proven.
- A lockfile is never merged by hand. One the conflict table does not list keeps the side
  being built on, and the command that regenerates it is asked.
- The shipped text is domain-neutral. What stays web- or JavaScript-shaped is a named
  remainder in [Validation](../contributing/validation.md#named-remainders), with the reason
  it stays and the trigger that ends it; a review finds every other hit with one grep.

## Rationale

A component enabled everywhere has to be right everywhere. A declared command with a named
source can be checked by its reader; an inferred one cannot. One reading carried in the
brief removes the second derivation the worker would otherwise make. A lockfile a tool
writes is wrong when merged even if it parses, whichever tool wrote it.

## Alternatives considered

- Per-ecosystem detection rules in `core`: the facts heuristic 0013 removed.
- A validator over a command's flags: the same heuristic, and a false green when it misses a
  form.
- The permission prompt as the boundary: a pre-approved gate never shows it.
- The test runner read from an installed dependency: a detection rule for one ecosystem.

## Consequences

- In a backend repository and in this one, `core` reports the project's own gates. Here,
  `node scripts/validate.mjs` reports pass or FAIL, and `node --test` is NOT RUN until
  released.
- A project that declares no command gets NOT RUN, never a guess; a bug in such a project is
  fixed without a proven regression test, and the report says so.
- A gate shows a permission prompt unless the user's own settings allow it.
- The brief grows by two lines; the implementer reads no reference.
- The web verification and the framework routing still in `core` are named remainders until
  they move ([0015](0015-one-frontend-plugin.md)).
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
  and the test runner comes from the declared command; in a repository with no
  `package.json`, the same.
- A monorepo fixture shows gates and baseline per workspace.
- A conflict in a lockfile the table does not list keeps the side being built on and is not
  merged by hand.

## References

[0003](0003-facts-read-at-moment-of-use.md),
[0011](0011-cross-platform-and-observed-platform-claims.md),
[0013](0013-no-hooks-no-facts-service-artifacts-without-a-protocol.md),
[0015](0015-one-frontend-plugin.md),
[project.md](../../plugins/core/skills/planning-features/references/project.md),
[dispatch.md](../../plugins/core/skills/executing-plans/references/dispatch.md),
[conflicts.md](../../plugins/core/skills/syncing-branches/references/conflicts.md),
[Validation](../contributing/validation.md#named-remainders).
