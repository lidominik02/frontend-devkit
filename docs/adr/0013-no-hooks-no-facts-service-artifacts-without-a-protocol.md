# 0013. No hooks, no facts service, feature files without a protocol

Status: Accepted

## Context

The two shipped guards — a credential guard and a commit guard over file tools, `Bash` and
`PowerShell` — had grown to 3,112 lines with their own shell parser, and to 2,163 more lines
in four days, each fix a new shell form the parser had not seen. A plugin cannot install a
permission rule: from a plugin's settings only `agent` and `subagentStatusLine` take effect.
A user's own `Read` and `Edit` deny rules, by contrast, already apply to the file tools, to
Grep and Glob, to an `@file` reference, and to the file commands Claude Code recognises in
`Bash` and the targets of its redirections (permissions docs, read 2026-10-12).

A facts script and a gate runner read the project for the skills. Their heuristics gave
false greens: a fixer reached through an npm `pre*` script ran as a gate, a typecheck was
judged against the wrong `tsconfig.json`, and a commitlint file was reported as enforced
with no hook or CI behind it. A hook that ran the gates at the end of a turn started project
code with no permission check at all.

A feature's state was a six-file machine — a ledger with 25 entry shapes, an archive
protocol with four exceptions, a held-archive and reopen protocol — specified in a 348-line
contract, and a large review fanned out to five lenses, a gap sweep and a verifier.

## Decision

- The devkit ships no hook and runs no project code automatically. The boundary is the
  user's permission and attribution settings, the sandbox and the OS; the devkit recommends
  and documents them ([Installation](../installation.md#permissions-and-attribution)).
- The skill that needs a project fact reads it at the moment of use, by the four rules in
  `plugins/core/skills/planning-features/references/project.md`, and runs the project's own
  scripts. There is no facts service, gate runner or override schema.
- A feature lives in four files: `PLAN.md` (what and why), `STATUS.md` (where it stands),
  and the append-only `DECISIONS.md` and `CONTRACT-GAPS.md`, read by id. No entry catalogue,
  no archive or move protocol, no format-compatibility layer.
- A review is one two-axis reviewer and one verify pass, on the session's model.

## Consequences

- Without the recommended settings the devkit guards nothing; `preparing-a-repo` and the
  installation page say so.
- No native rule covers an upload (`curl -d @.env`), an environment dump or a download piped
  into a shell; the sandbox covers the network on macOS and Linux, and native Windows has no
  cover. Whether the `Read` deny covers PowerShell's `Get-Content` is unobserved.
- A feature written under the six-file layout is carried over by hand once, as the artifact
  contract says.
- The review is cheaper and sees less than five lenses did; a missed-defect trend is the
  signal to widen the two-axis role, not to restore the fan-out.
- A new hook, script, skill or agent is admitted only with the reported failure it
  prevents, why a native setting cannot express it, why one sentence in an existing skill is
  not enough, and when it would be deleted.
