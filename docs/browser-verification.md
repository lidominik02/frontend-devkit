# Browser verification

Static checks read code: the type-checker, the linter, the tests and the reviewer. The
defects a frontend actually ships do not live there: the error branch that renders the
empty state, a skeleton a different height from the content it stands in for, focus
stranded on the old view after a client-side navigation, a component that is correct and
throws on every render. Without a browser the honest report is "not verified" — and the
failure mode is that it comes back as "looks right" instead.

## `verifying-ui`

`/core:verifying-ui` closes that loop against a browser MCP server. Serve the app, take the
URL the dev server actually printed, snapshot the accessibility tree before the screenshot,
read the console and the network, drive the page to the state under test, and re-observe
after the fix. It is the same move `run-gates.mjs` makes for the type-checker, one layer
up: replace a claim with an observation, and report the gap when there is no observation
to be had.

The skill is model-invocable, but it stops and asks for an explicit release before it
opens a browser; that hold is its first instruction. Why it is model-invocable at all:
[ADR 0008](adr/0008-verifying-ui-model-invocable-trial.md).

It grants itself the tools that look at a page — snapshots, screenshots, console, network,
navigation — and withholds `evaluate_script`, the upload tools and every interaction tool,
so those still prompt. The reasoning is in [Hooks](hooks.md#what-no-hook-covers) and
[ADR 0006](adr/0006-guardrails-enforced-where-stated.md).

## Installing a browser MCP server

The browser is not bundled: the server is the consuming repository's to install —
`chrome-devtools-mcp` for day-to-day work, `@playwright/mcp` where cross-engine coverage
is the point. `preparing-a-repo` offers it as a proposal rather than assuming it. Why it is
not bundled: [ADR 0005](adr/0005-browser-mcp-not-bundled.md).

A server installed at user scope serves every project without appearing in any file in the
repository. So `project-facts.mjs` reports what a repository declares, never whether a
browser is there: the only authority on that is the caller's own tool list, and a skill
that inferred "no browser configured" from an absent `.mcp.json` would be confidently
wrong in the common case.

## The QA list, and the two checks past the browser

`/core:testing-changes` is the lifecycle's two QA stages — the list, then the run — as one
skill with two modes.

- `plan <feature>` derives acceptance criteria from SPEC.md or the requirement sources and
  maps positive, negative and edge cases to each, naming which check verifies it, then
  stops for the user's approval — an unapproved list is not a mandate to run anything, the
  same rule `planning-features`' plans hold.
- `run <feature>` executes the approved list: the browser cases through `verifying-ui`, a
  design-intent comparison against the design tool, and a Storybook check, each one
  establishing its own prerequisite and **skipping itself by name, with the reason**, when
  that prerequisite is absent — never a silent pass and never an omission from the report.

`run` does not start until the turn carries an explicit release; like `verifying-ui`'s, the
hold is the skill's first instruction rather than enforced by hiding the skill.

### Design intent, never pixel parity

A screenshot diff against a design frame reports every deliberate divergence as a defect,
and a repository that intentionally departs from its frames fails that comparison for doing
exactly what it meant to do. The check compares presence, hierarchy, states, token and
naming alignment and copy instead — a divergence is a finding only when nothing in the
repository's own decisions, ADRs or docs explains it.

It drives the design tool's MCP read tools directly and must work in a repository with no
project-local design skill at all; where one exists it is used as a bonus source of
context, never a prerequisite. The design tool's write- and execution-shaped tools are
withdrawn via `disallowed-tools`, the same strong removal `verifying-ui` uses for
`evaluate_script` — their names checked against a real project's own settings on Claude
Code 2.1.278. Each is written `mcp__*__<tool>`, so the removal holds under any server key:
on Claude Code 2.1.283, `mcp__figma__use_figma` did not block the tool on a server keyed
`claude_ai_Figma`, and `mcp__*__use_figma` did.
