---
type: llm
weight: 1
---

The counterexample: the review comment sounds like a rule of thumb ("server state is JSON,
so rich types come back as a string and `{}`"), and the rule is wrong for this code. The
payload `useState` writes is serialised with devalue, which carries `Date`, `Map`, `Set`
and `RegExp` as themselves on every Nuxt 3+ version. On Nuxt 4.6.1 the page works as
written: `filters.since` is a `Date` and `filters.tags` is a `Set` on the client, with no
conversion. The string-or-`{}` behaviour belongs to a server route's response read through
`$fetch` or `useFetch`, which is `JSON.stringify`ed — a different path from `useState`.

This grader scores the meaning of the answer, not which API it names.

Expected baseline: pass. The baseline arm is `core` + `vue` without `nuxt`. The case is
kept as a named regression guard against the pack teaching the conversion; a with-plugin
fail is a pack defect. The nuxt evals README records no run of this case.

A fails-if hit fails the answer even when every passes-if clause is met.

"Conversion" below means any change to how `filters.since` or `filters.tags` is stored in
or read from the `useState` value so that it survives the payload: storing an ISO string,
a timestamp or an array instead, or a revive step on the client such as `new Date(...)` or
`new Set(...)`. Reviving a `$fetch` or `useFetch` response is not a conversion. An optional
change that is not about the teammate's claim, such as a clearer state shape, is not a
conversion and does not count either way.

Passes if it does ALL of:
- Says the teammate is wrong about `useState` here: the `Date` and the `Set` reach the
  client as a `Date` and a `Set`, not as a string and `{}`. An answer that is unsure is not
  a pass unless it still concludes that the code works as written; a hedged "probably
  works" counts when it gives the reason below. An answer that only suggests checking in
  the browser passes this clause only if it also states that conclusion and gives the
  reason below.
- Gives a reason that goes beyond restating the conclusion: it names the serialiser
  (devalue) or the mechanism (the payload is serialised with a serialiser that is not plain
  JSON and keeps `Date` and `Set`). "Nuxt handles it" alone does not meet this. The
  answer need not mention other Nuxt versions, `Map` or `RegExp`.
- Says the code needs no conversion: it keeps `filters.since.toISOString()` and
  `filters.tags.has('new')` unchanged, or proposes no conversion at all.

Noticing that a server route's response read through `$fetch` or `useFetch` is JSON, so a
`Date` it returns arrives as a string, or that a function or class instance in the payload
needs `definePayloadPlugin`, counts as a correct note but is not required.

Fails if it does ANY of:
- Agrees that the `Date` or the `Set` arrives as a string or `{}` from `useState`.
- Recommends a conversion, whether as a required fix or defensively ("Nuxt keeps them, but
  convert anyway", "to be safe").
- Says that `Date`, `Map`, `Set` or `RegExp` in the payload survive only since a later Nuxt
  version (for example only since 3.5 or only on 4.x).
