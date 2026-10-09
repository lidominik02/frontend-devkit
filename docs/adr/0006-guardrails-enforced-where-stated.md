# 0006. A guardrail is stated where it is enforced

Status: Accepted

## Context

A skill body can say what the component must not do, but the model may still do it.
`allowed-tools` pre-approves commands for the invoking turn only; every unlisted tool stays
callable behind a prompt, and once the user approves a call by hand, absence from the list
stops nothing. `disallowed-tools` blocks a tool for the invocation and beats an explicit
`--allowedTools` grant. A hook runs on every matching call, whoever approved it.

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
- Deterministic hooks sit underneath, on the tool calls their matchers select:
  `block-secrets` blocks credential reads and exfiltration through file tools and `Bash`,
  and `commit-hygiene` denies a commit message with an attribution trailer or a private
  reference, and the push and merge forms it can parse. The user pushes and merges.
- `scripts/validate.mjs` checks every frontmatter key against the fields Claude Code reads,
  and that every blocked MCP tool is documented under the skill that blocks it.

## Consequences

- An enforcement claim can be checked: the prose names its mechanism.
- Some trades are documented rather than hidden: `verifying-ui` grants `emulate` and
  `resize_page` although both change the page, because withholding them would put a prompt
  in front of every state check.
- No hook covers an MCP tool; the browser upload and script-evaluation tools are therefore
  withheld from the skill that uses the browser ([Hooks](../hooks.md#what-no-hook-covers)).
- The detailed rules are in [Authoring](../contributing/authoring.md#tool-grants).
