---
type: llm
weight: 1
---

Tests whether a form is modelled as state that can be submitted twice and can be rejected
by the server, rather than as values plus a validate function.

Passes if it does ALL of:
- Guards the submit handler itself against re-entry — an early return on an in-flight
  flag, or equivalent — not only a `:disabled` binding on the button.
- Clears that flag on both paths, in a `finally` or equivalent, so a rejected submit
  leaves a usable form.
- Shows no error on a field the user has not reached, and leaves no message standing on a
  field that has since been corrected. Per-field touched state is one way; validating on
  submit and clearing a field's error as it is edited is another. Score the behaviour, not
  the mechanism: a criterion that names one implementation fails a form reaching the same
  outcome by the other.
- Does something with the 422 body: at minimum, field-level messages land on the fields
  they belong to rather than in one banner or a toast.

Fails if it does ANY of:
- Expresses submit state only as `:disabled="loading"`.
- Leaves the in-flight flag set when the request rejects.
- Validates on `input` from the empty initial state, so the first character typed into an
  empty required field produces "this field is required".
- Validates only on submit and never re-checks, so the message stays after the user has
  fixed the field.
- Treats any non-2xx as one failure with the response body unread.
- Asserts the response shape with `as` instead of parsing it.

Note for scoring: the last fail line is already covered by the pack's boundary rule, so a
run tripping only that one says nothing about this phase. The first two lines are the
discriminator; score them before reading the rest.
