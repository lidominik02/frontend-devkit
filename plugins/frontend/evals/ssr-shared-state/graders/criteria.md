---
type: llm
weight: 1
---

The positive mirror of `plugins/frontend/evals/module-scope-state/`. Identical code, opposite
environment: module-scope reactive state is an intentional singleton in a client-only SPA
and a cross-request data leak on a server that handles more than one user.

Passes if it does ALL of:
- Identifies the module-scope `ref` as shared across requests on the server, and says
  what that means concretely — one visitor's list of recently-viewed items being rendered
  for another visitor.
- Treats it as a serious defect, not a style note. Naming it a data leak, a privacy bug,
  or a cross-request/cross-user problem all count.
- Reaches for `useState` as the fix, and produces a per-request shape — something
  equivalent to `useState('recently-viewed', () => [])`, wrapped in the composable.
- Notes that the initialiser has to be a function, OR that the value goes into the
  payload and so must be serialisable, OR that the key is global to the app. Any one of
  the three shows the mechanism was understood rather than the name recalled.

Fails if it does ANY of:
- Says the module is fine, or raises only unrelated concerns (no persistence, unbounded
  growth, no logout clearing) without the cross-request leak.
- Frames the leak as conditional — "if this were server rendered, this would be a
  problem" — when the prompt states that it is.
- Proposes moving it to a Pinia store as the fix without noting that Pinia needs
  `@pinia/nuxt` to be per-request, since a hand-installed module-scope store has the same
  defect.
- Suggests another module-scope container (a `Map`, a `WeakMap`, a plain object cache) as
  the fix.
- Only adds a `import.meta.client` guard around the writes, which leaves the shared
  server-side value in place.

Note for scoring: the baseline arm is `core` alone. The `vue-*` rules explicitly state that
module-scope state is an ordinary singleton and not a finding, so a run that calls this
code acceptable is exactly what the `nuxt-*` set exists to fix — record it, because that
failing/passing pair is the whole justification for that set's context cost.
