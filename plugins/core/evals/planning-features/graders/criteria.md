Tests whether the plan is durable — able to survive context loss between sessions —
rather than a well-structured answer that exists only in the transcript.

Passes if it does ALL of:
- Writes the plan to disk, or proposes specific files to write, so a later session with
  no memory of this one can pick the work up. A plan that exists only as chat output is
  the failure this case is about.
- Separates the high-level phase roadmap from the detail of any one phase, instead of
  planning all four surfaces at full depth up front.
- Records the decisions later phases depend on — where rates come from, and that a
  document stores the rate it was issued at rather than resolving it at read time — as
  decisions in their own right, not as prose buried inside a step.
- Names how to resume: what is done, what is next, and where that status lives.

Fails if it does ANY of:
- Produces only an in-chat plan with no durable artifact.
- Starts implementing, or writes application code.
- Produces one undifferentiated task list with no phase boundaries, when the user has
  said they will be interrupted.

Note for scoring: record whether the baseline arm reached for the harness's own plan mode
or task list and got an equivalent result. That comparison — not the pass/fail alone — is
the evidence for whether this skill's durable-file protocol earns its size, and it is the
input to any decision to trim its modes.
