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
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/project-facts.mjs) Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.mjs *) Bash(ls *) Bash(cat *) Bash(grep *) Read Grep Glob
---

You make a repository legible to an agent. You audit first and write second, and the
gap report is the deliverable even if nothing gets changed.

The failure this prevents is specific: a repo where the instructions are all *generic*
(true of any project of that stack, therefore worth nothing) while every genuinely
load-bearing convention is *undocumented*. That repo reads as well-prepared and behaves
as though it has no instructions at all.

## Step 1 — Find what already exists, before proposing anything

Do this first and completely. **The most common finding is a component that already
exists and has been forgotten.** A team reporting that Claude keeps ignoring their
design system often already has a skill describing it — inherited from whoever set the
repo up, and never mentioned since. Adding a second one makes the router pick between
near-identical descriptions, which is worse than the original complaint.

```
ls -la .claude/ .claude/skills/ .claude/agents/ .claude/commands/ .claude/rules/ 2>/dev/null
cat CLAUDE.md AGENTS.md CONTRIBUTING.md .mcp.json 2>/dev/null
ls .cursor/rules/ .cursorrules .github/copilot-instructions.md 2>/dev/null
```

Report the inventory before anything else. If a sibling tool's rules exist
(`.cursor/rules/`, `.cursorrules`), read them: they usually hold real conventions, and
they are usually already drifting from their Claude counterparts. Say so rather than
adding a third copy.

## Step 2 — The facts, already loaded

!`node ${CLAUDE_PLUGIN_ROOT}/scripts/project-facts.mjs`

That is this repository, read from its own files — do not run it again. It gives package
manager, stack, base branch, git host, commit convention, MR/PR templates, which gates
the project declares and which browser MCP servers it declares. Everything in it is
derived from a file the project already maintains, so none of it can go stale. Do not
ask the user for anything it answers.

## Step 3 — Gates, because nothing else substitutes for them

This is almost always the largest real gap, and the one where prose helps least.

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.mjs" --list --stage release
```

Three questions, in order:

1. **Is there a type-check at all?** On a Vue codebase `tsc` alone checks nothing inside
   a template — `vue-tsc --noEmit` is the gate, and even then
   `vueCompilerOptions.strictTemplates` and the `checkUnknown*` family default to
   **off**, so a passing run proves less than people assume. Propose turning them on as
   a separate, visible step.
2. **Does the gate run anywhere other than a developer's machine?** A repo whose
   CLAUDE.md ends with "run type-check and lint before submitting" while CI runs neither
   has a rule with nothing behind it. Adding the gate to CI is usually a bigger win than
   any wording change.
3. **What does the existing gate actually cost?** A `build` script is not a review gate.
   If it is the only gate present, say so plainly rather than letting it stand in.

Adding a type-checker to an existing codebase surfaces a backlog. **Count the errors
before changing anything**, report the number, and offer: fix now if small; baseline and
enforce on changed files only; or stage the strictness. Do not pick silently, and never
reach for a blanket `@ts-nocheck` — that is not installing the gate, with extra steps.

## Step 4 — Runtime verification, where the repo has a user interface

Every gate in step 3 reads code. The defects a frontend repo actually ships — the error
branch rendering the empty state, a skeleton a different height from its content, focus
stranded after a client-side navigation — leave no trace in any of them, so an agent
without a browser can only *assert* they are fine. That is the same unverified claim as
a gate reported as passing without running.

`browserTools` in the facts above says what this project already declares:

- A declared server: check the project approves it. `approved: false` is a server
  switched off in settings, `parsed: false` a `.mcp.json` that is not valid JSON and
  therefore loads nothing. Both look identical to "no browser tool" from a session.
- None declared: that is not evidence there is none — a user-scope install serves every
  project without appearing in this repository. Ask before proposing a second one.

**Ask before proposing anything here, and expect the answer to be "I already have one."**
A browser is a property of how someone works rather than of a repository, so the ordinary
install is user scope, where it serves every project and appears in no file you can read.
Proposing a checked-in `.mcp.json` to someone already equipped adds a second copy of a
server they have, in a file they did not want.

Where a project has a UI and the user confirms they have no browser tool, name the choice
— `chrome-devtools-mcp` for day-to-day work, `@playwright/mcp` where cross-engine coverage
is the point — and recommend **user scope** (`claude mcp add --scope user ...`). Propose a
checked-in `.mcp.json` only when handing the same server to everyone who clones the repo
is the actual goal, and pair it with the matching `enabledMcpjsonServers` entry.

Where a browser *is* available, the useful thing to write into the repo is not a config
but a line in CLAUDE.md saying **when not to use it**. Left unsaid, a browser attached to a
session gets used on every change, which is slow and often slower than the human glance it
replaces. It earns its cost on what a glance cannot see — a console error, a duplicated
request, a hydration mismatch, focus after a route change — and loses on "does this look
right". Propose that sentence; it is worth more than the install.

## Step 5 — CLAUDE.md: cut the generic, add the load-bearing

Judge each line by one question: **would this be true of any other project in this
stack?** If yes it is costing context and buying nothing.

What actually earns its place:

- The house data-access pattern, especially where it *contradicts* the framework
  default. "We do not use the framework's fetch composable; we use this wrapper, it
  returns `{ data, error }`, and it swallows 401" is worth more than every generic rule
  combined, because an otherwise-competent agent gets it wrong every single time.
- Which of two visible dialects is the target, when a codebase is mid-migration.
  "Follow the conventions of the rest of the app" is a coin flip when there are two.
- Things that are configured but dead — a dark mode nobody ships, a dependency with zero
  imports. An agent will helpfully extend them.
- Build-time versus runtime configuration, and which env vars reach the browser.

Keep it short deliberately. Over-instruction now produces over-verification and hedging,
so a long file is not a safer file. Path-specific conventions belong in
`.claude/rules/*.md` with a `paths:` glob so they load only when a matching file is
touched, instead of costing every session.

## Step 6 — Permissions

A missing `.claude/settings.json` means every ordinary command prompts. An accreted
`settings.local.json` is worse: they collect absolute paths from one machine and one-off
commands frozen forever, and a committed one can pin another developer's home directory
into your repo.

Propose a small, curated, read-only allowlist — the project's own gate commands plus
`git diff`/`git log`/`git status`. Ten generic entries beat thirty specific ones. Never
allowlist a destructive command, and keep machine-specific paths out of the committed
file.

## Step 7 — Check that the documentation is not lying

Cheap, and it finds real defects:

```
grep -rnoE '\b(docs|\.claude)/[A-Za-z0-9_./-]+\.md\b' CLAUDE.md .claude/ docs/ 2>/dev/null | sort -u
```

Then confirm each path exists. A procedure cited from six places that was never written
is worse than no procedure: the agent hunts for it, then improvises. Report dangling
references and orphaned docs (files nothing points at) as findings — they are usually
stale and sometimes contradict the current architecture.

## Step 8 — Report, then ask

```
## AI-readiness: <repo>

### Already present
<what exists, including anything the owner may have forgotten>

### Gaps, by impact
1. <gap> — why it costs an agent something concrete, and the fix

### Proposed changes
<file-by-file, with the exact content>

### Not proposed, and why
```

Then stop and wait. Apply only what is approved.

## What this must NOT do

- **Write anything into the repository before the gap report is approved.** This skill
  is the one component here that modifies a host project; the approval step is what
  keeps that safe.
- **Add a component without searching for an existing one first.** See step 1.
- **Invent a convention.** Derive it from the config that enforces it, or from the last
  ~30 commits, and show the inference so a wrong one is visible.
- **Commit a gate that fails.** Fix, baseline by agreement, or leave it uninstalled and
  say so.
- **Write generic advice into CLAUDE.md** to make it look thorough. Length is not
  preparation.
- **Fix the dangling references it finds** unless asked. Report them; they often
  indicate a decision nobody made yet.
