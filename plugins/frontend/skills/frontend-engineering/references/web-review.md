# Web review checklist

## Contents
- Blocking (Critical)
- Warning

Read this before a review verdict, whichever set is selected, together with that set's
review checklist. It holds the findings that do not depend on the framework, so no set's
checklist repeats them.

## Blocking (Critical)

**No cleanup.** An interval, listener, observer or subscription started in a component
with no matching teardown.

**Unvalidated external input crossing into typed code.** An API response, route param or
form value asserted with `as` instead of parsed. `as` is a claim, not a check.

## Warning

- A loading skeleton whose geometry differs from the loaded content, causing layout
  shift on every load.
- An empty state that is indistinguishable from a loading state.
- A hand-written type or enum duplicating something that is generated.
- A hand-edited generated file — the change disappears on the next generation run.
- A `data-testid` used where an accessible role or label would have worked.
- Visual change with no dark-mode consideration, in a repo that supports it.
- New interactive markup with no keyboard path, or a client-side navigation that leaves
  focus stranded on the old view.
