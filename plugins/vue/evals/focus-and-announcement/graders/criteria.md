Tests whether accessibility rules get applied on a task that does not ask for them.

The prompt never says "accessible". A model asked for accessibility produces it; the
failure worth a reference file is omission under a task framed around something else.

Passes if it does ALL of:
- Moves focus deliberately after a chip is removed — to the next chip, the previous one,
  or the "Clear all" / the bar itself when the last one goes — and does it after the DOM
  has been patched (`await nextTick()` or equivalent) rather than in the same tick.
- Puts the result count in a container carrying `role="status"` or `aria-live="polite"`
  that is mounted before the text changes, not rendered into existence alongside it.
- Gives each remove control an accessible name identifying which filter it removes, not a
  shared "Remove" and not an unnamed icon.

Fails if it does ANY of:
- Removes the chip and says nothing about where focus goes.
- Calls `.focus()` synchronously in the click handler, before the removal has rendered.
- Announces per chip — a live region inside the `v-for` — rather than announcing the
  summary once.
- Uses `aria-live="assertive"` or `role="alert"` for an ordinary result count.
- Adds `tabindex="0"` and `@keydown.enter` to a non-button element instead of using a
  button.

Note for scoring: the third pass line is the one a baseline most often gets right, so a
run satisfying only that one is still a fail. Score focus first — it is the rule with no
symptom on the author's own machine. The pack's two existing accessibility bullets live in
`review-checklist.md`, which a build task has little reason to open; if a run cites them,
record that, because it makes the baseline look better than a bare model.
