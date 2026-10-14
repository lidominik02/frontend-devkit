# 0016. A router skill picks one framework's rules per workspace

Status: Proposed 2026-10-14, to ship as a Trial. Supersedes 0004 together with 0015; amends
0007.

## Context

Much of the guidance inverts between frameworks: module-scope state is a harmless singleton
in a client-only SPA and a cross-request leak under SSR. A rule correct for one framework
and wrong for another is worse than no rule, and an "if SSR then… else…" sentence is the
wording that makes the model take the wrong branch.

One listed skill per framework would put one description per framework into every session's
listing. `paths` only filters automatic loading, so a Nuxt `**/pages/**` glob also matches in
a Next.js project. The model's prior knowledge of other frameworks cannot be switched off.

Next.js ships documentation matched to its version inside the installed package. Frontend
monorepos hold UI-library workspaces in which the framework is only a peer or dev
dependency.

## Decision

- `frontend` lists one knowledge skill, `frontend-engineering`. Its body is the selection
  rule, and each framework's rules are references in a set: `vue-*`, `nuxt-*`, later
  `next-*` and `react-*`.
- Selection is made once per workspace, from that workspace's `package.json`, before any
  rule loads:

  | The workspace has | Set loaded |
  | --- | --- |
  | `nuxt` | `vue-*` as base, `nuxt-*` as delta |
  | `vue`, no `nuxt` | `vue-*` |
  | `next` | `next-*`, on a `react-*` base once one exists |
  | `react`, no `next` | `react-*` once it exists; until then, the codebase's conventions |
  | the framework only as a peer or dev dependency | the strictest set among the workspaces that consume it, SSR winning; with no consumer, SSR-safe rules |
  | none of these | no set |

- A set applies to its own workspace only.
- A delta set carries only what its framework inverts or adds, and names the base rules that
  do not apply; that list wins a conflict. The router's table is the only place a base–delta
  pair is written.
- The router body holds only what every set shares: check the resolved version, follow the
  codebase's conventions, carry no repository fact, make no sweeping rewrite. It also fixes
  the reading order (`<framework>-rules.md` first, topic files on demand), and re-reads the
  selected rules before a review verdict, before "done" and after compaction.
- For Next.js, API facts come from the installed package's documentation, and the set
  carries only what the model gets wrong even with that documentation.
- The description names the supported frameworks.

## Rationale

One listed description instead of one per framework. Selection from the manifest cannot
misfire on a file glob. A new framework is a new set, one table row and its eval, and `core`
does not change. Choosing once, on a fact, keeps every file true on its own branch, so the
hedge that [0004](0004-framework-packs-layer-as-deltas.md) forbids does not return.

## Alternatives considered

- One listed skill per framework: listing noise, glob misfires, budget. Kept as the fallback.
- Every framework's rules in the router body: two branches in one context.
- Selection in `core`: every framework edits `core`.

## Consequences

- In a Vue project, Nuxt, Next.js and React rules never enter the context. An invocation
  loads the router body, the selected rules file and the topic files it needs.
- The listing does not grow with frameworks.
- This is an exception to keeping guardrails in the body
  ([0007](0007-context-cost-tiers-and-listing-ceiling.md)): a framework's guardrails live in
  the rules file the body makes the first read, and the re-read points stand in for the
  body's presence.
- The SPA/SSR split stays tested by a matched pair: the same module-scope code is fine in a
  Vue SPA and Critical under Nuxt.

## Trade-offs

- Rules in a reference can drop out of the context after compaction.
- One description serves every framework, so an ad hoc trigger can be diluted. The lifecycle
  calls the skill by name.

## Constraints and invariants

- Selection is by manifest, never by `paths` or file names.
- Base–delta pairs exist only in the router table. No set carries a fact about an individual
  repository.
- `core` names the router, never a set.

## Validation requirements

- Before the release: on Vue SPA, Nuxt and Next.js fixtures, the transcript's reads touch
  only the selected set's files.
- The trial fails if the per-framework trigger cases show the router not firing on Vue,
  Nuxt or Next.js wording, or if the selected rules are not re-read after compaction. Either
  failure splits `frontend` into one listed skill per framework, each checking its identity
  in its first line, with the router table kept as the source of selection, and a new record
  supersedes this one.
- If both hold on those cases, and in real sessions read with `/diagnosing-sessions`, the
  status becomes Accepted.
- Measured after the release: a UI-library workspace with a Nuxt consumer calls module-scope
  state Critical.

## References

[0004](0004-framework-packs-layer-as-deltas.md),
[0007](0007-context-cost-tiers-and-listing-ceiling.md),
[0015](0015-one-frontend-plugin.md),
[Authoring](../contributing/authoring.md#body-versus-reference).
