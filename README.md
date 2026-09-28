# frontend-devkit

A Claude Code marketplace: a framework-agnostic `core` plugin plus per-framework
packs. Install it once and it applies to every repository you open.

The devkit runs on top of an existing project. It requires nothing to be added to a repo,
and writes into one only in the cases below. Every fact it needs — package manager,
quality gates, base branch, git host, commit convention — is read at the moment of use
from a file the project already maintains: `package.json`, the lockfile, the git remote,
`commitlint.config.*`, `.gitlab/merge_request_templates/`. Nothing is cached, so nothing
goes stale.

- `preparing-a-repo` exists to add those files: it reports the gaps before it writes, and
  writes only the fixes the user approved.
- The lifecycle skills write their artifacts under `temp/` — a feature's in
  `temp/<feature>/`, in the repo that owns it. They never `git add` them, and say so once
  when `temp/` is not ignored.
- In the feature lifecycle, only `executing-plans` — through `core:implementer` workers or
  inline — and `clarifying-features` on its bounded route write code, and only after the
  user approved a plan or an in-chat design. Outside it, `verifying-ui` fixes what it
  observed, once the user released the check.

One capability is not self-contained: `verifying-ui` drives a browser, and the browser is
an MCP server the consuming repo installs. The devkit still adds nothing — it detects what
the repo declares and says plainly when there is nothing to drive.

## Install

Add to `~/.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "frontend-devkit": {
      "source": { "source": "github", "repo": "lidominik02/frontend-devkit" },
      "autoUpdate": true
    }
  },
  "enabledPlugins": {
    "core@frontend-devkit": true,
    "vue@frontend-devkit": true,
    "nuxt@frontend-devkit": true
  }
}
```

Then run `/reload-plugins`.

Set `autoUpdate`. Auto-update is off by default for third-party marketplaces, so without
it a push reaches nobody until someone runs `/plugin update`.

Enabling `vue` installs and enables `core` with it — `dependencies` is enforced, not
advisory. `claude plugin disable core@frontend-devkit` is refused while `vue` is
enabled, and `--plugin-dir ./plugins/vue` on its own leaves the plugin disabled with an
unsatisfied dependency. Pass both directories.

`nuxt` declares `core` **and** `vue` directly rather than relying on `vue` to pull
`core` in transitively. Transitive resolution is not observable from
`claude plugin validate` — only at enable time — so both are named. Enable only the
packs whose frameworks you actually use: a plain-Vue repo pays nothing for `nuxt`, and
enabling `nuxt` alone is what a Nuxt repo wants, since it brings `vue` with it.

## Plugins

| Plugin | Contents |
| --- | --- |
| `core` | `reviewer` and `implementer` agents · `investigating-bugs` · `clarifying-features` (+ 2 reference files) · `planning-features` (+ 4 reference files) · `executing-plans` (+ 1 reference file) · `reviewing-changes` (+ 2 reference files) · `describing-changes` (+ `references/shaping-commits.md`) · `testing-changes` (+ 3 reference files) · `optimizing-prompts` · `preparing-a-repo` · `verifying-ui` · 4 hooks · 3 shared scripts |
| `vue` | `vue-engineering` (+ 8 reference files, including a review checklist and a version-gate table) |
| `nuxt` | `nuxt-engineering` (+ 8 reference files, including an SSR review checklist that inverts four of `vue`'s verdicts) |

Only descriptions are always-on: **4.9k characters** of them with all three packs
enabled — `core` contributes ten listed entries (~3.7k), `vue` and `nuxt` one each
(~0.6k). The ceiling is 6,100 characters; `scripts/validate.mjs` reads both numbers from
this paragraph and fails past the ceiling.
Apart from the `reviewer` and `implementer` agents, each listed description is one
capability clause, the phrasings a user actually types, and negative triggers naming the
neighbouring component to use instead, kept within a per-component allotment of that
ceiling. `preparing-a-repo` and `optimizing-prompts` are excluded because they are
`disable-model-invocation`; `verifying-ui` is listed as a trial (see below).
Skill bodies load on trigger; reference files load only when the body points at them, and
a repo that enables just the pack matching its framework pays for one.

`/skill-doctor` reports the token cost of the listing. Character counts are what this
repo can check from its own files.

## Invoking things

Every skill here answers to `/<plugin>:<skill-name>` — `/core:describing-changes`,
`/core:planning-features`, `/nuxt:nuxt-engineering`. New work starts at
`/core:clarifying-features`. The lifecycle skills are model-invoked, so the phrasings in
their descriptions fire them untyped, and they chain themselves: each calls the next through
the Skill tool, up to the review. Components belong in `skills/`
rather than `commands/`: a skill already carries the slash invocation, and the checks
that read component frontmatter select on `SKILL.md` or `agents/`, so a file under
`commands/` is validated by nothing.

The `reviewer` agent's fully-qualified name is `core:reviewer`, and the skills that
dispatch it use that name: it always resolves to the one shipped here even when a
consuming repo has its own — plugin agents rank lowest in discovery precedence.

Two components carry **`disable-model-invocation: true`**: Claude never reaches for
them on its own, and their descriptions leave the always-on listing. Type them.

- `preparing-a-repo` — it changes a host repository's own configuration and instructions,
  and the write is gated behind an approved gap report.
- `optimizing-prompts` — it rewrites a prompt rather than acting on one, and a skill whose
  whole job is to *not* carry out the text it is handed is the wrong thing for Claude to
  reach for on its own initiative. Typing it also settles a collision: a repo with its own
  prompt-rewriting skill would otherwise have two matching the same wording.

**`verifying-ui` is model-invocable, as a trial.** It carried the same flag until this
was measured: hiding a skill from the model does not merely stop it firing unasked, it
removes the skill's name from what the model can see at all, so the lifecycle step this
skill owns could only ever run when someone typed it. With the flag gone the hold that
used to be enforced by invisibility is now stated as the skill's own first instruction —
it stops and asks for an explicit release before opening a browser. If it starts firing
when it should not, the flag goes back; that reversibility is what makes it safe to try.

Which skills earn auto-triggering is settled by `/skill-doctor` and the ablation cases in
`plugins/core/evals/`.

## The feature lifecycle

```
clarifying-features → planning-features → executing-plans → reviewing-changes
  → testing-changes (on request) → finish
```

`clarifying-features` settles what to build and writes SPEC.md; `planning-features` turns
it into a task-level PLAN.md and takes the user's approval; `executing-plans` builds it;
`reviewing-changes` reviews the result and stops. Each of the first three calls the next
through the Skill tool, unless approval hands execution to a new session. `testing-changes`
runs only when the user asks, and at finish `describing-changes` drafts the commit message:
the commit follows the user's acceptance, and the user pushes. `HANDOFF.md` names exactly
one stage and its owner, a skill or the user; the stages are listed in
`plugins/core/skills/planning-features/references/handoff-format.md`.

**The artifacts** live in `temp/<feature>/`, in the layout
`plugins/core/skills/planning-features/references/artifacts.md` fixes. They are files, not
the transcript, because a session that remembers nothing of the last one has to continue
the work from them.

**Clarification is front-loaded.** It starts from whatever exists — a written spec, a
ticket, notes in any language, a design, or nothing — and looks facts up in the repository,
the design tool and the API contract rather than asking. The user answers only what no
source can — product decisions, each rule's reason, the gaps — through AskUserQuestion
forms, and each answer becomes a DECISIONS.md entry. Code research runs in a background agent
meanwhile. A small change — one surface, a few files, no new API need, no open product
question — takes the bounded route instead: an in-chat design the user approves, built on
the main thread and reviewed, with no SPEC and no PLAN. Bounded work that grows switches to
the feature route; a feature never drops to bounded.

**Two execution modes**, chosen when the plan is approved:

- **Subagent per task** — a fresh `core:implementer` builds each task from a brief file, its
  diff is checked against the brief, a `core:reviewer` task review with up to three fix
  rounds follows, and the run pauses for the user after every task until the user chooses
  to continue without pausing. It continues in the session that planned it. It buys a
  defect caught before the next task builds on it; it costs a dispatch and a review per task.
- **Inline** — one session builds every task with no per-task review and no pause. It saves
  those dispatches, and one context carries tightly coupled tasks; a defect the gates miss is
  found only by the final review. Approval asks whether to start a new session from the
  handoff's kickoff prompt — recommended, since inline work would otherwise run in the
  context that holds the whole clarification and plan — or to continue in the planning
  session.

**The review is automatic.** When every task is done, `reviewing-changes` diffs the work
from the pre-execution tree and passes SPEC.md, PLAN.md and DECISIONS.md to the reviewers by
path. A small change gets one reviewer on the spec and quality axes, then a verifier that
tries to refute each candidate without seeing the finder's reasoning; a large one — past 400
changed lines or 15 files, or a thorough review asked for — gets one reviewer per lens in
`plugins/core/skills/reviewing-changes/references/lenses.md`, in parallel, then the
verifier. The report lands in `temp/<feature>/review/`, the stage becomes
`user reads code + findings`, and the skill stops. When the rules governing the feature hold
the review until the user asks for it — the user's own rules can, the defaults do not —
`executing-plans` does not call `reviewing-changes`: it writes a `review held by rule`
ledger entry quoting the rule, sets the same stage with "no review ran" in `HANDOFF.md`
Status, names the base the review would diff from in Next action, and stops.
`executing-plans` fixes the findings the user chooses; `reviewing-changes` then re-reviews.
Browser, design-tool and Storybook checks run only on request.

**Four decisions reverse the devkit's earlier design.** An old-format feature still
resumes; `handoff-format.md` maps its stages.

- **Implementation no longer defaults to the main thread, and review runs automatically
  after it, not on request.** The execution mode is chosen when the plan is approved,
  because a fresh worker per task keeps each slice small and reviewed before the next task
  builds on it. A review nobody asks for is a review that does not happen, and one reader
  of a whole diff misses what independent lenses and a verification pass catch.
- **A front-loaded clarification and a task-level plan replace a fixed three-phase
  roadmap** of research, plan and implementation. A plan written before the research is a
  guess; the research now happens inside clarification, once.
- **`reviewing-changes` orchestrates the review, and `core:reviewer` is its internal
  worker,** rather than an agent dispatched by its own description. Scope, intent sources,
  lenses and verification need an orchestrator, and the reviewer has no Agent tool to
  dispatch with.
- **CI installs the latest CLI rather than a pinned one**, and `/cli-upgrade-check` is the
  step to take when the validator's output changes. A pin drifts from what users run.

**Resuming.** HANDOFF.md ends in a kickoff prompt for a new session, which runs
`planning-features` in `resume` mode; `/core:planning-features resume` does the same. It
checks HANDOFF.md against the folder, compares the artifacts with `git status` and
`git log`, reports the stage, what is done and how it was verified, the drift and the single
next action, then waits. Work with no plan gets `checkpoint`: a handoff file under
`temp/handoffs/` with its own kickoff prompt.

## Philosophy

- **Systematic over ad hoc.** Work moves through the lifecycle chain in order, and every
  plan task carries a Done when that names the gates and the observation that must hold.
- **Less complexity, not more.** The review's `architecture` lens checks reuse, altitude and
  the deletion test; a plan records decisions, not code; and deleting a component is
  preferred to adding one.
- **Evidence over claims.** A gate that did not run is reported NOT RUN; the verifier holds
  a candidate refuted until its trigger is shown; a finding cites a `file:line` its reviewer
  opened; and a claim here about CLI behaviour was observed, and carries the version.

Parts of the lifecycle design draw on ideas from
[obra/superpowers](https://github.com/obra/superpowers) and
[mattpocock/skills](https://github.com/mattpocock/skills); the wording and the components
here are this repository's own.

## Why Vue and Nuxt are separate packs

Roughly half the guidance inverts between them, and a rule that is correct for Vue and
wrong for Nuxt is worse than no rule — it manufactures confident, wrong output.
Module-scope reactive state is an ordinary singleton in a client-only SPA and a
cross-request data leak under SSR. Imports are mandatory in one and auto-imported in the
other. "There is no server, so nothing is secret" is replaced by `runtimeConfig`'s
public/private boundary. Serving both from one pack means hedging every one of those into
an "if SSR then… else…" sentence, which is precisely the wording that makes the model
pick the wrong branch.

So the packs layer instead of hedging:

```
nuxt  ──depends on──▶  vue  ──depends on──▶  core
```

`vue` holds the component-model truth that is identical everywhere. `nuxt` carries
**only** what server rendering inverts or adds, names every `vue` rule that does not
apply there, and `vue` points back at it. Nothing is duplicated, so nothing can drift.
`project-facts.mjs` reports which packs serve a project as `stack.packs`, ordered general
to specific — the later pack wins a conflict.

The evidence the split earns its cost is a matched pair of ablation cases:
`plugins/vue/evals/module-scope-state/` must call the code fine, and
`plugins/nuxt/evals/ssr-shared-state/` must call the same code Critical.

## Scripts

**`project-facts.mjs`** describes a project from its own files: package manager (the
Corepack field, else the lockfile), gates (`package.json` scripts, with aliases resolved —
`typecheck`, `type-check` and `test:unit` all occur in the wild), base branch
(`origin/HEAD`), git host (the remote plus `.gitlab/` markers, so a self-hosted GitLab is
recognised), commit convention (points at the commitlint config rather than paraphrasing
it) and merge-request templates.

Gates are reported as `declared`. A script name existing says nothing about whether its
binary resolves, so `available` stays `null` until something runs it.

`projectRoot` says whether the directory is a project root: it has a `package.json` or a
`.claude/project.json`, or it is the git top level. Anywhere else — below the top level
with neither file, or outside any git work tree — every gate, dev server and Storybook
script it did not find carries that reason instead of "no script", so a wrong working
directory never reads as a project without gates. The directory is reported, never
resolved to the top level, which would describe a wrong directory inside another
repository as that repository.

`devServer` and `browserTools` draw the same line. `devServer.declaredPort` is the port
the script *names*, and Vite, Nuxt and Next all walk to the next free one when it is
taken — so the URL to open is the one the server printed, and a caller that trusts the
declared number verifies a page nothing is serving. `browserTools` lists the browser MCP
servers this repository declares in `.mcp.json` and whether its settings approve them;
`available` stays `null` there too, because a server installed at user scope serves every
project without appearing in any file here. Only the caller's own tool list settles that
one.

`stack` names the stack, not the pack: `vue-spa`, `nuxt`, `react-spa`, `next`, or `null`.
A meta-framework is checked before the view library it builds on, so a Nuxt app never
reports as plain Vue. `stack.packs` maps that to the packs which serve it — `nuxt`
resolves to `['vue', 'nuxt']`, general first — so no component has to restate the
mapping in prose and drift from it.

**`run-gates.mjs`** runs those gates and separates three outcomes:

| Status | Means |
| --- | --- |
| `pass` | ran, clean |
| `fail` | ran, found a defect **in the code** |
| `not-run` + `blocking: true` | could not run — a defect **in the setup** |

In a directory that is not a project root, every gate is `not-run` with the `projectRoot`
reason and `blocking: false`, `passed` is false and the exit code is 1: nothing there can
pass, and the Stop hook, which acts only on a `fail` or a blocking `not-run`, stays silent
in a session started outside a project.

Classification reads the exit code and the captured output, not `proc.error`: under
`shell: true` a missing binary returns `{ status: 127, error: null }`, because the shell
itself started fine. Probing `node_modules/.bin` is not a workaround — in a pnpm workspace
a binary such as `vue-tsc` lives in the workspace package and never at the root, so a root
probe reports every workspace binary missing.

Stages: `fast` (typecheck, lint) · `full` (+ test) · `release` (+ build). `build` is
outside the review path because on a gate-poor repo it is often the only gate present, and
a review that runs a production build verifies nothing about the diff. Every gate has a
timeout, and a script that starts a watcher is refused rather than left to hang.

**`snapshot.mjs`** captures the working state as a git tree without committing or staging
anything. `take` prints a tree id covering tracked, staged and untracked non-ignored files;
`diff <base>` writes a header line, `--stat` and a `-U10` diff from `<base>` — a tree id, a
commit, or any rev such as a merge-base — to that state into a file under the repository
root's `temp/` (or `--out`, a relative path resolved from the root whatever the current
directory), and prints its path. The tree is built in a throwaway copy of the index, so the
index stays byte-identical and no ref or `HEAD` moves; only unreachable, gc-able objects
are written. The root's `temp/` and every path `block-secrets` treats as credential
material are left out of both, whether or not `temp/` is gitignored; a second header line
names each credential path that differs from the base, since the diff cannot show it.
Submodule working-tree changes are not captured.

## Hooks

| Hook | Event | Guarantee |
| --- | --- | --- |
| `block-secrets.mjs` | PreToolUse | Exit 2 on credential material, regardless of permission mode. Covers **file tools and `Bash`** — a `deny` rule does nothing about reading a dotenv file in a shell. Blocks exfiltration (upload flags, piping into a network client), interpreter one-liners, `source`, environment dumps and a download piped into a shell. Refuses hand-edits to lockfiles and `.git/`. Exempts `.example` / `.sample` / `.template`. A dotenv match requires a path context before it (start, whitespace, a quote, `=`, `/`, `~`), so it does not match inside `process.env` or `import.meta.env`. A heredoc body is stripped from the scan by locating its real closing line, not by truncating everything after the opening marker — truncating there would let anything typed after the heredoc closes through unscanned |
| `commit-hygiene.mjs` | PreToolUse | Exit 2 on a `git commit` whose message carries an attribution trailer (`Co-Authored-By:`, `Generated with`) or names something only Claude and the user can see: a Claude/chat session, a handoff, a planning-artifact filename this pack's own skills write (`HANDOFF.md`, `PROGRESS.md`, …), or a roadmap phase/artifact. A bare "session", "roadmap", "phase N" or a decision/ADR id is deliberately not banned — each collides with ordinary engineering vocabulary (a login session, a product's own roadmap page, a numbered ADR a repository cites correctly) — see the file's own comments for exactly which forms are matched and why. The message is every `-m`/`--message` and `--trailer` value (`key=value` read as the `key: value` git writes, observed on git 2.43.0) and every `-F`/`--file` text, bundled (`-am`, `-aF`) and abbreviated (`--mess`) spellings included; the commit's options and paths and the other commands on the line (`git add HANDOFF.md && git commit …`) are not its message. When the message comes from stdin, a process substitution, a `/dev/` or `/proc/` path, a file this hook cannot read, or a file the same command also names, the whole command is scanned instead, since the message may be written anywhere in it. `git commit-tree` is denied outright, since a plumbing commit bypasses both the repository's own hooks and these checks. The command is read the way a shell reads it, so quoting, a leading assignment, a wrapper (`sudo`, `xargs`, `timeout`, …), a global option that takes a value (`-C <path>`, `-c <k=v>`, `--git-dir`, `--config-env`, …), a `bash -c` string, a heredoc, here-string or pipe into a shell, and a `$(…)`, backtick or `<(…)` substitution, two levels deep, do not hide the subcommand; a message that merely names one, or a command that never runs its arguments (`echo`, `grep`, …), is not a call to it. Some forms stay out of reach — a git alias, a quoted `eval` string, deeper nesting, a git command name produced by an expansion (`$g`, `$(command -v git)`) — and the file's header lists every one |
| `format-on-write.mjs` | PostToolUse | Formats what was just written with the project's own formatter, located by walking up from the file so workspace installs are found. A file whose resolved path lies outside the project directory (`CLAUDE_PROJECT_DIR`, else the working directory) is left as written — a file in the user's auto-memory or in an `--add-dir` directory elsewhere, or the target of a symlink that points out of the project — since the walk would otherwise fall back to the project's formatter. Never blocks — the edit has already happened, and PostToolUse cannot block |
| `verify-before-done.mjs` | Stop | Runs the `fast` gates before the turn can end and returns the real failure output. Silent when the repo has no gates, when nothing has changed, when `verifyOnStop: false`, or when the directory it checks (`CLAUDE_PROJECT_DIR`, else the event's `cwd`) is not a project root — it has no `package.json` or `.claude/project.json` and is not the git top level — even if the gates at the top level fail. Honours `stop_hook_active` so it cannot loop. Skips the gates when the repository's tracked and untracked non-ignored files are unchanged since the last passing run in the same session — a change only to ignored files, such as generated types, is not detected, and a failing run is never remembered, so an unchanged red tree still blocks. Exits silently while a background subagent is running; a background shell such as a dev server never skips the gates. Its git calls and the gates share a 190-second budget inside the hook's 200-second timeout |

All four are Node, not bash. Bash exits `2` on a syntax error, and `2` is also the hook
protocol's "block", so a shell hook with a syntax error blocks every tool call — including
the edit that would repair it. Node exits `1` on a `SyntaxError`, a non-blocking error, so
a broken Node hook fails open while a deliberate `exit 2` still blocks. Fail closed on a
policy decision; fail open on a broken interpreter.

Three coverage holes no matcher can close: an `@file` reference in a prompt inserts file
contents with no tool call at all; a file written by Bash never fires a PostToolUse hook;
and `block-secrets` matches file tools and `Bash`, so **no MCP tool is covered by it**.
Close the first with a `Read(...)` deny rule in project settings.

The third one matters as soon as a browser MCP is attached. A file input reached through
`upload_file` (`browser_file_upload` on Playwright) sends a local file to a page, and from
there to the network, with no hook firing anywhere on the path. `verifying-ui` therefore
grants the tools that look at a page and deliberately withholds the upload and
`evaluate_script` tools, so both still prompt — the same shape as `describing-changes`
withholding `git push`.

There is no SessionStart hook. Writing a capabilities file into a host repo dirties
`git status` wherever `.claude/` is committed, and detection at the moment of use is
fresher than anything cached at session start.

## Runtime verification

Everything above is static. The type-checker, the linter, the tests and the reviewer all
read code, and the defects a frontend actually ships do not live there: the error branch
that renders the empty state, a skeleton a different height from the content it stands in
for, focus stranded on the old view after a client-side navigation, a component that is
correct and throws on every render. Nothing in this repo can see any of them, so without a
browser the honest report is "not verified" — and the failure mode is that it comes back
as "looks right" instead.

`/core:verifying-ui` closes that loop against a browser MCP server. Serve the app, take the
URL the dev server actually printed, snapshot the accessibility tree before the screenshot,
read the console and the network, drive the page to the state under test, and re-observe
after the fix. It is the same move `run-gates.mjs` made for the type-checker, one layer
up: replace a claim with an observation, and report the gap when there is no observation
to be had.

**The browser is not bundled, and that is the design.** `core` is enabled in every
repository, including every one with no interface, and a plugin-declared MCP server would
start a browser subprocess and fetch a package in all of them. So the server is the
consuming repo's to install — `chrome-devtools-mcp` for day-to-day work, `@playwright/mcp`
where cross-engine coverage is the point — and `preparing-a-repo` offers it as a proposal
rather than assuming it. A second reason: a plugin-bundled server's tools are named
`mcp__plugin_<plugin>_<server>__<tool>` rather than `mcp__<server>__<tool>`, so bundling it
would rename every tool the guidance refers to, on exactly the install path being forced on
everyone.

`project-facts.mjs` reports what a repository declares, never whether a browser is there.
The only authority on that is the caller's own tool list, and a skill that inferred "no
browser configured" from an absent `.mcp.json` would be confidently wrong in the common
case — a user-scope install serves every project and appears in no file in the repo.

### The QA list, and the two checks past the browser

`/core:testing-changes` is the lifecycle's two QA stages — the list, then the run — as
one skill with two modes.
`plan <feature>` derives acceptance criteria from SPEC.md or the requirement sources and
maps positive, negative and edge cases to each, naming which check verifies it, then
stops for the user's approval — an unapproved list is not a mandate to run anything, the
same rule `planning-features`' plans hold. `run <feature>` executes the approved list: the
browser cases through `verifying-ui`, a design-intent comparison against the design
tool, and a Storybook check, each one establishing its own prerequisite and **skipping
itself by name, with the reason**, when that prerequisite is absent — never a silent
pass and never an omission from the report.

**Design intent, never pixel parity.** A screenshot diff against a design frame reports
every deliberate divergence as a defect, and a repository that intentionally departs
from its frames fails that comparison for doing exactly what it meant to do. The check
compares presence, hierarchy, states, token and naming alignment and copy instead — a
divergence is a finding only when nothing in the repository's own decisions, ADRs or
docs explains it. It drives the design tool's MCP read tools directly and must work in
a repository with no project-local design skill at all; where one exists it is used as
a bonus source of context, never a prerequisite. Twelve of the design tool's write- and
execution-shaped tools are withdrawn via `disallowed-tools`, the same strong removal
`verifying-ui` uses for `evaluate_script` — their names checked against a real project's
own settings on Claude Code 2.1.278. Each is written `mcp__*__<tool>`, so the removal
holds under any server key: on Claude Code 2.1.283, `mcp__figma__use_figma` did not block
the tool on a server keyed `claude_ai_Figma`, and `mcp__*__use_figma` did.

**The hold moved into the body here too**, for the same reason `verifying-ui`'s did:
`run` does not start until the turn carries an explicit release, stated as the skill's
first instruction rather than enforced by hiding it — this skill has never carried
`disable-model-invocation`, on the same reasoning that removed it from `verifying-ui`.

## Optional per-project override

`.claude/project.json` is honoured when a project has one, purely to correct what detection
gets wrong. It is never required.

```json
{
  "gates": { "test": "pnpm test:ci" },
  "baseBranch": "develop",
  "verifyOnStop": false,
  "stages": { "fast": ["typecheck"] },
  "timeoutMs": 300000
}
```

That is the whole set. `gates` and `baseBranch` replace what detection found;
`verifyOnStop: false` silences the Stop hook; `stages` is merged over the built-in stages
by name, so the entry above *replaces* `fast` rather than adding to it, and an unknown
name defines a new stage; `timeoutMs` sets the per-gate timeout, though a `--timeout`
flag still wins over it.

`gates.format` accepts only known formatters. The value is a string from a checked-out file
handed to a subprocess, and the allowlist is what keeps it a convenience rather than an
execution primitive.

## Install rather than author

From `claude-plugins-official`:

- **`typescript-lsp`** — real diagnostics and go-to-definition; the strongest defence
  against inventing helpers that do not exist. Requires
  `npm i -g typescript-language-server typescript`; the plugin does not install the binary,
  and without it the plugin loads and does nothing. There is no Vue language server, and
  Claude Code's LSP client cannot drive `@vue/language-server` 3.x, so `vue-tsc --noEmit`
  as a gate is the answer for templates.
- **`skill-creator`** — writes, improves and evaluates skills; bundles grader, analyzer and
  comparator agents.
- **`plugin-dev`** — seven skills covering hooks, MCP, commands, agents and plugin
  structure.
- **`claude-code-setup`** — analyses a codebase and recommends automations.
- **`claude-md-management`** — audits CLAUDE.md quality.
- **`frontend-design`**, **`security-guidance`**.

`plugin-dev` and `skill-creator` are background material for authoring, not authorities:
where they differ from this repo's conventions or from observed CLI behaviour, the repo and
the observation win.

`modern-web-guidance` is left out: by default it sends the search queries the agent writes
to Google as usage telemetry, and its advice competes with the `vue` and `nuxt` packs.

`commit-commands` and `pr-review-toolkit` are a poor fit: both are built around GitHub pull
requests and `gh`, neither covers GitLab merge requests, and both compete with
`describing-changes` for the same trigger phrases. The official `gitlab` plugin points at
`https://gitlab.com/api/v4/mcp` and does not serve a self-hosted instance; there, `glab`
with `GITLAB_HOST` is the path.

Among bundled skills: `/code-review` and `/verify` exist but Claude does not invoke them on
its own — type them. `/debug` toggles session debug logging and is not a debugging
assistant. `/simplify` and `/security-review` also ship.

## No build step, no dependencies

Clone it and everything runs with Node and the `claude` CLI. No `package.json`, no
`node_modules`, no install.

Scripts are `.mjs` with JSDoc types — readable, and ready for `tsc --noEmit` if the logic
ever grows enough to justify a toolchain. They are not TypeScript because plugins are
copied into `~/.claude/plugins/cache` and executed directly: there is no build step at
install and no guaranteed TS runtime on a consumer's machine.

A `package.json` in a plugin root does not by itself trigger a dependency install; that also
requires a lockfile, and `yarn.lock` and `pnpm-lock.yaml` are skipped. If a toolchain ever
becomes necessary, `tsconfig.json` belongs at the repo root, never inside a plugin.

## Authoring conventions

**Skill by default, agent by exception.** An agent earns its place with verbose output that
would pollute the main context, or a tool restriction that must hold structurally. Skills
support `context: fork`, so isolation alone does not justify one. Plugin `agents/` also rank
lowest in discovery precedence, so a same-named agent in a consuming repo shadows one
shipped here.

**Every component ships a written "what this must not do."**

**Prefer deleting a component to adding one.** If Claude delegates to the wrong component,
there are too many — prune before adding.

**Only inject a command that cannot fail.** A skill body can run a command and inject
its output with `` !`command` ``, which turns "the model is told to run the script" into
"the output is already here" — but **a non-zero exit aborts the whole invocation.** So
`project-facts.mjs` is injectable and is asserted to exit 0 against an empty directory, a
malformed `package.json`, a malformed `project.json`, a literal `null`, wrong types
throughout, a directory below the git top level with no `package.json`, and a directory
that does not exist.
`run-gates.mjs` is **not** injectable: it exits 1 whenever a gate fails, which is
precisely the moment the skill is most needed, and in any directory that is not a project
root; injecting it would make a failing type-check look like a broken skill. Injection is
documented for skills and undocumented for `agents/`, which is why `reviewer` still runs
its facts step explicitly.

**Grant `allowed-tools` read-only, and only what the body actually runs.** It
pre-approves commands for the invoking turn only — the grant clears on the next message —
so it is for removing prompts, never for widening reach. Read each body and grant its
real command set: `investigating-bugs` shells out to nothing and is granted nothing.
Never grant a command a component deliberately holds behind approval;
`describing-changes` withholds `git commit`, `git push`, `glab mr create` and
`gh pr create` on purpose, and pre-approving those would delete the guarantee it is
built on. Whether a grant can override a project `permissions.deny` rule is
undocumented, so do not build on the answer either way. Absence from `allowed-tools`
is a prompt-level guarantee, though — it stops nothing once the user approves a
`git commit` by hand. `commit-hygiene.mjs` is the deterministic layer underneath it:
whoever runs the command, an attribution trailer or a planning-artifact reference in
the message is denied regardless of which turn approved the call.

**Use `disallowed-tools` where a "must NOT" is absolute.** `allowed-tools` cannot enforce
anything — it pre-approves, and every unlisted tool stays callable behind a prompt. A
prohibition the component must never negotiate belongs in `disallowed-tools`, which blocks
the tool for the invoking turn and beats an explicit `--allowedTools` grant. **It does so by
two different mechanisms, and only one of them is removal** — checked against 2.1.276 and
again against 2.1.278, the second time with a real browser MCP server rather than a stub. A
built-in tool such as `Bash` stays in the model's schema and the call is refused when it is
made, so the model can see the tool and attempt it. A deferred MCP tool is withdrawn
outright: `ToolSearch` reports it unavailable and there is no schema left to call. Either
way the call does not run. The withdrawal happens when the session starts, not when the
body does — with the skill typed in the prompt the tools are already absent from the init
event, and with the plugin loaded but the skill untyped nothing is withdrawn at all, so it
is scoped to the invocation. **Name each tool.** A wildcard in the tool segment, such as
`mcp__chrome-devtools__*`, withdraws the entire server, including the thirteen tools
`verifying-ui` grants itself to look at a page, which leaves the skill with nothing to look
with; a tool named in both lists is withdrawn, so `disallowed-tools` wins over
`allowed-tools`. The components: `investigating-bugs` and `optimizing-prompts`
drop the write tools, `optimizing-prompts` also drops `Bash` and `Agent` because its
input is untrusted imperative text by construction, `verifying-ui` drops the
page-evaluate and file-upload tools that `block-secrets` cannot see, and `testing-changes`
drops the design tool's write tools. Keep the prose rule
as well as the field, and say which of the two is doing the work — claiming enforcement
that is not happening is worse than an honest advisory rule. Only for prohibitions that
are genuinely absolute; a tool a body legitimately needs behind approval stays merely
un-granted.

A grant on an MCP tool has one extra trap: the name is `mcp__<server-key>__<tool>`, and
the key is whatever the consuming repo's `.mcp.json` happens to call the server. A grant
is therefore a best-effort convenience that matches the recommended key and silently
matches nothing under a different one — which degrades to a permission prompt, the status
quo, and never to wider reach. **A removal must not miss that way, and does not have to**:
written with a wildcard in the server segment, `mcp__*__evaluate_script`, it holds under any
key. On Claude Code 2.1.283, `mcp__figma__use_figma` did not block the same tool on a server
keyed `claude_ai_Figma` while `mcp__*__use_figma` did, and `mcp__*__evaluate_script`
withdrew the tool under a plugin-provided server's key although `--allowedTools` granted it,
leaving `take_snapshot` callable. The server wildcard withdraws that tool name from every
server for the invocation, which is right only for a tool the skill must never call; those
probes typed the skill as a slash command, and a model-fired invocation is unobserved. A key
is also sanitised before the prefix is built — `chrome.devtools` resolves to
`mcp__chrome_devtools__*` — so a dotted key matches none of the hyphenated grants while the
server connects and every tool works. Grant what looks, withhold what acts: for `verifying-ui`
that means snapshots, screenshots, console, network and navigation are pre-approved while
`evaluate_script`, the upload tools and every interaction tool are not.

The line is not perfectly clean, and the skill says so rather than claiming it is.
`resize_page` and `emulate` are granted although both change the page: `emulate` is the
whole of the dark-mode, offline and throttling techniques, so withholding it would put a
prompt in front of every state check and make the loop something people turn off — but it
also carries `extraHttpHeaders`, `userAgent` and `geolocation`, so it is not a pure
observation tool. That is a trade, and a documented trade is worth more than a tidy rule
the grant does not actually follow.

**Bodies under ~200 lines, front-loaded** — but not because a surviving prefix rewards it.
Measured against 2.1.278, a manual `/compact` does not re-attach the invoked body at all,
truncated or otherwise; what reaches the next turn is a summary of it. A summary is not a
prefix. It can carry a detail from the very end of a long body and drop the heading that
gave that detail its meaning, so no rule of the form "the first N tokens survive" describes
it. Front-load for the reader working top-down, and do not plan around a cut point.
Automatic compaction on context exhaustion is untested.
Detail belongs in `references/` — the Agent Skills spec directory, alongside `scripts/` and
`assets/` — exactly one level deep. That depth is a convention, not a measured limit: a
second hop is one more thing that has to go right at the moment the model is furthest from
the instruction, and nothing is gained by nesting.

**Descriptions are the entire triggering mechanism**, and the cap to author against is
**1,024 characters**: the spec's hard validation limit and the only portable ceiling.
(Claude Code truncates its listing at 1,536, counting `description` plus `when_to_use`
together — measured against 2.1.276, where cost stops rising at exactly that point and
there is no separate global budget — but a description over 1,024 cannot be packaged.)
Write them in the third person, front-loaded, using the literal words a user would type.
Claude undertriggers, so lean pushy.

**A skill's `name` must match its parent directory**, per the spec.

## Working on the devkit

Everything under `.claude/` is tooling for working **on** this marketplace. It is not
shipped to consumers, is not part of any pack, and costs a consuming repository nothing.

| | |
| --- | --- |
| `/eval-case` | Scaffolds a case under the retention methodology, with the prompt and grader templates |
| `/new-pack` | Scaffolds a pack and wires it into every place that must know about it |
| `/pack-parity` | Checks the delta contract for drift, for every family the manifests declare |
| `/body-vs-reference-audit` | Which parts of a body have earned loading on every trigger |
| `/cli-upgrade-check` | Revalidates the platform claims against the installed CLI and records the version they were verified on |
| `trigger-tester` | Whether a description would fire. Reads descriptions, never bodies — the author cannot judge their own, because they know what the skill does |
| `eval-grader` | Dry-runs a `criteria.md` against synthetic answers before a real run pays for it |
| `component-reviewer` | Reviews a changed component against the invariants CI cannot check |

Three hooks in `.claude/settings.json` run the gates without being asked: `Stop` runs
`validate.mjs` when anything under `plugins/`, `scripts/` or `README.md` has changed, and
two `PostToolUse` hooks check the frontmatter of a component just written and recompute
the always-on budget. All three are Node for the reason the shipped hooks are — a bash
hook with a syntax error exits 2, which is the block signal, so it blocks every tool call
including the edit that would repair it.

`.mcp.json` declares a browser MCP server so `verifying-ui`'s eval can actually run its
browser arm here; without it that half of the case is untestable in this checkout.

**`pack-graph.mjs`** derives the layering from the manifests rather than restating it. A
pack's non-`core` dependency is its base, and that pair is what the delta contract
governs; `core` is the framework-agnostic floor and forms no family. It reports each
family's paired reference topics and the ones present on only one side, so adding a pack
later needs no edit to `/pack-parity` — the relationship is read, not written down.


```bash
node scripts/validate.mjs                       # the five static checks CI runs
bash scripts/test-hooks.sh                      # 316 assertions on the guarantees
node scripts/pack-graph.mjs                     # pack layering, derived from the manifests
claude plugin validate . --strict               # marketplace + entries
claude plugin validate ./plugins/core --strict  # manifest fields, hooks.json
claude plugin validate ./plugins/nuxt --strict  # and ./plugins/vue
node plugins/core/scripts/project-facts.mjs     # what detection sees here
claude plugin details core@frontend-devkit      # inventory + token cost
```

The first two are the gate. `scripts/validate.mjs` is the single implementation of
everything `claude plugin validate` will not check, and CI calls that same file rather
than carrying its own copy, so the two cannot drift:

| Check | Catches |
| --- | --- |
| `frontmatter` | A missing description, one past the 1024-char packaging cap, a skill whose `name` does not match its directory, any frontmatter field Claude Code does not read, `permissionMode` in a plugin agent (honoured for a project agent and ignored for a plugin agent, observed on 2.1.283), and a `<` or `>` in any frontmatter value |
| `budget` | The always-on description total drifting from the figure this README publishes, or exceeding the ceiling it publishes |
| `references` | A cited `.md` that does not resolve **from the file citing it** |
| `mcp-names` | A blocked `mcp__` tool absent from the table documenting it |
| `scripts` | A `.mjs` that does not parse, or a script `hooks.json` names and does not exist |

Run one with `--checks=frontmatter,budget`.

**`--strict` does not read component frontmatter.** It flags an unknown field in
`plugin.json` and a missing `description` in a `SKILL.md`, but a *misspelled* frontmatter
key passes clean — checked against 2.1.250, 2.1.276, 2.1.278 and 2.1.283. That failure is
silent and expensive in both directions: misspell `disable-model-invocation` and a typed
skill starts auto-triggering in every repository, misspell `disallowed-tools` and a
guardrail stops being enforced with
the prose still claiming it is. What the validator will not check is owned by
`scripts/validate.mjs`, which runs in a terminal in well under a second — there is no
reason to reach for `act` or to keep those rules true by hand.

**After a Claude Code upgrade, four claims here are worth re-checking by hand.** They are
about the platform rather than about this repo, so nothing in CI can hold them: that
`disallowed-tools` still blocks a tool the component grants at the CLI, that it still
matches MCP tool names, that a non-zero exit from an injected command still aborts the
invocation, and that the listing still truncates a description where it does. The first two
were re-checked against 2.1.278; the other two stand at 2.1.276. The method is the same in
every case — run the same prompt
twice, changing only the one field under test, and load the working tree with
`--plugin-dir` rather than the installed plugin, which on a developer machine is often an
older snapshot. A control matters more than it looks: a model declining to do what a skill
told it not to do proves nothing, so the arm without the field has to succeed.

Then, inside a session: `/doctor` for configuration problems and `/skill-doctor` for the
per-skill listing token cost and any skill that never fires. "Prefer deleting a component
to adding one" is only a slogan while the cost of keeping one is unmeasured; those two
commands are what make it a decision. `plugins/*/evals/` holds the ablation cases that
settle whether a component earns that cost at all.

`--strict` turns an unrecognised field into an error, which is the only way to catch a typo
such as `mcpServer` for `mcpServers` — Claude Code ignores unknown fields at load time, so
without it the component silently never loads. It also treats the absent `version` as an
error, so it exits 1 here even when everything is correct; CI runs it and allows exactly
that one finding.

In `scripts/test-hooks.sh` the parse check runs before any behavioural assertion. A script
with a syntax error and a script that deliberately blocks are indistinguishable by exit
code, so without that ordering every result below it is unreadable.

`version` is omitted from every manifest so a static `"1.0.0"` that nobody bumps never pins
the update cache key. That holds for a directory source too — a local checkout registered
in place of the GitHub source under "Install": observed on CLI 2.1.283 against an existing
install, `core`, `vue` and `nuxt` each record `version` as the 12-character prefix of the
checkout's `HEAD` SHA, with the full SHA as `gitCommitSha`. A directory source serves the
working tree, whatever `installed_plugins.json` records: on 2.1.283, a `claude -p` session
started in an unrelated directory reported `core`'s plugin path as `<checkout>/plugins/core`,
listed skills and an agent that existed only in the working tree, and ran the working tree's
`commit-hygiene.mjs`, while `installed_plugins.json` still named a copy under
`~/.claude/plugins/cache/frontend-devkit/<plugin>/<sha>/`. A saved edit, committed or not,
therefore reaches the next session in every repository that enables the plugin.
`claude plugin validate` warns about the missing `version` regardless of source; that
warning is the intended state.

**A live trial loads the plugin from a separate worktree pinned to a commit, never from the
working tree being edited.** A session that loads the working tree runs each hook from the
file on disk at the moment of the call, so a hook caught mid-edit can fail to parse, and a
Node hook that throws exits 1 and fails open: the trial runs without the guarantee it is
meant to exercise. `git worktree add --detach <path> <commit>` gives a checkout that stays
at that commit while the working tree moves on, and `git -C <path> checkout --detach
<commit>` moves it to a later one (git 2.43.0); register `<path>` as the directory source,
or pass its plugin directories to `--plugin-dir`.
