# Authoring components

Rules for writing a skill, an agent or a reference file in this marketplace. They apply to
the shipped packs; the repo-local components under `.claude/` follow them too. The
invariants every change must hold are in [`CLAUDE.md`](../../CLAUDE.md).

## Components

**Components live in `skills/`, never `commands/`.** A skill already carries the slash
invocation (`/<plugin>:<skill-name>`), and the checks that read component frontmatter
select on `SKILL.md` or `agents/`, so a file under `commands/` is validated by nothing.

**Skill by default, agent by exception.** An agent earns its place with verbose output that
would pollute the main context, or a tool restriction that must hold structurally. Skills
support `context: fork`, so isolation alone does not justify one. Plugin `agents/` also rank
lowest in discovery precedence, so a same-named agent in a consuming repo shadows one
shipped here.

**Every component ships a written "what this must not do."**

**Prefer deleting a component to adding one.** If Claude delegates to the wrong component,
there are too many — prune before adding.

**An agent cites no reference file.** A skill's references load through its body; an
agent dispatched by a skill gets every text it needs pasted into its dispatch or brief, so
a reference never has to resolve from the agent's side.

**A script lives with its one consumer.** A skill's own script sits in that skill's
`scripts/`; a script more than one component, a hook or CI uses sits in the shared
`scripts/` of its pack or of the repository.

## Injected commands

**Only inject a command that cannot fail.** A skill body can run a command and inject
its output with `` !`command` ``, which turns "the model is told to run the script" into
"the output is already here" — but **a non-zero exit aborts the whole invocation.** A gate
exits non-zero exactly when the skill is most needed, so no shipped skill injects one; the
skills read the project's files and run its scripts as steps. Injection is documented for
skills and undocumented for `agents/`.

## Tool grants

**Grant `allowed-tools` read-only, and only what the body actually runs.** It
pre-approves commands for the invoking turn only — the grant clears on the next message —
so it is for removing prompts, never for widening reach. Read each body and grant its
real command set: `investigating-bugs` shells out to nothing, so it is granted no `Bash`
command — only `Read Grep Glob` and the `Agent` its batch mode dispatches.
Never grant a command a component deliberately holds behind approval;
`describing-changes` withholds `git commit`, `git push`, `glab mr create` and
`gh pr create` on purpose, and pre-approving those would delete the guarantee it is
built on. Whether a grant can override a project `permissions.deny` rule is
undocumented, so do not build on the answer either way. Absence from `allowed-tools`
is a prompt-level guarantee, though — it stops nothing once the user approves a
`git commit` by hand. The user's own deny rules and attribution setting are the layer
underneath ([Installation](../installation.md#permissions-and-attribution)): the user pushes
and merges.

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
`mcp__chrome-devtools__*`, withdraws the entire server, including the tools
`verifying-ui` grants itself to look at a page, which leaves the skill with nothing to look
with; a tool named in both lists is withdrawn, so `disallowed-tools` wins over
`allowed-tools`. The components: `investigating-bugs` drops the write tools, `verifying-ui` drops the
page-evaluate and file-upload tools that no deny rule covers, and `testing-changes`
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

## Bodies and references

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

## Body versus reference

Moving the wrong thing out is worse than leaving it in: the body stops being followable on
its own and the model acts before it reads the reference. Keep in the body every guardrail
(a rule in a reference is not in context when the body is followed), the order of
operations, the decision that routes to a reference — which one and when — and anything
that changes the outcome of the first action. Candidates to move are material consulted
rather than followed: version matrices and compatibility tables, exhaustive enumerations
where the body needs only the distinction, worked examples beyond the first, per-case detail
behind a branch most invocations do not take, and background explaining why a rule holds.

## Adding a pack

First establish that it should be a pack: packs split on inversion, not subject matter. If
the new guidance only adds to an existing pack, it is a reference there. Then touch:

| Place | What |
| --- | --- |
| `plugins/<name>/.claude-plugin/plugin.json` | `name`, the shared `version`, `description`, `author`, `repository`, `keywords`, and `dependencies` naming **every** pack it needs, not just the nearest |
| `.claude-plugin/marketplace.json` | A `plugins[]` entry with `source: ./plugins/<name>` |
| `plugins/<name>/skills/<name>-engineering/SKILL.md` | The pack's one skill, plus `references/` |
| `plugins/<name>/README.md` | What it covers, what it depends on, why it is a separate pack, its skill table |
| `plugins/<name>/evals/` | A README pointing back at `plugins/core/evals/README.md`, and at least one case |
| `plugins/core/skills/planning-features/references/project.md` | One line in "Framework packs": the dependency that names the framework, and its packs, general first |
| `README.md`, `docs/installation.md` | The packs table, the install block and "Choosing packs" |

CI takes its validation targets from `marketplace.json`, so the workflows need no edit.

## The delta contract

A specialised pack's base is its non-`core` dependency; the manifests' `dependencies` are the
shape. After editing either side of a family, read the two checklists and the paired
references as a pair, and look for four kinds of drift, worst first: **an unanswered
inversion** — a base rule false under the specialisation, with no counterpart there;
**a leaked rule** — guidance in the specialisation equally true of the base, which belongs
in the base; **duplicated text** — the same rule on both sides, which diverges on the first
edit; **a one-directional pointer** — an inversion named on one side only.

## Descriptions

**Descriptions are the entire triggering mechanism**, and the cap to author against is
**1,024 characters**: the spec's hard validation limit and the only portable ceiling.
(Claude Code truncates its listing at 1,536, counting `description` plus `when_to_use`
together — measured against 2.1.276, where cost stops rising at exactly that point and
there is no separate global budget — but a description over 1,024 cannot be packaged.)
Write them in the third person, front-loaded, using the literal words a user would type.
Claude undertriggers, so lean pushy.

Check a description yourself in four bands before shipping it: **must-fire** (the component's
core job, said plainly), **should-fire** (the same job in oblique, lazy or partial wording),
**must-not-fire** (adjacent work it must stay out of) and **boundary** (genuinely ambiguous;
record which way it falls and why). Too narrow misses should-fire wording; too broad fires on
must-not-fire. That is the author's own reading, not a measurement: whether it fires is
measured by an eval case with the native `tool_used` grader.

**A skill's `name` must match its parent directory**, per the spec.

## After a Claude Code upgrade

**After a Claude Code upgrade, four claims on this page are worth re-checking by hand.** They are
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
