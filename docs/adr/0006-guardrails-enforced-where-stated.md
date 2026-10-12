# 0006. A guardrail is stated where it is enforced

Status: Accepted. Amended 2026-10-12: the hook layer is gone; the user's permission and
attribution settings sit underneath (ADR 0013).

## Context

A skill body can say what the component must not do, but the model may still do it.
`allowed-tools` pre-approves commands for the invoking turn only; every unlisted tool stays
callable behind a prompt, and once the user approves a call by hand, absence from the list
stops nothing. `disallowed-tools` blocks a tool for the invocation and beats an explicit
`--allowedTools` grant. A `permissions.deny` rule in the user's settings applies to every matching call, whoever
approved it.

A frontmatter key that is misspelled is ignored silently, and a guardrail claimed in prose
that nothing enforces is worse than an honest advisory rule.

## Decision

- Every component states in writing what it must not do, and says which mechanism, if any,
  enforces it.
- `allowed-tools` grants read-only commands, and only those the body actually runs. A
  command a component holds behind approval — `describing-changes`' `git commit`, for
  instance — is never granted.
- A prohibition that is absolute goes in `disallowed-tools`, naming each tool; an MCP tool
  is written `mcp__*__<tool>` so the removal holds under any server key.
- The user's permission and attribution settings sit underneath, as
  [Installation](../installation.md#permissions-and-attribution) recommends: `Read` and
  `Edit` deny rules for credentials, lockfiles and `.git/`, `Bash` and `PowerShell` deny rules
  for push, pull, merge and plumbing commits, and an empty attribution. The user pushes and
  merges.
- `scripts/validate.mjs` checks every frontmatter key against the fields Claude Code reads.

## Consequences

- An enforcement claim can be checked: the prose names its mechanism.
- Some trades are documented rather than hidden: `verifying-ui` grants `emulate` and
  `resize_page` although both change the page, because withholding them would put a prompt
  in front of every state check.
- No deny rule covers an MCP upload tool; the browser upload and script-evaluation tools are
  therefore withheld from the skill that uses the browser.
- The detailed rules are in [Authoring](../contributing/authoring.md#tool-grants).
