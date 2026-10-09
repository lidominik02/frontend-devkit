# 0005. The browser MCP server is not bundled

Status: Accepted

## Context

`verifying-ui` and `testing-changes` need a browser driven through an MCP server. `core` is
enabled in every repository, including every one with no interface.

A plugin-declared MCP server starts its subprocess, and fetches its package, in every
session where the plugin is enabled. A plugin-bundled server's tools are also named
`mcp__plugin_<plugin>_<server>__<tool>` rather than `mcp__<server>__<tool>`.

A server installed at user scope serves every project without appearing in any file in the
repository.

## Decision

- The devkit ships no MCP server. The browser server is the consuming repository's, or the
  user's, to install: `chrome-devtools-mcp` for day-to-day work, `@playwright/mcp` where
  cross-engine coverage is the point. `preparing-a-repo` offers it as a proposal.
- `project-facts.mjs` reports what a repository declares in `.mcp.json`, never whether a
  browser is available. Only the caller's own tool list settles that.

## Consequences

- A repository with no interface starts no browser and downloads nothing.
- Tool names stay `mcp__<server>__<tool>`, so the grants and removals in skills keep
  matching. A grant written for the recommended server key matches nothing under another
  key and degrades to a permission prompt; a removal is written `mcp__*__<tool>` so it
  holds under any key ([0006](0006-guardrails-enforced-where-stated.md)).
- With no browser, `verifying-ui` says plainly that there is nothing to drive and reports
  the check as not verified.
