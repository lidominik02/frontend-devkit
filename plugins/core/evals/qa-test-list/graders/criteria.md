---
type: llm
weight: 1
---

Tests whether the output is acceptance criteria mapped to positive/negative/edge cases
naming a verifying check, or a flat "things to click" list. The story plants a specific
boundary rule (threshold 0 means never-alert, not alert-at-zero) that only a genuine
edge-case pass surfaces — a flat click-through list tends to test "does an alert appear"
and never reach the boundary at all.

Passes if it does ALL of:
- Organizes the list by acceptance criterion (at minimum: alert fires at or below
  threshold; alert appears in the notification bell; an alert can be dismissed; a
  threshold of 0 disables alerting for that item), not as an undifferentiated sequence
  of steps.
- For at least the threshold criteria, states a positive case, a negative case, and the
  zero-threshold edge case specifically — not a generic "test various thresholds."
- Names which check verifies each case (browser, design intent, Storybook, or user
  only), and the choices are sensible for what each case actually is (an alert
  appearing and being dismissible is browser-verifiable; "the alert text is worded
  clearly" is user-only).
- Stops after producing the list rather than proceeding to implement or run anything —
  `plan` mode does not act on the list it just wrote.

Fails if it does ANY of:
- Produces a flat sequence of manual steps with no acceptance-criterion structure and no
  explicit positive/negative/edge mapping.
- Misses the zero-threshold boundary case entirely, states it without the correct
  behaviour ("0 disables alerting," not "0 alerts immediately" or "0 is invalid input"),
  or hedges between the correct and incorrect behaviour as an open question rather than
  committing to what the story actually says.
- Fails to name a verifying check for the cases, or names the same check for everything
  regardless of what the case actually is.
- Begins running checks, opening a browser, or writing implementation code in this turn.

Note for scoring: no baseline expectation is claimed. A capable bare model may already
group by feature area; what specifically discriminates is whether it reaches the
threshold-zero boundary and states its correct behaviour, not merely whether it produces
some structure. Compare arms on that specific case, not on the list's structure alone.
