---
type: llm
weight: 1
---

Tests whether the rules block's defaults actually get applied when the user gives none,
not just whether the skill can recite them if asked. The prompt explicitly declines to
set rules ("just go with whatever's normal"), which is exactly the case the defaults
exist for.

Passes if it does ALL of:
- States the governing rules — as defaults, since none were given — somewhere in
  `MASTER-PLAN.md` or an equivalent artifact, not only in the chat reply. A default that
  lives only in the transcript is lost the moment context is, which defeats the point of
  a roadmap skill.
- The stated defaults include, at minimum: implementation runs in the main thread with
  no delegated subagent; code review happens on request, never automatically; heavier
  verification (tests, build, Storybook, browser) is held until released, while
  Prettier/ESLint/typecheck are not; commits happen only once a drafted message is
  accepted.
- Does not run a test suite, a build, Storybook, or a browser check unasked during this
  turn — the `new` mode is repo analysis and roadmap-writing, and nothing here calls for
  any of those regardless of the rules block.
- Does not implement anything or write low-level detail into `MASTER-PLAN.md` — `new`
  produces a phase roadmap, not a phase 1 build.

Fails if it does ANY of:
- Skips stating a governing rules block anywhere durable, on the theory that "normal" is
  self-evident and needs no record.
- States a materially different default than the ones above, including presenting one as
  optional or offered rather than adopted (for example: allows an automatic reviewer
  hand-off, treats a test suite as fair game before release, or offers proactive review
  "if useful" instead of stating it happens on request).
- Runs any heavier verification step, or begins implementing, in this turn.

Note for scoring: no baseline expectation is claimed here — a bare model plausibly already
defaults to something reasonable on request for "normal" defaults, and whether it does so
*durably in an artifact* rather than only in chat is the specific thing to compare between
arms. Run both and read the difference rather than assuming either result.
