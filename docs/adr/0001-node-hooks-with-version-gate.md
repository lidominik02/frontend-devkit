# 0001. Hooks are Node, started through a version gate

Status: Accepted

## Context

A hook's exit code is a protocol: `2` blocks the tool call, any other non-zero exit is a
non-blocking error. Bash exits `2` on a syntax error, so a shell hook with a syntax error
blocks every tool call — including the edit that would repair it. Node exits `1` on a
`SyntaxError`, which is non-blocking.

The devkit runs on Linux, Windows and macOS
([0011](0011-cross-platform-and-observed-platform-claims.md)), where no single shell is
available everywhere.

A version check written inside a hook script never runs on an old Node: the old runtime
fails while parsing the script's imports, before the check. A minimum Node version cannot
be declared in `plugin.json` either.

## Decision

- Every hook, shipped and repo-local, is a Node script. No hook is bash.
- Every shipped hook starts through one shared `plugins/core/scripts/run.mjs`, written in
  syntax old enough to parse on Node 14.8. It checks the Node version before loading the
  hook. The minimum is Node 22.
- Fail closed on a policy decision; fail open on a broken interpreter. A deliberate
  `exit 2` blocks; a crash exits `1` and lets the call through.
- On a Node below the minimum, `block-secrets` refuses the calls it matches, with a message
  naming the version found and the fix, because letting credential reads through silently
  is the worse failure. The other hooks let the call through and say so once per session.

## Consequences

- A broken hook degrades to no hook, never to a blocked session.
- `block-secrets` is the one exception to failing open, and only on an old Node.
- Below Node 14.8, `run.mjs` itself does not parse and every hook, `block-secrets`
  included, fails open without the message. Without `node` on the `PATH` no hook runs.
- The minimum is stated in [Installation](../installation.md#node), not enforced by the
  manifest.
