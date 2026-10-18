# Deriving the test list

Read this while running `plan` mode.

## From a written source

An acceptance criterion is a testable claim the source makes, stated or implied — "a
customer can request a refund within 30 days of the order" is one; "the flow should feel
fast" is not, because nothing in this skill can verify a feeling. Extract the criteria
first, as a flat list, before mapping any cases to them — a criterion discovered while
writing cases is a sign the extraction pass was too shallow. PLAN.md's Success criteria
are that list already: take each as written, with its tag.

Per criterion, map:

- **Positive** — the criterion holds under ordinary conditions. Usually one case.
- **Negative** — the criterion is violated, and the system correctly rejects or reports
  it rather than silently succeeding. "A refund requested on day 31 is declined" is a
  negative case; "the refund button is clicked twice" is not a negative case for a
  30-day criterion, it belongs to a different one (idempotency) if the source raises it.
- **Edge cases that actually matter for this criterion** — not a fixed quota. A boundary
  value (exactly day 30), a zero/empty state (no orders to refund), a conflicting-state
  case (the order was already refunded another way). An edge case that cannot fail
  differently from the positive case is padding — cut it.

## Without a written source

Derive from PLAN.md's tasks and the diff instead: the acceptance criteria the plan's tasks
state become the criteria, and the diff's actual behaviour is what the cases check against.
**Say this at the top of the list** — "no written requirement found; criteria derived from
PLAN.md's tasks and the diff" — because a list built this way is verifying that the code
matches the plan, not that the plan matches what the feature is for, and a reader must
know which claim they are looking at.

## Naming the check

Every case gets exactly one of:

- **browser** — anything about what renders, a runtime state, an interaction.
- **design intent** — anything about matching the design's presence, hierarchy, states,
  tokens, naming or copy.
- **Storybook** — anything about a shared component's story existing and rendering
  correctly in isolation, independent of the feature's own page.
- **user only** — nothing here can check it: does the copy read naturally, does the
  feature actually solve the business problem, anything requiring a judgment no
  automated check makes. Naming this honestly is not a gap in the list — a case that
  claims a check that cannot verify it is worse than one that admits it needs a human.

## The list format

```
## Test list: <feature>

<one line stating the source: "from temp/<feature>/PLAN.md", the requirement
files it came from, or "no written requirement found; derived from PLAN.md's tasks and
the diff">
<each conflict between sources, when there is one — see below>

### SC<n> <criterion, stated as a claim> — <SAID | EXTRA | ASSUMED — not confirmed>
- TC<n> · Positive: <case> — verified by: <browser | design intent | Storybook | user only>
- TC<n> · Negative: <case> — verified by: <…>
- TC<n> · Edge: <case> — verified by: <…>
- TC<n> · Edge: <case> — verified by: <…>    (only the ones that matter for this criterion)

### Beyond the criteria: <the Review focus entry or Runtime-only item, with its source>
- TC<n> · <case> — verified by: <…>
```

`TC<n>` numbers the cases through the whole list, and each case names its criterion's
`SC<n>` by the heading it sits under. A criterion from a source without `SC<n>` ids heads its
section with the claim alone, and one without tags carries no tag. A Review focus entry or a
Runtime-only item that fits a criterion goes under it instead of its own heading.

## When sources disagree

**PLAN.md's spec sections and its Tasks** disagreeing is a plan defect: the tasks are built
from the spec alone, so the spec wins. Name the conflict at the top of the list, with what
each says, and derive the cases from the spec.

**A written requirement source and PLAN.md's Tasks**, when there are no spec sections, disagreeing is the
same plan defect: the source is the closer statement of what the feature is for, and a
plan can drift from it during implementation without anyone updating either. The source
wins; name the conflict at the top of the list the same way, and derive the cases from the
source.

**Two requirement sources** disagreeing is not settled here. Name the conflict at the top
of the list, each source quoted with its location, with the recommendation the authority
order in `../../clarifying-features/references/question-rounds.md` gives.
The user decides at approval.
