---
name: designing-architecture
description: >-
  Settles an architectural question — a refactor, a structural decision, the foundations
  of a new project, an improvement to existing code — from what the codebase already has:
  two or three options with their cost, a recommendation, the user's decision, a record,
  and a handoff to clarifying-features to build it. With no question, surveys the codebase
  for at most five candidates and stops. Writes no code. Use when the user types
  /core:designing-architecture with a question such as "should this be a composable or a
  util", "where does this belong", "how should we structure this", "is this abstraction
  worth it", or with none to ask "what here is worth restructuring".
disable-model-invocation: true
argument-hint: "[question]"
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/project-facts.mjs) Bash(git log *) Bash(git rev-parse *) Bash(git check-ignore *) Read Grep Glob Agent Skill AskUserQuestion
---

You settle architectural questions. You do not build the answer.

Every architectural request — a refactor, a decision about something new, the foundations
of a new project, an improvement to existing code — runs the same loop: the question, the
evidence, two or three options with their cost, a recommendation, the user's decision, the
record, the handoff. Only where the question comes from differs. The lifecycle builds the
chosen design: you write no code, and the approved record becomes clarifying-features'
source.

Before the survey or step 2, whichever comes first, read `references/codebase-design.md`.
Its terms are for your reasoning; its `## Guards` hold for the whole run, and its
`## Words for the user` decides the words of every form, option and record — the
project's and the framework's, never the reference's.

Every form follows "The form" in `../clarifying-features/references/question-rounds.md`: at
most four questions, the recommended option first, each option's consequence stated, chat
short. Cancel at any form stops the run with nothing written beyond what the user already
approved; a survey's SURVEY.md, written before its form, stays. Every `temp/` path below
is under the repository root that `git rev-parse --show-toplevel` prints; outside a git
repository, the working directory.

## With no question

No question, or text that names no particular decision — "what is worth restructuring",
"where is the structure costing us": there is no question yet. Read `references/survey.md`
and run the survey it describes. It writes at most five candidates to
`temp/architecture/<slug>/SURVEY.md`, lists them in chat, and stops with a form. The
candidate the user picks becomes the question, and the loop starts at step 1. Zero
candidates, or the user ending the run, stops here.

## 1. The question

State the question in one sentence, then its framing: what prompted it, what is in and out
of it, and what a good answer must hold. When the question names a feature, or `temp/`
holds feature folders, ask whether the decision belongs to one of them, "none" included.

One form:

- **The question** — "This is the question (recommended)", "Change it", "Survey the
  codebase instead". A change restates the question and asks again; the survey runs as
  "With no question" describes.
- **The feature**, when there is a choice — each feature folder, and "None".
- **Outside research** — how others solved it, from framework docs, open source and the
  literature. "Only if the codebase has no precedent (recommended)", "Research it either
  way".

Stop: the user cancels.

## 2. The evidence

Facts are looked up, never asked.

- **The existing mechanism first.** Search for a helper, composable, component, utility or
  pattern that already does the job, as the guards require. Show each query and the
  call-site count of every match, and open each match before counting it as one. A
  question about an existing pattern states what that pattern is for before anything
  argues against it.
- **The design**, where one exists: the files under `temp/<feature>/design/` and the
  design tool's read tools in this session's own tool list. It shows what later screens
  will need.
- **The PM's spec**, where one exists: the feature's `SPEC.md` and `requirements/`, and the
  story at `userStoryPath` from `node "${CLAUDE_PLUGIN_ROOT}/scripts/project-facts.mjs"`.
- **The project's nature**: its `CLAUDE.md`, README and manifests — what kind of
  application it is, how long it is meant to live, how much is still to be built.
- **How the project decided before**: its decision records and architecture notes. An
  accepted decision is a constraint; reopening it is a question for the user, never an
  assumption.
- **The history** of the code in question, through `git log`: what changed together, and
  how often.
- **Outside research** runs when the user asked for it in step 1, or when the codebase has
  no precedent for the question. Dispatch one agent of the built-in `Explore` type where
  the host offers it (observed in Claude Code 2.1.283), else `general-purpose` told to stay
  read-only; `model: sonnet`. Primary sources first — a framework's own docs or its
  `llms.txt`. Every claim it returns carries its URL.

Then say in a few lines what the evidence settled, with the counts.

## 3. The options

Two or three options, each with:

- what it is, and what existing code it reuses or extends;
- the call sites and files it touches, counted;
- its cost — to build, and to carry: what every later change has to know;
- what it rules out.

A decision is **hard** when it is hard to reverse, when it affects more than one module,
or when the user asks for the full treatment. For a hard decision, read
`references/alternatives.md`: three agents draft the alternatives in parallel, and you
compare their answers in its table. Otherwise draft the options yourself, and make them
substantially different rather than variations of one idea.

- **A future need is flagged, never built in silently**: an option that adds an
  abstraction for a need nobody has stated, or one with a single consumer, is labelled a
  proposal as the single-consumer guard requires.
- **Names follow the repository's conventions**, as the guards require — a composable
  holds reactive state, a util does not.
- **An improvement outside the question is parked**, and goes under Parked in the record.

## 4. The recommendation

Recommend one option: why it wins on the evidence, what it costs, and what would make you
reconsider. A recommendation that is not the smallest change says what the smaller one
would have left unsolved.

Write the detail to a draft outside the repository: `ARCHITECTURE-<slug>.md` in the
session's scratchpad directory, else the system temp directory, in step 6's shape — the
question, the evidence, the options with the comparison table on a hard decision, the
recommendation, and "Decision: pending". In chat: one line per option, the recommendation,
and the draft's path.

## 5. The decision

One form, naming the draft's path. The recommended option comes first, each option's
description its consequence: what gets built, what it costs, what it rules out. The
free-text answer asks for more — more evidence returns to step 2, another option to step 3
— the draft is updated, and the form comes again.

Stop: the user cancels. The draft stays in the scratchpad; nothing is written into the
repository or `temp/`.

## 6. The record

The decided record is written from the draft, with the Decision, Rejected and Parked
sections filled, to `<record dir>/ARCHITECTURE-<slug>.md`:

- a decision tied to a feature: `temp/<feature>/planning/`;
- otherwise `temp/architecture/<slug>/`, the survey's folder when the question came from
  one. When `git check-ignore -q temp/` exits 1, say once that `temp/` is not gitignored.

```
# <the question, as one line>

## Question
<the question and its framing>

## Evidence
<what was searched — each query with its call-site counts — and what the design, the spec,
the project's nature, the history and any research showed; every claim with its path:line
or URL>

## Options
<each option: what it is, what it reuses, what it touches, its cost to build and to carry>

## Recommendation
<the option recommended, and why>

## Decision
<the option chosen, by the user, on YYYY-MM-DD, and its rationale>

## Rejected
<each option not chosen, and why — the reason a later reader would otherwise re-propose it>

## Parked
<improvements outside the question, each with where it was seen; or "none">
```

The record stands alone for a reader who has only the repository: no session narrative,
no "we discussed", and no attribution to another project or codebase.

Then look at how the project records decisions — a decision-record folder, an architecture
document, a decisions section in its `CLAUDE.md` — and ask whether to write this decision
into the repository too, and where. The form in step 7 carries that question. Nothing is
written into the repository unasked; a refused location leaves the record in `temp/` only.
A location the user picks is written in that location's own format.

## 7. The handoff

One form, two questions:

- **The repository** — the project's own location for decisions, recommended when it has
  one; "Another place" (named in the free-text answer); "Keep it in temp/ only".
- **Build it** — "Build it through clarifying-features, `<route>` route (recommended)",
  "Stop here". The route follows the size rule in clarifying-features' Round 1: `bounded`
  for one surface, a few files, no new API need and no open product question; `feature`
  for anything larger. Say the route and its reason.

Write the repository record if one was chosen. On "Build it", call the Skill tool with
"core:clarifying-features", naming the record's path as the source and the route. A
decision tied to a feature that already has a `SPEC.md` goes in as a gap handed back
instead: `gap`, for that feature. On "Stop here", name the record's path and stop.

## What this must NOT do

- Write or change code, or start the build itself. The record is the deliverable; the
  lifecycle builds it.
- Restructure, extract or redesign anything the user did not ask about. Name it and park
  it.
- Propose a new mechanism without first showing the search for an existing one.
- Build an abstraction for a future need, or one with a single consumer, without flagging
  it as the single-consumer guard requires.
- Write into the repository — a decision record, a glossary, an architecture document —
  without the user choosing the location.
- Run a project's own detector tools without the per-run approval `references/survey.md`
  describes.
- Use the reference's terms in text written for the user.
- Commit, stage or touch the index.
- Carry a fact about an individual repository or a client. A repo's conventions live in
  its own files, read at the moment of use.
