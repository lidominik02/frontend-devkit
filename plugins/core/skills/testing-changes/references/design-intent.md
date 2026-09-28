# Design intent, never pixel parity

Read this while running the design-intent cases in `run` mode.

**Why never pixel parity.** A screenshot diff against a design frame reports every
deliberate divergence as a defect — a repository that intentionally departs from its
frames (a chosen font substitution, a responsive reflow the frame never showed, a
content-driven layout change) fails a pixel comparison for doing exactly what it meant
to do. This check compares *intent*, not pixels: presence, hierarchy, states, token and
naming alignment, and copy. A divergence is a finding only when nothing in the
repository's own decisions, ADRs or docs explains it.

## Reaching the design

**Never require a project-local design skill.** This check drives the design tool's own
MCP read tools directly and must work in a repository that has none. Where a project
does have its own design skill, detect it via `project-facts`'s `designReference` and
use it as a bonus source of context — which frame is authoritative, what the naming
convention is — never as a prerequisite.

Establish the design from, in order: SPEC.md's Design section — the source's type, its
location or link, how to reach it, and its coverage — with the PLAN.md task's Design field
for the exact screens and states the task built; else a frame id, link or file the
approved test list names; else ask rather than guess which design this feature
corresponds to. **Never invent a screen** — a case with no reachable design is a skip for
that case specifically, named in the report, not a case verified against a frame you
assumed.

**The source's type decides what can be compared.** Token alignment needs bound
variables, so it applies only where the source carries them — frames read through the
design tool:

- **Frames read through the design tool** — everything under "What to compare".
- **Screenshots, or an export under `temp/<feature>/design/`** — presence, hierarchy,
  states and copy, against the images.
- **A proposal the user approved** — the proposal file SPEC Design names, not a frame:
  presence, the states it lists, and the tokens and components it names.

**Write tools stay denied regardless of what is reachable.** This check reads a design;
it never edits one. If a write-shaped tool is somehow the only way to read what is
needed, that is a sign the check is reaching for the wrong tool, not a reason to use it.

## Which tools are removed, and under which key

`disallowed-tools` on `SKILL.md` withdraws twelve tools from the pool outright, the same
strong removal `verifying-ui` uses for `evaluate_script` and `upload_file` — the names are
absent from the tool set before the first model call, not merely left to prompt. All
twelve are write- or execution-shaped, observed under the **`figma`** server key in a real
project's own settings on Claude Code 2.1.278:

`use_figma` (executes arbitrary JavaScript in the design file — the closest analogue to
`evaluate_script`), `create_new_file`, `generate_figma_design`, `generate_diagram`,
`generate_deck`, `upload_assets`, `add_code_connect_map`, `send_code_connect_mappings`,
`create_shader`, `update_shader`, `create_generative_plugin`, `update_generative_plugin`.

**The removal holds under any server key.** Each entry is written `mcp__*__<tool>`, a
wildcard in the server segment: on Claude Code 2.1.283, `mcp__figma__use_figma` did not
block the same tool on a server keyed `claude_ai_Figma` — the key a claude.ai connector
gets — while `mcp__*__use_figma` blocked it and left that server's `get_screenshot`
callable. The wildcard withdraws each name from every server, which is right because this
check may call none of the twelve on any server. The withdrawal is scoped to the invocation
of this skill: on 2.1.283 a blocked tool was absent from the session's tool list with the
skill invoked as a slash command, and listed with the plugin loaded but the skill not
invoked; a model-fired invocation is unobserved. A wildcard in the tool segment withdraws
the whole server, the read tools included, so it stays wrong here.

**A design tool's default read output is often framework-opinionated** — generated code
mentioned in a read call may default to a stack this repository does not use (React and
Tailwind is the commonly documented default). Read the structured data the tool returns
(node names, bound variables, hierarchy) rather than any generated code sample it offers
alongside it; the structure is stack-agnostic, the code sample is not.

## What to compare

**Presence.** Does every element the frame shows exist in the rendered feature, and
nothing the frame does not show appear unexplained. A missing element is usually a
finding; an added one needs a reason before it counts as one — see "what is not a
finding" below.

**Hierarchy.** Grouping and nesting, not exact pixel position: is the thing the frame
groups together still grouped, does the visual weight (heading vs. body, primary vs.
secondary action) match.

**States.** A frame commonly shows one state — populated, logged in, no errors. Check
the states the frame does *not* show against the repository's own state conventions
(loading, empty, error) rather than against the frame, since the frame usually has
nothing to say about them.

**Tokens and naming.** The rendered feature's colors, spacing and typography resolve to
the same named tokens the frame's bound variables name — a value that happens to match
numerically but is hand-written rather than bound to the token is still a finding,
because it will drift the next time the token changes and this instance will not follow.

**Copy.** Matches the frame's text, or the repository's own translated/localized
equivalent of it — not a literal string match across languages.

## Citing a finding

Every finding cites the design (the frame's name or id, the image file, or the proposal's
entry) and, for a frame, the specific bound variable or node it compares against — the
same discipline `core:reviewer` holds for `file:line`. A finding that says "the button
color looks different" without naming the frame's token and the rendered value is not
actionable and should not be reported as one.

## What is NOT a finding

- A divergence a decision in the repository's decisions log, an ADR, or its own docs
  already explains. Cite the explanation rather than silently passing over the
  divergence — the reader should see that it was checked, not assume it was missed.
- A state the frame does not show at all — nothing to compare against.
- A screen or state SPEC Design's coverage lists as missing — the design has nothing to
  say about it.
- A responsive behaviour the frame, being one fixed size, cannot represent.
- Copy that is correctly localized to a language the frame was not authored in.
- A repository-documented substitution (a font fallback, an icon set swap) already
  recorded as a deliberate choice.
