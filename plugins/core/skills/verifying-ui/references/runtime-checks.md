# What to look at once the browser is attached

Read this when driving the loop in `SKILL.md`. It is the list of failures that are
invisible to a type-checker, a linter, a test suite and a diff reading, and visible in
about ten seconds to anything that can see the page.

**Pick from the diff.** Every item below costs a round trip. A change to a list owes you
the empty and the many-items cases; a change to a fetch owes you pending and failed; a
change to a button owes you neither. Running the whole list on a one-line change is how
this loop becomes something people turn off.

## One call carries the whole emulated state

Most techniques below reach for the same tool — `emulate` on Chrome DevTools MCP — and it
is **absolute, not incremental**. A parameter you leave out is actively reset, not left
alone, so setting the colour scheme after taking the network offline puts the network back.
Whatever does survive a call then persists on that page across navigations and reloads.

Two consequences, and the first is the one that bites:

- **A combined state is a single call carrying every parameter.** Offline *and* dark is one
  call naming both, never two calls.
- **Finish a check by resetting.** `emulate` with no parameters clears throttling, CPU,
  geolocation and user agent; `colorScheme: "auto"` returns the theme to the machine's.

The failure this prevents is the one the whole skill exists for. Force the error state,
switch the theme to check it in dark, and the network silently comes back — then `SKILL.md`
step 5 re-observes, photographs a fully loaded happy path, and reports a pass. Re-observing
without re-establishing the condition under test is not a second look; it is a first look at
a different page.

Playwright MCP does not have this tool. It exposes viewport resizing as its own tool and
settles colour scheme and throttling in launch configuration rather than per call, so check
what your server actually exposes before assuming a technique here is available.

## The states, in the order they are usually wrong

**Empty.** The most common runtime defect in a frontend diff, because the fixture data
the author was looking at was never empty. Zero items, zero results, a cleared filter.
Look for: a bare white area with no message, a heading with nothing under it, a table
that keeps its header and loses its body, a count reading "0 of 0".

**Error.** Rarer to reach, and much more likely to be broken, because it is the branch
nobody opened while writing. The specific failure worth hunting: **the error state
rendering as the empty state**, because both are "not the happy path" and one `v-if`
chain handles them in the wrong order. The user is told there is nothing here when in
fact the request failed, and retries nothing.

Reach it the way the code will actually fail. **A dead endpoint matches most bugs**: point
the request at a route that answers 500 or 404, and the component takes its status branch.
Offline emulation (`networkConditions: "Offline"`) is a *different* failure — the request
is rejected at the transport, so a component branching on `!response.ok` never reaches its
handler, and one that only catches a thrown request never reaches its status branch.
Verifying one and reporting the other is a false pass on precisely this defect class.

Offline also has an ordering that is easy to get backwards: with it set, the document itself
cannot load, so navigating afterwards returns the browser's own error page rather than the
app in its error state. Load the page, then go offline, then re-trigger the request from
within the page — and note the re-trigger needs an interaction tool, which is deliberately
not pre-approved and will prompt.

**Loading.** Two things, separately: does it appear at all, and is it the same *shape* as
what replaces it. A skeleton two rows tall standing in for six rows of content produces a
visible jump — the geometry, not the colour, is the thing to compare. Take the snapshot
mid-load — throttling (`networkConditions: "Slow 3G"`) makes a state that normally
flashes past long enough to observe, which is the only reliable way to catch it. Reset the
throttling afterwards, or every later observation is of a page still on a slow link.

**Overflow.** Long text with no spaces, a name three times longer than the design's, forty
items where the mock had three. Truncation that was never specified shows up here as a
horizontal scrollbar on the body or a container whose contents escape it.

## Beyond the states

**Dark mode.** Only if the repo actually supports it — check for a theme class, a
`prefers-color-scheme` rule or a `dark:` variant before treating this as in scope. Where
it is supported, `colorScheme: "dark"` on the emulation tool switches the preference
without touching the app or the machine — in the same call as anything else still being
emulated, or it clears it.
The recurring defect is a hard-coded colour in new markup that reads fine in one theme
and vanishes in the other.

**Narrow viewport.** Resize to a phone width and look for the body scrolling sideways.
A single wide table, a fixed-width container or an unwrapped flex row is the usual cause,
and none of it is visible at the default window size.

**Focus after a client-side navigation.** A route change that does not move focus leaves
it on the element that triggered it, or on `<body>`, so the next Tab starts from the top
of the old page and a screen reader announces nothing. Check it with the snapshot after
navigating — the focused node is in the tree. Same after a modal closes: focus belongs
back on whatever opened it.

**Scroll position.** A new route that keeps the previous scroll offset lands the user
halfway down a page they have not seen.

## The console is a source of findings, not noise

Read it every time. A page that looks correct and logs an error is a bug you have already
found, and it costs one tool call.

Treat as a finding: an uncaught exception, an unhandled promise rejection, a framework
warning naming a component in the diff (mismatched prop type, duplicate or missing keys,
a mutated prop), a hydration mismatch, a 404 for an asset the app actually needs, a CSP
violation.

Treat as noise: dev-server and HMR chatter, extension messages, deprecation notices from
dependencies the diff does not touch. Say once that you filtered them, rather than
listing them.

## The network answers questions the picture cannot

**The same request twice** on one page load. Two components fetching independently, an
effect without a guard, or — under server rendering — the server fetch not being handed
to the client. It looks like nothing; it doubles the load.

**A request that should have varied and did not**, or varied when it should not: the
cached response of one entity shown for another, or a refetch on every keystroke because
the key includes an unstable value.

**A waterfall** where requests could have been parallel: three sequential round trips
before anything renders is a perceived-performance defect that reads as "the app is slow"
and has a specific, visible cause.

**A request carrying something it should not** — a token in a query string, an internal
identifier, a payload larger than the page.

## Framework-specific criticals

A framework decides which of these symptoms is a critical and which is normal, and
applying the wrong pack's rules produces both false findings and missed criticals. Get the
pack list from `stack.packs` in the project facts and invoke each pack's engineering skill
for the diff you are looking at.

Be exact about what that buys you: what the packs carry is a **review checklist for
reading a diff**, not a second copy of this list. They name the defect and what makes it
wrong; this file is the only place that says how to see one in a running page. Where a
pack is silent on the runtime symptom, say what you observed and let the pack's rule
classify it — do not invent a framework rule here to fill the gap.

The one worth naming from `core`, because it is only ever visible in a browser: on a
server-rendered app, a **hydration mismatch** shows as a flash of different content
immediately after load plus a console warning, and it is the reason the console read is
not optional. `core` does not own that rule — the framework pack does, and the `nuxt`
pack's checklist points back here for it.

## What is NOT a finding

- A state this change cannot reach. Do not manufacture a scenario to have something to
  report.
- A pre-existing defect the diff did not introduce. Note it once as Info.
- A rendering difference that is a deliberate design decision, unless the repo documents
  the design and the page disagrees with it.
- Anything the picture merely suggests. "The spacing looks slightly off" without a
  measurement or a rule to compare it to is taste, and it crowds out the real findings.
- A console message from a dependency, the dev server, or a browser extension.
