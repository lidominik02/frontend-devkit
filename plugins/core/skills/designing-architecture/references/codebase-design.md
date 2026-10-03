# Codebase design

Shared terms for judging structure: whether something is worth extracting, where it belongs,
whether an abstraction earns its keep, and which of several designs is better. Each term names
its standard source. The terms are for reasoning; the guards below hold for anyone who uses
them.

This reference drives nothing. Whoever reads it flags a candidate and offers it to the user,
with its evidence and its cost, and never restructures, extracts or redesigns unasked.

## Worth extracting

- **Rule of three** — Don Roberts, via Martin Fowler, *Refactoring*. Tolerate the second copy;
  consider extracting at the third, when the shared shape is visible rather than guessed. A
  heuristic, not a threshold: two copies can already justify a proposal, and three can still
  be coincidence.
- **DRY as knowledge** — Andy Hunt and Dave Thomas, *The Pragmatic Programmer*. Every piece of
  knowledge has one authoritative place. It argues for extraction when two places encode the
  same rule and must change together; it says nothing about two places whose text merely
  matches.
- **YAGNI** — Kent Beck, *Extreme Programming Explained*; Martin Fowler, "Yagni". Do not build
  for a presumed future feature: it costs the build, the delay, the carrying and the repair
  when the guess is wrong. It argues against an abstraction made for a need nobody has stated.
  It does not argue against keeping code easy to change, which is what makes YAGNI safe.
- **The wrong abstraction** — Sandi Metz, "The Wrong Abstraction". Duplication is far cheaper
  than the wrong abstraction. A shared piece that grows a parameter or a branch for each new
  caller has stopped fitting; inlining it back into its callers is a valid fix, not a
  regression.

## Fits the structure

- **Coupling and cohesion** — Stevens, Myers and Constantine, "Structured Design". Things that
  change together belong together; things that change apart stay apart. Low coupling between
  units and high cohesion within one argue for a boundary; a unit whose parts never change
  together argues for splitting it.
- **Connascence** — Meilir Page-Jones, *What Every Programmer Should Know About
  Object-Oriented Design*. Coupling made checkable: two pieces are connascent when changing
  one forces a change in the other — by name, type, meaning, position or algorithm. Stronger
  kinds should stay close together; across a boundary, prefer the weakest kind, such as a
  shared name over a shared magic value.
- **Colocation and locality of behaviour** — Kent C. Dodds, "Colocation"; Carson Gross, "Locality
  of Behaviour". Keep code next to what uses it, so a reader sees the behaviour of a unit by
  looking at the unit. It argues against moving single-use code into a shared folder, and pulls
  against separation of concerns: split by concern only when the split pays for the distance.
- **Bounded context, at feature level** — Eric Evans, *Domain-Driven Design*. A term or model
  means one thing inside one boundary. At the scale of a frontend, a feature is that boundary:
  two features may each own a similar type without sharing it, and a shared layer must never
  depend on a feature.
- **Feature folders** — Feature-Sliced Design. Group by feature first and by kind second, with
  dependencies pointing one way, from features to shared code. It is a direction, not a
  mandate: if the current structure works, changing it is rarely worth the cost.

## Earns its keep

- **Information hiding and leakage** — David Parnas, "On the Criteria To Be Used in Decomposing
  Systems into Modules"; John Ousterhout, *A Philosophy of Software Design*. A unit earns its
  boundary by hiding a decision that is likely to change. When the same decision shows in
  several units — a format, an order, a shape — it has leaked, and every one of them changes
  with it.
- **Deep and shallow modules** — Ousterhout, *A Philosophy of Software Design*. A deep unit
  hides much behind a small interface; a shallow one costs nearly as much to learn as it
  saves. The deletion test: removing a deep unit spreads its complexity across its callers;
  removing a shallow one loses nothing anyone asked for. A wrapper that only forwards is
  shallow.
- **Reason to change** — Robert C. Martin, "The Single Responsibility Principle". A unit should
  answer to one source of change. Two reasons to change in one unit argue for splitting it;
  one reason spread across several units argues for merging them.
- **Leaky abstraction** — Joel Spolsky, "The Law of Leaky Abstractions". Every abstraction lets
  some of what it hides through, and its callers then need to know both layers. An
  abstraction whose callers routinely reach past it costs more than the code it replaced.

## The better option

- **Design it twice** — Ousterhout, *A Philosophy of Software Design*. Sketch at least two
  substantially different designs before choosing; the first idea is rarely the best. Compare
  them with the three symptoms of complexity from the same book:
  - **Change amplification**: how many places one likely change touches.
  - **Cognitive load**: how much a developer must hold in mind to make that change.
  - **Unknown unknowns**: whether a developer can tell what to change at all, or must find out
    by breaking something. The worst of the three.

## Guards

- Search for an existing mechanism before proposing a new one: a helper, composable,
  component, utility or pattern that already does the job. Show the search — the query and
  the call-site count of each match — and extend or reuse a match rather than building beside
  it.
- Treat a pattern match as a candidate, not a finding. Open the code and confirm it before
  reporting it.
- Look-alike code is not shared knowledge. Two pieces that share a body or a value today but
  answer to different rules stay separate; extract only when they must change together.
- Propose no abstraction with a single consumer unless it is flagged as a proposal, naming its
  evidence — the design, the project's nature, what the user said, research or outside
  practice — and what it costs to build and carry. The user decides; no count of callers
  decides for them.
- Give every finding its concrete cost: what breaks, what has to change in how many places, or
  what a developer must know that they would not otherwise need.
- State what a pattern is for before arguing against it. A pattern whose purpose is not
  understood is not yet a finding.
- Name an improvement outside the question asked and park it; do not make it or bundle it in.
- Name anything new by the repository's existing conventions — its folder names, suffixes and
  the kind of unit each name implies.
- Flag and offer; never restructure, extract or redesign unasked.

## Words for the user

Text written for the user — a finding, a question, a proposal — uses the project's and the
framework's words: component, composable, util, store, page, feature, or whatever the
repository itself calls the thing. The terms in this reference, such as module, depth, seam or
connascence, stay in the reasoning. Where one helps the user, give its meaning in plain words
rather than its name.
