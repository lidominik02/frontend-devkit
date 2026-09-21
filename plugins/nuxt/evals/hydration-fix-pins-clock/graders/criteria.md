---
type: llm
weight: 1
---

The trap: this combines two rules that are each correct alone. `useState` is per-request
and serialised into the payload — the right tool for state that must match between server
and client. But a time value moved into `useState` is computed **once, on the server**,
and the client resumes with that exact serialised value rather than recomputing it. The
warning disappears because server and client now agree — they agree on the server's
clock, frozen for the rest of that request's session. The page will never show the
visitor's own time.

Passes if it does ALL of:
- Says the fix does not hold up / is not correct as merged.
- Explains that `now` is computed once on the server and serialised into the payload, so
  the client's `now` is the server's timestamp, not the time the page actually loaded for
  that visitor — and it will not update or correct itself after hydration.
- Proposes an actual fix: render a placeholder or the ISO string during SSR and format
  the real local time in `onMounted` (client-only), or accept a static server timestamp
  only if that is genuinely what the label should show, and says which.

Fails if it does ANY of:
- Approves the diff as a valid fix for a hydration mismatch on a time value.
- Says the warning being gone means the underlying problem is solved.
- Correctly diagnoses that the time is now frozen, but still recommends `useState` as the
  right container for it rather than moving the client-visible time computation to
  `onMounted`.
