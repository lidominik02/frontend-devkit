# Review lenses

Each section below is pasted verbatim into one `lens <name>` dispatch, named by its heading.
A lens narrows what the reviewer looks for; its role's rules still hold — every changed file
ends in a finding or under Clean, every finding has a failure scenario, every cited line was
opened.

## spec

Axis: spec. Judge the change against the intent sources in the dispatch.

- Each requirement the sources state: implemented fully, partly, or not at all. A partial one
  is a finding that names the missing part.
- Behaviour no source asks for. A success criterion tagged EXTRA was asked for: the user
  accepted it, so building it is never scope creep.
- A requirement built differently from how its source states it — a wrong value, condition,
  order, copy or boundary.
- Where the sources are silent, judge by what a reasonable user of the feature would expect,
  and say that this is the basis. Anything set aside as outside the sources goes under
  Declined to judge, with the reason.
- Each state the SPEC's States section names — loading, empty, error, permission — has code
  that renders or handles it. A named state with no code path is a finding.
- Each Review Focus entry, in the SPEC and in the plan: find where the change handles it, or
  report that nothing does.

## correctness

Axis: quality.

- Read the whole enclosing function of every hunk, not only its changed lines.
- Removed behaviour: for each deleted or replaced line, name the invariant it enforced — a
  guard, a default, an ordering, a cleanup, an error path — and find the line that enforces
  it now. None found is a finding.
- Callers and callees of every changed function, type or shared component: a caller that
  relies on the old signature, return shape, timing or side effect.
- Asynchronous ordering: responses that can arrive out of order, work that outlives the
  component or request that started it, a missing await, two writers racing on one value.
- Stale state: a value captured once and read after its source changed; a cache or derived
  value that is not invalidated with its source.
- Error paths: a rejection nothing handles, a failure that leaves a loading flag, a lock or
  a half-written state behind.

## architecture

Axis: quality.

- Conventions: only a rule written in the repository's own CLAUDE.md or its ADRs. Quote the
  rule with its file and line, and the offending line; without both there is no finding.
- Reuse: an existing helper, composable, component or utility in the repository that does
  what the change writes anew. Name it with its path.
- Altitude: a special case added to shared code for one caller — a flag, a branch on who is
  calling — where the fix belongs in the caller or at a lower layer. Name the right depth.
- The deletion test, for what the change adds — a wrapper that only forwards, an option
  nobody passes, a parameter every caller sets the same way — and for each module it adds or
  reshapes. The deletion test: removing a deep unit spreads its complexity across its
  callers; removing a shallow one loses nothing anyone asked for. Give each shallow one the
  concrete cost of keeping it.

## framework

Axis: quality.

- The framework checklists: for each `stack.packs` entry, the review checklist its
  engineering skill points to, loaded as your role describes and applied item by item to
  every changed file rather than sampled. A later pack wins a conflict, its "not a finding"
  list included.
- Rules that hold in any framework and can be checked in the code:
  - Accessibility composition: each interactive element has a role that matches its
    behaviour and an accessible name; each form control has an associated label; every id
    an ARIA attribute references exists.
  - URL and query composition: path segments and query values encoded; parameters joined
    without a doubled or missing separator; no raw value concatenated into a URL.
  - Time: the current clock read where a stored timestamp is meant, such as a record's
    creation date rendered from the time of rendering.
  - Translations: a key added, renamed or removed in one locale file matches in every other
    locale file, and each key the code renders exists.
  - Stories: where the repository keeps stories, a component whose props, slots, events or
    states changed has stories that show the change.

## tests and claims

Axis: quality.

- A test that cannot fail on the behaviour it names: it asserts on a mock it set up, on a
  value it computed itself, or on nothing, and would still pass with the change reverted.
- A claim the code does not bear out: a comment, doc or report that states behaviour the
  code does not have — "handles X", "never Y", "covered by tests".
- A silent fallback nobody asked for: a caught error turned into a default value, an empty
  list or a success, where the intent calls for the failure to show.
