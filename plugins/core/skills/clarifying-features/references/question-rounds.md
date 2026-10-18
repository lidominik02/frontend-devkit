# Question rounds — read before the first form of a round

## The form

- Every question goes through AskUserQuestion. One call takes one to four questions of two
  to four options each and adds a free-text "Other" answer itself (observed in Claude Code
  2.1.283).
- Ask what the triage below puts on a form, each round. More than four become consecutive
  forms, grouped by topic.
- The recommended option comes first, its label ending in "(recommended)". Every option's
  description states its consequence: what gets built, what it costs, what it rules out. A
  recommendation built on the user's own proposal says which part it keeps and what it
  changes.
- A fact is looked up, never asked. A question whose answer sits in the repository, the
  design or the API contract is a lookup not yet done, and so is an option that amounts to
  "let me look first". Do that lookup before the form, and ask only what it leaves open.
- Chat stays short, because the user often reads on a phone. Before a form, a few lines: what
  the last round settled and what this form decides. Long material goes into a file
  (PLAN.md's spec sections, a research note), and the question names the file.

An example. Header "Empty list". Question: "The design shows the list populated only. What
does an empty list show?" Options: "The shared empty-state component with a create action
(recommended)" — matches the closest existing list, no new component. "A single line of
text" — less to build, unlike every other list. "Ask the designer" — an `OQ<n>` line with
owner `designer`; the list task waits.

## Triage

A frontier item goes on a form when a task or another decision is built on it, when it is
expensive to reverse later — data, a public interface, a migration —, when it is a source
conflict or a business rule's reason, or when only a third party can decide it (an `OQ<n>`
line). Every other item takes a default — the repository's precedent, else a
reasonable-user default, said to be one — tagged ASSUMED in the spec sections. A fact, a
rule's reason and a conflict are never a default. There is no cap on the questions: what
carries weight is asked, however many there are.

**The veto form**, before the exit gate: one AskUserQuestion call, `multiSelect: true`,
listing each default as an option — its label the default, its description what it decides
and the precedent it follows — at most four options a question, more defaults in further
questions of the same call or a following one, grouped by topic. A checked default returns
to the frontier as a question; an unchecked one stays ASSUMED.

## Non-functional requirements

Once the must-haves are settled and before the extras, one AskUserQuestion call with one
`multiSelect: true` question per group, each option one item:

- **Load and data** — performance and data volume; concurrency.
- **Access** — permissions and security.
- **Users**, only for UI work — accessibility; internationalisation.
- **Operations** — logging and observability; migration and compatibility; rollout; error
  policy.

A checked item gets its own question in the next round. Every unchecked item is written in
Constraints as "<item>: not applicable".

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
| Third-party | What only a named owner can answer, and what it blocks | An `OQ<n>` line; when it blocks nothing, a working answer tagged ASSUMED until the owner confirms |

**The authority order.** A rule its owner confirmed, then a written spec, then the design,
then anything derived from them. A derived document — notes or a story written from the
design — never outranks its source. A conflict is always a question, and its answer gets a
DECISIONS.md entry.

## The cross-check probe

When the user states a fact about the current system — "the list already paginates", "the
API returns the total" — check it in the code or the research before building on it: it
holds → the spec cites the evidence, `path:line`; it does not → a question that quotes the
statement and shows the evidence, and the user decides; it cannot be checked → the spec
carries it tagged ASSUMED, with what would check it.

## The rationale probe

Every business rule gets its reason asked: what goes wrong without it, who asked for it,
whether it also covers the neighbouring case. The reason settles the edges the rule does not
name. It sits beside the rule in Business rules; a rule still without one is tagged ASSUMED
and listed at the exit gate.

## The extras block

Once the must-haves are settled, one block, apart from the must-have questions. Each extra —
UX polish, stricter validation, defensive handling — is one question: what it is, its cost
(the files it touches, a new component, a new API need), and whether the client would see
it. Options: include it, leave it out. An included extra becomes a DECISIONS.md entry and an
EXTRA-tagged success criterion; one the client would see also gets an `OQ<n>` line for
approval. An extra that needs the API is a contract gap too.

## The exit self-check

Walk PLAN.md's spec sections in order; each passes when an implementer could build every
task that touches it without asking anything:

- **Outcome** states what the user can do, and why it matters.
- **Sources** gives every source a location and who can confirm it, or says "none".
- **Constraints** names each limit, or says "none".
- **Non-functional requirements**: each item of the four groups is settled in Constraints,
  or written there as "not applicable".
- **Success criteria** are each numbered `SC<n>` and tagged, and every ASSUMED one was
  shown to the user.
- **User flow** has every step, including cancel and the way back.
- **Business rules** each carry a rationale, or are tagged ASSUMED.
- **States** settle transitions, errors and permissions — loading and empty only for UI
  work — or say "not applicable" and why.
- **Design** names type, location and coverage, each gap settled or held by an open question.
- **Global constraints** hold exact values only: no "reasonable", no "TBD".
- **Review focus** names the failure modes the rules and the states imply.
- **Architecture fit** gives every asset a path it was opened at; an asset beside an
  existing mechanism that does the same job is offered as a question with its evidence
  (`../../designing-architecture/references/codebase-design.md`, the guards).
- **Out of scope** and **Deferred** give each deferred item the trigger that brings it back.
- Every endpoint and field the feature needs exists, or has a CONTRACT-GAPS.md entry.

A section that fails puts its question back on the frontier.
