---
type: llm
weight: 1
---

The positive half of the one-environment rule, the mirror of `per-environment-build`: a
new `VITE_` variable holds an environment-specific URL, and the prompt states that the
pipeline builds once and promotes that artifact. The pack rates a single-environment
build Critical in exactly this project: the bundle staging tested is the bundle
production runs, so a URL baked in at build time can be right for one environment only —
here staging would call production search. The project already has runtime config, a
`config.json` per environment read by `loadConfig()`. The defect is the narrowed rule's
exception or its "say so and ask" clause reaching a project it does not cover: passing
the variable, rating it below blocking, or only asking whether bundles are promoted when
the prompt says they are.

Expected baseline: pass. The baseline arm is `core` alone, as the vue evals README sets
it, and the passes-if lines are expected to pass on both arms. The case is kept as a
regression guard for the rule's Critical branch: it fails if the pack's narrowed rule
stops firing in a project that builds once and promotes. For the runner, not the grader:
record which of the pack's files the with-plugin arm read. A with-plugin pass without a
Read of `references/review-checklist.md` credits the guard only partly; record it as the
`SKILL.md` or `references/env-and-config.md` text carrying the case, not as a void run.

A fails-if hit fails the answer even when every passes-if clause is met.

Passes if it does ALL of:
- Ends in a request-changes verdict, in those or equivalent words ("do not merge",
  "changes requested", "blocking"). A findings list with no verdict word reads as request
  changes when an item in it is Critical or blocking. An approval made conditional on the
  fix ("I would approve once the URL moves to `config.json`") is request changes.
- Rates the build-time `VITE_SEARCH_URL` Critical, Blocking, High, Major, or a finding
  that must be fixed before merge, and gives the single build as the reason: the promoted
  artifact carries one environment's value into the other — under any name: "the artifact
  you tested is not the artifact you promote", "staging will call production search",
  "the value is baked in at build time and the same bundle goes to both". A rating with
  no reason, or with a reason other than the single build, does not meet this clause.
- Says the search URL has to reach the app per environment at runtime. Pointing at the
  project's existing route — the per-environment `config.json` read through
  `loadConfig()` / `config()`, as `apiUrl` and `cdnUrl` already are — meets this, and so
  does any other runtime route that serves a different value per environment from the
  same bundle, such as a same-origin relative path that each bucket routes. Naming it
  among other options meets this. "Make it configurable per environment" with no runtime
  route named does not.

Fails if it does ANY of:
- Approves the change, approves with comments, or rates `VITE_SEARCH_URL` as a Warning,
  Info, Nit, suggestion, Medium or "should fix" — a rating that does not hold the merge on
  this finding. A request-changes verdict that rests only on a different finding, with
  `VITE_SEARCH_URL` rated below blocking, is this too. The verdict decides, not the
  label: "should fix before merge" on this finding, in a request-changes verdict that rests
  on it, is not this.
- Holds the verdict, or rates the finding, only on a question about whether bundles are
  promoted between environments. The prompt already says they are. A question asked
  beside a blocking finding is not this.
- Offers only fixes that keep the value build-time: adding `VITE_SEARCH_URL` to another
  `.env` file (`.env`, `.env.local` or `.env.staging` — the single build either never
  reads it or bakes the same value into both environments), or changing the pipeline to
  build per environment. Rebuilding per environment offered beside a runtime route is not
  this.

Note for scoring: a finding about something else — the new endpoint path, CORS for the
new origin, the missing development value, error handling, a missing test — neither
passes nor fails the answer; score only the clauses above. A blocking finding about
`VITE_SEARCH_URL` whose only reason is something other than the single build — that it
is undefined in development, that `VITE_` values are public in the bundle, or that it
bypasses `config()` and is inconsistent with the config module — does not meet the
second passes-if clause.
