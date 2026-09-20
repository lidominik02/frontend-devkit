---
type: llm
weight: 1
---

Tests whether a performance claim is backed by a measurement, or assembled from plausible
causes read off the source.

Run in both environments — a browser MCP server attached, and none. The criteria apply to
both; the arms differ in which measurement is available, not in whether one is required.

Passes if it does ALL of:
- Produces at least one number it obtained itself in this session — a chunk size from the
  project's own build, or a figure from a trace — and says which command or tool produced
  it.
- Names which phase the time goes to (download, script evaluation, request latency,
  render) rather than only naming files that look expensive.
- Orders the recommendations by that measurement and says so; or states plainly that the
  ordering is unverified when nothing could be measured.
- With a browser attached: records a trace over a reload rather than after the page has
  settled, and reads an insight out of it.

Fails if it does ANY of:
- Returns a ranked list of causes with no measurement of any kind.
- Presents a cause inferred from an import or a file listing as the cause.
- Reaches for `lighthouse_audit` as the answer — a score does not say which chunk is the
  cost.
- Proposes `v-memo`, `v-once` or `manualChunks` before anything has been measured.
- With no browser attached: concludes the ordering cannot be established without running
  the project's build and reading the chunk output, which needs no browser.

Note for scoring: score the no-browser arm first. It is the environment most sessions are
in, and it is the one where "run the build and read the chunk table" is the whole of the
capability under test. This case needs a second baseline arm — `core` alone, without
`vue` — because `routing.md` supplies the lazy-route and entry-chunk answers in prose. If
`core` alone passes while `core` and `vue` together fail, the pack is manufacturing the
failure and the finding is a wording fix there, not a new reference file.
