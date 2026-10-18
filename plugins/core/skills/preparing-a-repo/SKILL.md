---
name: preparing-a-repo
description: >-
  Audit an existing repository for how well it actually supports AI-assisted work, then
  close the gaps that matter: missing quality gates, a CLAUDE.md that only states generic
  advice, an absent or accreted permission allowlist, conventions that live in nobody's
  file, and documentation that points at files which no longer exist. Produces a written
  gap report first and changes nothing without approval. Use whenever the user says "set
  this repo up for Claude", "onboard this project", "prepare this repo for AI", "why is
  Claude bad in this repo", "add a type-check", "we have no lint here", "improve our
  CLAUDE.md", or opens work in a repository with no .claude/ directory — and use it
  before authoring any new project-local skill, because the most common finding is that
  a suitable one already exists and nobody knew.
disable-model-invocation: true
allowed-tools: Bash(cat *) Bash(ls *) Bash(grep *) Read Grep Glob
---

You make a repository legible to an agent: audit first, write second; the gap report is
the deliverable even if nothing changes. The failure this prevents is a repo whose
instructions are all *generic* while every load-bearing convention is *undocumented*.

## Step 1 — Find what already exists, before proposing anything

**The most common finding is a component that already exists and has been forgotten.**
A second one makes the router pick between near-identical descriptions.

```
ls -la .claude/ .claude/skills/ .claude/agents/ .claude/commands/ .claude/rules/ 2>/dev/null
cat CLAUDE.md AGENTS.md CONTRIBUTING.md .mcp.json 2>/dev/null
ls .cursor/rules/ .cursorrules .github/copilot-instructions.md 2>/dev/null
```

Report the inventory first. Sibling tools' rules usually hold real conventions and are
drifting from their Claude counterparts; say so rather than adding a third copy.

## Step 2 — The facts

Read the package manager, the framework packs, the gates and the base branch as
`../planning-features/references/project.md` describes them. Every fact comes from a file the
project already maintains; do not ask the user for anything it answers.

## Step 3 — Gates, because nothing else substitutes for them

This is almost always the largest real gap, and the one where prose helps least. List the
gates `## Gates` in `project.md` finds — each with its workspace and source, or
`NOT RUN (no declared command)` — and ask:

1. **Is there a type-check at all?** On Vue, `tsc` checks nothing inside a template —
   `vue-tsc --noEmit` is the gate, and `strictTemplates` and the `checkUnknown*` family
   default to **off**. Propose turning them on as a separate, visible step.
2. **Does the gate run anywhere but a developer's machine?** A rule CI does not run has
   nothing behind it; adding the gate to CI usually beats any wording.
3. **What does the existing gate cost?** A build or a test suite is a held check, not a fast
   gate (`## Held checks` in `project.md`); say so.

A new type-checker surfaces a backlog. **Count the errors before changing anything**, and
offer: fix now if small; baseline and enforce on changed files; or stage the strictness.
Do not pick silently, and never reach for a blanket `@ts-nocheck`.

## Step 4 — Runtime verification, where the repo has a user interface

Every gate in step 3 reads code; without a browser an agent can only *assert* that runtime
defects are absent. Ask the user one question: **do you already have a browser MCP server
installed?** A user-scope install appears in no file you can read, so a missing `.mcp.json`
is no evidence there is none.

If no, name the choice — `chrome-devtools-mcp` day to day, `@playwright/mcp` for
cross-engine — and recommend **user scope** (`claude mcp add --scope user ...`); a
checked-in `.mcp.json`, with its `enabledMcpjsonServers` entry, only to equip every cloner.

Where a browser *is* available, the useful line for CLAUDE.md says **when not to use it**.
It earns its cost on what a glance cannot see — a console error, a duplicated request, a
hydration mismatch, focus after a route change — and loses on "does this look right".

## Step 5 — CLAUDE.md: cut the generic, add the load-bearing

Judge each line by one question: **would this be true of any other project in this
stack?** If yes it is costing context and buying nothing. What earns its place:

- The house data-access pattern, especially where it *contradicts* the framework
  default ("this wrapper returns `{ data, error }` and swallows 401").
- Which of two visible dialects is the target, when a codebase is mid-migration.
- Things configured but dead, which an agent will helpfully extend.
- Build-time versus runtime configuration, and which env vars reach the browser.

A fact the project already maintains in a file — the package manager, the base branch, the
commit convention with its allowed scopes — is not copied into CLAUDE.md: name the file that
holds it, and propose removing a copy CLAUDE.md already carries. That holds inside another
line too: a command names the script and its workspace, not the package manager that runs
it, and a rule a config file sets is not restated, its values included — the line points at
that file. A copy is a second source, and the first to go stale. A convention no file
holds, seen only in the commit history, belongs in CLAUDE.md, with the inference shown.

Keep it short. Path-specific conventions belong in `.claude/rules/*.md` with a `paths:` glob.

## Step 6 — Permissions

Without `.claude/settings.json` every ordinary command prompts; an accreted
`settings.local.json` freezes one machine's paths. Propose a small read-only allowlist —
the declared fast-gate commands plus `git diff`/`git log`/`git status`; never a destructive
command.

## Step 6b — Settings the devkit recommends

```json
{
  "attribution": { "commit": "", "pr": "", "sessionUrl": false },
  "permissions": {
    "deny": [
      "Read(.env)", "Read(.env.*)", "Read(!.env.example)",
      "Read(~/.ssh/**)", "Read(~/.aws/**)", "Read(~/.gnupg/**)",
      "Edit(package-lock.json)", "Edit(pnpm-lock.yaml)", "Edit(yarn.lock)", "Edit(bun.lock)", "Edit(bun.lockb)",
      "Edit(.git/**)",
      "Bash(git push:*)", "Bash(git pull:*)", "Bash(git merge:*)", "Bash(git commit-tree:*)",
      "Bash(gh pr merge:*)", "Bash(glab mr merge:*)",
      "PowerShell(git push:*)", "PowerShell(git pull:*)", "PowerShell(git merge:*)", "PowerShell(git commit-tree:*)",
      "PowerShell(gh pr merge:*)", "PowerShell(glab mr merge:*)"
    ]
  }
}
```

The devkit ships no hook: without these rules nothing stops a credential read or a push.

## Step 7 — Check that the documentation is not lying

```
grep -rnoE '\b(docs|\.claude)/[A-Za-z0-9_./-]+\.md\b' CLAUDE.md .claude/ docs/ 2>/dev/null | sort -u
```

Confirm each path exists — a cited procedure never written makes the agent hunt, then
improvise. Report dangling references and orphaned docs as findings.

## Step 8 — Report, then ask

```
## AI-readiness: <repo>

### Already present
<what exists, including anything the owner may have forgotten>

### Gaps, by impact
1. <gap> — why it costs an agent something concrete, and the fix

### Proposed changes
<file-by-file, with the exact content. An existing CLAUDE.md: only the lines to add, change
or remove, each with its place in the file. No CLAUDE.md yet: the whole proposed file.
Step 5 binds the CLAUDE.md in both.>

### Not proposed, and why
```

Then stop and wait. Apply only what is approved.

## What this must NOT do

- **Write anything into the repository before the gap report is approved.** This skill
  is the one component here that modifies a host project.
- **Add a component without searching for an existing one first.** See step 1.
- **Invent a convention.** Derive it from the config that enforces it, or from the last
  ~30 commits, and show the inference so a wrong one is visible.
- **Commit a gate that fails**, or **write generic advice into CLAUDE.md** to look thorough.
- **Fix the dangling references it finds** unless asked; they often mark an unmade decision.
