# Design intent, never pixel parity

Read this while running the design-intent cases in `run` mode.

**Why never pixel parity.** A screenshot diff against a design frame reports every
deliberate divergence as a defect — a repository that intentionally departs from its
frames (a chosen font substitution, a responsive reflow the frame never showed, a
content-driven layout change) fails a pixel comparison for doing exactly what it meant
to do. This check compares *intent*, not pixels: presence, hierarchy, states, token and
naming alignment, and copy. A divergence is a finding only when nothing in the
repository's own decisions, ADRs or docs explains it.

## Reaching the frame

**Never require a project-local design skill.** This check drives the design tool's own
MCP read tools directly and must work in a repository that has none. Where a project
does have its own design skill, detect it via `project-facts`'s `designReference` and
use it as a bonus source of context — which frame is authoritative, what the naming
convention is — never as a prerequisite.

Establish the frame from, in order: a frame id or link the approved test list names,
else the feature's own story or plan if it names one, else ask rather than guess which
frame this feature corresponds to. **Never invent a screen** — a case with no reachable
frame is a skip for that case specifically, named in the report, not a case verified
against a frame you assumed.

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

**Under any other key every one of these names misses**, the same caveat
`verifying-ui`'s own reference states for its two servers: a key sanitised from something
other than `figma` builds a different tool prefix, the removal matches nothing, and the
whole server stays in the pool with nothing here to say so. If a design tool is attached
under a non-standard key, say so plainly and do not rely on this list.

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

Every finding cites the frame (its name or id) and the specific bound variable or node
it compares against — the same discipline `core:reviewer` holds for `file:line`. A
finding that says "the button color looks different" without naming the frame's token
and the rendered value is not actionable and should not be reported as one.

## What is NOT a finding

- A divergence a decision in the repository's decisions log, an ADR, or its own docs
  already explains. Cite the explanation rather than silently passing over the
  divergence — the reader should see that it was checked, not assume it was missed.
- A state the frame does not show at all — nothing to compare against.
- A responsive behaviour the frame, being one fixed size, cannot represent.
- Copy that is correctly localized to a language the frame was not authored in.
- A repository-documented substitution (a font fallback, an icon set swap) already
  recorded as a deliberate choice.
