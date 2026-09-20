# Deriving the test list

Read this while running `plan` mode.

## From a story

An acceptance criterion is a testable claim the story makes, stated or implied — "a
customer can request a refund within 30 days of the order" is one; "the flow should feel
fast" is not, because nothing in this skill can verify a feeling. Extract the criteria
first, as a flat list, before mapping any cases to them — a criterion discovered while
writing cases is a sign the extraction pass was too shallow.

Per criterion, map:

- **Positive** — the criterion holds under ordinary conditions. Usually one case.
- **Negative** — the criterion is violated, and the system correctly rejects or reports
  it rather than silently succeeding. "A refund requested on day 31 is declined" is a
  negative case; "the refund button is clicked twice" is not a negative case for a
  30-day criterion, it belongs to a different one (idempotency) if the story raises it.
- **Edge cases that actually matter for this criterion** — not a fixed quota. A boundary
  value (exactly day 30), a zero/empty state (no orders to refund), a conflicting-state
  case (the order was already refunded another way). An edge case that cannot fail
  differently from the positive case is padding — cut it.

## Without a story

Derive from the phase plan and the diff instead: what the plan says the phase must do
becomes the criteria, and the diff's actual behaviour is what the cases check against.
**Say this at the top of the list** — "no user story found; criteria derived from the
phase plan and the diff" — because a list built this way is verifying that the code
matches the plan, not that the plan matches what the feature is for, and a reader must
know which claim they are looking at.

## Naming the check

Every case gets exactly one of:

- **browser** — anything about what renders, a runtime state, an interaction.
- **design intent** — anything about matching a design frame's presence, hierarchy,
  states, tokens, naming or copy.
- **Storybook** — anything about a shared component's story existing and rendering
  correctly in isolation, independent of the feature's own page.
- **user only** — nothing here can check it: does the copy read naturally, does the
  feature actually solve the business problem, anything requiring a judgment no
  automated check makes. Naming this honestly is not a gap in the list — a case that
  claims a check that cannot verify it is worse than one that admits it needs a human.

## The list format

```
## Test list: <feature>

<one line stating the source: "from temp/<feature>/user-story.md" or "no story found;
derived from the phase plan and the diff">

### <Criterion, stated as a claim>
- Positive: <case> — verified by: <browser | design intent | Storybook | user only>
- Negative: <case> — verified by: <…>
- Edge: <case> — verified by: <…>
- Edge: <case> — verified by: <…>    (only the ones that matter for this criterion)
```

## When the story and the plan disagree

The story wins — it is the closer statement of what the feature is actually for, and a
phase plan can drift from it during implementation without anyone updating either. Record
the conflict where the plan's own decisions log lives, with what the plan said and what
the story said, rather than silently deriving cases from one and ignoring the other.
