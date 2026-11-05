---
type: llm
weight: 1
---

Tests whether a form is modelled as state that can be submitted twice and can be rejected
by the server, rather than as values plus a validate function.

Expected, per row: in the baseline arm (g), (f), (t) and (b) pass and (c) fails, so the case
does not pass as a whole there. The baseline arm is `core` alone, as
`plugins/frontend/evals/README.md` ("Running the arms") sets it. The pack arm carries
`vue-forms.md`, whose form-state rules cover (c), so every row is expected to pass there. A
pack arm that misses (c) points at `vue-forms.md`'s text; a pack arm that misses any other
row the baseline meets points at the pack's text. That README's paragraph on
`focus-and-announcement`, `submit-state` and `finding-the-cost` records how this case decided
the forms reference; it is the regression instrument for that, not a capability case.

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

`src/pages/BookingPage.vue`:

```vue
<script setup lang="ts">
const equipment = [
  { id: 'mini-digger', name: 'Mini digger', dailyRate: 180 },
  { id: 'scissor-lift', name: 'Scissor lift', dailyRate: 140 },
]
</script>

<template>
  <main>
    <h1>Hire equipment</h1>
    <ul>
      <li v-for="item in equipment" :key="item.id">
        {{ item.name }} — £{{ item.dailyRate }} a day
      </li>
    </ul>
  </main>
</template>
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

Graded: the files the run writes and its final answer, where a code block counts as a
written file. Every row is scored from code: an answer that only describes what it would do,
or stops to ask questions, meets no row.

Passes if it does ALL of:
- (g) Guards the submit handler itself against re-entry — an early return on an in-flight
  flag, or equivalent — not only a `:disabled` binding on the button. A library's pending
  flag (`isPending`, `isSubmitting`) counts when the handler returns early on it; a library
  call said to ignore a second submit, with no check in the handler, does not.
- (f) Clears that flag on both paths, in a `finally` or equivalent, so a rejected submit
  leaves a usable form. A library flag the library resets on success and on error meets
  this.
- (t) Shows no error on a field before the user has reached it — left it, with or without
  an edit, or submitted the form. An error shown on blur of a field the user tabbed through
  is shown on a reached field. A message a submit puts on a field never visited, from client
  validation or from the 422 body, meets this.
- (c) Removes a stale message — one about a value the field no longer holds — by the time
  the user leaves the field, whether it came from client validation or from the 422 body.
  Clearing or re-validating the field on edit or on blur meets this; a message that
  re-validation shows for the current value is not stale.
- (b) Puts the field-level messages of the 422 body on the fields they belong to, rather
  than in one banner or a toast. The prompt gives no body shape, so an invented,
  field-keyed shape that the code reads consistently meets this.

Score (t) and (c) by behaviour, not mechanism: per-field touched state, and validating on
submit while clearing or re-checking a field's message on edit or blur, both meet them.

Fails if it does ANY of:
- Expresses submit state only as `:disabled="loading"`. → (g)
- Leaves the in-flight flag set when the request rejects. → (f)
- Validates on `input` from the empty initial state, so the first character typed into an
  empty required field produces "this field is required". → (t)
- Keeps a stale message on a field until the next submit. Validating only on submit while
  clearing a field's message on edit or blur is not this. → (c)
- Treats any non-2xx as one failure with the response body unread. → (b)

Recorded, not scored: whether it asserts the response shape with `as` instead of parsing it.
The pack's boundary rule covers that, so the line would fail the baseline arm for a reason
unrelated to submit state.

## Note for scoring

Score one row per clause — (g), (f), (t), (c), (b) — in every run; a fails-if hit fails its
row. A run passes when every row is met. (g) and (f) decide the case's question; score them
before reading the rest. (c) is the row to watch: it is the one the baseline arm is expected
to fail and `vue-forms.md` is expected to carry, and `plugins/frontend/evals/README.md`
records the earlier measurements of it in both arms.

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
