# Question rounds

Read this before the first form of a round.

## The form

- Every question goes through AskUserQuestion. One call takes one to four questions of two
  to four options each and adds a free-text "Other" answer itself (observed in Claude Code
  2.1.283).
- Ask the whole frontier each round. More than four open questions become consecutive
  forms, grouped by topic.
- The recommended option comes first, its label ending in "(recommended)". Every option's
  description states its consequence: what gets built, what it costs, what it rules out. A
  recommendation built on the user's own proposal says which part of that proposal it
  keeps and what it changes.
- A fact is looked up, never asked. A question whose answer sits in the repository, the
  design or the API contract is a lookup not yet done, and so is an option that amounts to
  "let me look first" — check the design, read the code. Do that lookup before the form,
  and ask only what it leaves open.
- Chat stays short, because the user often reads on a phone. Before a form, a few lines: what
  the last round settled and what this form decides. Long material — a drafted section, the
  evidence behind a contradiction, a proposal's detail — goes into a file (the SPEC draft, a
  research note), and the question names the file.

An example question, one of three on a form. Header "Empty list". Question: "The design
shows the list populated only. What does an empty list show?" Options: "The shared
empty-state component with a create action (recommended)" — consequence: matches the closest
existing list, no new component. "A single line of text" — consequence: less to build,
unlike every other list. "Ask the designer" — consequence: an OPEN-QUESTIONS.md entry with
owner `designer`, and the list task waits for the answer.

## Question kinds

| Kind | Phrase it as | The recommended option draws on |
| --- | --- | --- |
| Scope | Whether a named case is in or out, the edge stated | What the sources state; else the smallest scope that meets the outcome, the rest proposed as Deferred with its trigger |
| Behaviour | A concrete scenario with its input: "When the user does X with Y, what happens?" | Repository precedent: how the closest existing feature behaves, cited by path |
| Rule rationale | "Why must X be Y — what goes wrong otherwise?" | The reason the source implies. With none: "Unknown — ask <owner>", and the rule stays ASSUMED |
| State | One state of one screen: loading, empty, error, permission, success | The repository's own convention for that state, cited by path |
| Conflict | Both sources quoted, each with its location | The authority order below |
| Gap | What no source covers: a missing state, a validation limit, an edge case | Repository precedent; else a reasonable-user default, said to be one |
| Extra | One extra, its cost, and whether the client would see it | Repository precedent and the cost; the user decides each |
| Third-party | What only a named owner can answer, and what it blocks | An OPEN-QUESTIONS.md entry; when it blocks nothing, a working answer tagged ASSUMED until the owner confirms |

**The authority order.** A rule its owner confirmed, then a written spec, then the design,
then anything derived from them. A derived document — notes or a story written from the
design — never outranks its source. The artifact contract states it as DECISIONS rule 4
(`../../planning-features/references/artifacts.md`); a conflict is always a question, and
its answer gets a DECISIONS.md entry.

## The cross-check probe

When the user states a fact about the current system — "the list already paginates", "the
API returns the total" — check it in the code or the research before building on it:

- it holds — the SPEC cites the evidence, `path:line`;
- it does not — a question that quotes the statement and shows the evidence, and the user
  decides which holds;
- it cannot be checked — the SPEC carries it tagged ASSUMED, with what would check it.

## The rationale probe

Every business rule gets its reason asked: what goes wrong without it, who asked for it,
whether it also covers the neighbouring case. The reason is what settles the edges the rule
does not name. The answer sits beside the rule in SPEC Business rules; a rule still without
one is tagged ASSUMED and listed at the exit gate.

## The extras block

Once the must-haves are settled, one block, apart from the must-have questions. Each extra —
UX polish, stricter validation, defensive handling — is one question, with:

- what it is, in one line;
- its cost: the files it touches, a new component, a new API need;
- whether the client would see it.

Options: include it, leave it out. An included extra becomes a DECISIONS.md entry and an
EXTRA-tagged success criterion. One the client would see also gets an OPEN-QUESTIONS.md entry
for approval, owner `client` or `product owner`. An extra that needs the API is a contract
gap too.

## The exit self-check

Walk the SPEC sections in the artifact contract's order and ask of each: could an implementer
build every task that touches it without asking anything? A section passes when:

- **Sources** — every source has a location and who can confirm it, or the section says
  "none".
- **Outcome** — states what the user can do, and why it matters.
- **Constraints** — names each limit, or says "none".
- **Success criteria** — each is tagged, and every ASSUMED one was shown to the user.
- **User flow** — every step, including cancel and the way back.
- **Business rules** — each has its rationale, or is tagged ASSUMED.
- **States** — loading, empty, error and permission are each settled, or "not applicable"
  with the reason.
- **Design** — type, location and coverage are named; each gap a partial coverage names is
  settled by a decision or held by an open question.
- **Global Constraints** — every value is exact: no "reasonable", no "TBD".
- **Review Focus** — names the failure modes the rules and the states imply.
- **Architecture fit** — every asset has a path, and each was opened, not inferred from its
  name.
- **Contract** — every endpoint and field either exists or has a CONTRACT-GAPS.md entry.
- **Out of scope** and **Deferred** — each deferred item has the trigger that brings it back.
- **Verification seams** — every success criterion has its observation.

A section that fails puts its question back on the frontier. A section with nothing to hold
says "none".

## The questionnaire file

`temp/<feature>/planning/questions-for-<owner>.md`, one per owner — `product-owner`,
`designer`, `backend`, `client` — offered when that owner has open questions. It is written
for a reader who has not seen the conversation:

```
# Questions for <owner> — <feature>

<two or three sentences: what the feature is, in that owner's terms>

1. <the question>
   Context: <what raised it — the source, the screen, the rule>
   Proposed: <the options considered, the recommended one first> | none
   Blocks: <what cannot be built until it is answered>
```

The user decides whether and how it reaches the owner. An answer that comes back becomes a
DECISIONS.md entry, its OPEN-QUESTIONS.md entry gains `Answered: D<n>`, and the same write
moves that entry to planning/archive/OPEN-QUESTIONS.md.
