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

**Never require a project-local design skill**: this check drives the design tool's own MCP
read tools directly and must work in a repository that has none.

Establish the design from, in order: PLAN.md's Design section — the source's type, its
location or link, and its coverage — with the task's Design field for the exact screens and
states the task built; else a frame id, link or file the approved test list names; else ask
rather than guess. **Never invent a screen** — a case with no reachable design is a skip for
that case specifically, named in the report.

**The source's type decides what can be compared.** Token alignment needs bound variables,
so it applies only to frames read through the design tool:

- **Frames read through the design tool** — everything under "What to compare".
- **Screenshots, or an export under `temp/<feature>/design/`** — presence, hierarchy,
  states and copy, against the images.
- **A proposal the user approved** — the proposal file Design names: presence, the states
  it lists, and the tokens and components it names.

**Write tools stay denied regardless of what is reachable.** This check reads a design; it
never edits one.

## Which tools are removed

`disallowed-tools` on `SKILL.md` withdraws twelve write- or execution-shaped tools from the
pool outright, observed under the `figma` server key on Claude Code 2.1.278. Each is written
`mcp__*__<tool>`: on 2.1.283 `mcp__figma__use_figma` did not block the same tool on a server
keyed `claude_ai_Figma`, while `mcp__*__use_figma` did and left `get_screenshot` callable. A
wildcard in the tool segment would withdraw the read tools too, so it stays wrong here.

**A design tool's default read output is often framework-opinionated** — a generated code
sample may default to a stack this repository does not use. Read the structured data (node
names, bound variables, hierarchy) rather than any generated code sample.

## What to compare

**Presence.** Every element the frame shows exists in the rendered feature, and nothing the
frame does not show appears unexplained. A missing element is usually a finding; an added
one needs a reason before it counts as one.

**Hierarchy.** Grouping and nesting, not exact pixel position: is what the frame groups
still grouped, does the visual weight (heading vs. body, primary vs. secondary) match.

**States.** A frame commonly shows one state. Check the states it does *not* show against
the repository's own conventions (loading, empty, error), not against the frame.

**Tokens and naming.** Colors, spacing and typography resolve to the named tokens the
frame's bound variables name — a value that matches numerically but is hand-written is still
a finding, because it will not follow the next token change.

**Copy.** Matches the frame's text, or the repository's localized equivalent of it.

## Citing a finding

Every finding cites the design (the frame's name or id, the image file, or the proposal's
entry) and, for a frame, the bound variable or node it compares against — the same
discipline `core:reviewer` holds for `file:line`.

## What is NOT a finding

- A divergence the repository's decisions, an ADR, or its docs already explain — cite the
  explanation, so the reader sees it was checked.
- A state the frame does not show at all, or a screen Design's coverage lists as missing.
- A responsive behaviour a fixed-size frame cannot represent.
- Copy correctly localized to a language the frame was not authored in.
- A repository-documented substitution (a font fallback, an icon set swap).
