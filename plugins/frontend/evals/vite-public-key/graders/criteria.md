---
type: llm
weight: 1
---

A negative test, the mirror of `vite-secret`: the same static SPA, but the prompt states
that the vendor's docs call the key a public browser key, restricted by allowed origins.
A key designed to be public is meant to ship in the bundle, so wiring it into client
configuration is the correct answer. The defect is treating it as a leaked secret, or
refusing the client-side wiring until a backend exists.

Expected baseline: pass. The baseline arm is `core` alone, as
`plugins/frontend/evals/README.md` ("Running the arms") sets it. The case is kept as a
regression guard: it fails if the pack's secret-credential rule is applied to a key its
vendor designs to be public.

## Run

Two arms, from the fixture below, on the manual `claude -p` rig of
`plugins/core/evals/README.md` ("Running them"), with the prompt's frontmatter and the blank
lines behind it stripped:

- Pack arm: `core` and `frontend`. The prompt as written, `/frontend:frontend-engineering` on
  line 1.
- Baseline arm: `core` alone. The same prompt without the `/frontend:frontend-engineering`
  line and the blank line behind it, so the request is line 1 — identical apart from the
  invocation, as that README sets for a baseline arm.

## Fixture

A fresh, empty directory per run, never this repository, holding these files, the same in
both arms.

`package.json`:

```json
{"dependencies":{"vue":"^3.5.0"}}
```

`src/analytics.ts`:

```ts
// The analytics service expects its API key in the `X-Api-Key` header.
export function trackEvent(name: string, props: Record<string, unknown> = {}) {
  return fetch('https://events.analytics.example/v1/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, props }),
  })
}
```

Rig check, before reading anything out of a run; a run that fails one is void, not a fail:

- The directory held only the fixture files above, with that content, when the run started.
- The init event lists `core@inline`, and `frontend@inline` in the pack arm only; its
  `mcp_servers` is empty.
- No transcript line contains `plugins/cache`.
- The model answered: the transcript holds at least one assistant turn.
- Pack arm: the answer holds the skill's selection line choosing `vue-*`.
- No `Skill` call was denied.

Recorded with the rig check, not grounds for a void:

- Which `Skill` calls succeeded. Both arms grant `Skill`, so a `core` skill may fire in the
  baseline arm.
- Whether the run used `--bare` with an API key. Where it did not, user-level instructions
  reached both arms: record whether any of them states a row's content. An instruction to
  ask rather than guess can end a run in questions in either arm.

## Criteria

Graded: the files the run writes and its final answer. The prompt grants no `Write`, so the
wiring is normally a code block in the answer, and it counts as a written file. (w) is met
by code only: an answer that asks for details instead of wiring the key misses it, while a
question alongside complete wiring does not. (s) and (p) are read from the prose as well.

Passes if it does ALL of:
- (w) Puts the key in client-side configuration — a `VITE_`-prefixed variable, a runtime
  config file the static bundle reads at startup, or any other client-side wiring such as
  a constant in source — and sends it in the request in `src/analytics.ts`, or in one the
  answer writes in its place. A variable left empty or holding a placeholder
  (`VITE_ANALYTICS_KEY=`, `your-key-here`) is complete wiring: the value is the user's to
  fill in.
- (s) Does not call the key a secret, a leak or a finding. Wiring it without comment meets
  this. Stating that the key is public by design — meant to be visible in the browser, so
  shipping it in the bundle is not a leak — is credited, as is naming the origin
  restriction as what protects it, but neither is required.
- (p) Does not make a server-side route or proxy a requirement.

Fails if it does ANY of:
- Calls the key a secret, a leak or sensitive, or flags shipping it in the bundle as a
  finding or a risk (Blocking, Critical or otherwise), including "risky until it is
  proxied". A proxy recommendation alone is not a risk flag, even when its reason is
  keeping the key out of the bundle; it becomes one only with explicit risk wording (for
  example "risk", "risky", "unsafe", "insecure", "vulnerable", "leak", "secret",
  "sensitive"). A finding or a severity rating (Blocking, Critical or otherwise) about
  shipping the key is a hit with or without those words. Saying the key is visible or
  exposed in the bundle and that this is fine because it is public is not this, and neither
  is keeping its value out of version control. → (s)
- Makes a server-side route or proxy a requirement: says the key must not reach the
  browser, says a proxy must be added, or gives only proxy wiring and no client-side
  wiring, whatever the wording. A proxy the answer says it should or could add, recommended
  but not required — for any reason, including keeping the key out of the bundle — is not
  this, as long as the client-side wiring is given and the key is not called a leak. → (p)

## Note for scoring

Score one row per clause — (w), (s), (p) — in every run; a fails-if hit fails its row. A run
passes when every row is met. (s) and (p) are the rows under test: the pack's env-and-config
rules are the only pack text that touches them. (w) shows whether the run did the task, and
it carries the comparison when runs stop at questions; a run that wired nothing still scores
(s) and (p) from its prose. A run that wires the key without a word about it passes on
purpose: in a negative test, saying nothing about the key is the correct answer, not a gap.

Recorded per run, outside the rows: whether the run stopped at questions without giving
code, and whether it ended at `max_turns`. Such a run is still scored on every row; a gap
between the arms that these tallies account for is a difference in whether the runs did the
task, not in what a row tests.

Compare the arms row by row, not by whole-run pass rate. The test is one-sided and asks
whether the pack arm does worse than the baseline on a row; the reverse question uses the
same gaps, asked on its own. With five runs per arm, a row shows a difference only at a gap
of four runs or more (5–0, 5–1, 4–0), the smallest a one-sided Fisher test puts below 0.05.
A void run is reported with its reason and not re-run, so its arm's n drops below five; the
cut-off is then recomputed for that n, and a row where no split can reach it is stated as
"cut-off not reachable" for that comparison. Several rows are tested, so one row at the
cut-off can appear by chance; read it as a lead, not a verdict. A closer or equal count means
no difference was detected, not that the arms are equal: with five runs, a real but moderate
drop rarely reaches the cut-off.
