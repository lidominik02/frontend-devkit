---
type: llm
weight: 1
---

A getter watcher, `watch(() => prefs.notifications, cb)`, tracks only the
`notifications` property and gets the same object back on every nested change, so it
fires only when `prefs.notifications` is replaced, and a toggle is missed. Two fixes make
it fire: `{ deep: true }` on the getter watcher, or the teammate's direct watch,
`watch(prefs.notifications, cb)`, which fires on nested changes without `deep` because a
`reactive` object watched directly is deep implicitly. The defect is the reverse claim:
that the direct watch also misses the toggles, or needs `deep: true` to see them.

Expected baseline: pass. The baseline arm is `core` alone, as the vue evals README sets
it. The case is kept as a regression guard: it fails if the pack's reactivity text tells
the model that a `reactive` source needs `deep`. No run of this case is recorded. For the
runner, not the grader: a with-plugin pass credits the guard only when the transcript
shows a Read of `references/reactivity.md`; without one, record that the arm never
loaded the text.

The first fails-if line and the teammate line of passes-if measure the pack's rule; every
other line is expected to pass on both arms, and a with-plugin fail on one of them alone
is not a regression of that rule.

A fails-if hit fails the answer even when every passes-if clause is met.

Passes if it does ALL of:
- Names the cause: the getter returns the same `prefs.notifications` object, or tracks
  only the `notifications` property, so the watcher fires only when that object is
  replaced, not when one of its properties changes.
- Gives at least one of the two fixes: `{ deep: true }` on the getter watcher, or
  watching `prefs.notifications` (or `prefs`) directly instead of through a getter —
  affirming the teammate's direct watch as working counts as giving it. Another working
  fix offered beside one of these — a getter that reads each property, a `watchEffect` —
  is not penalised.
- Answers the teammate: the direct watch fires when a toggle changes, with no `deep`
  option needed. A precaution that calls `deep` possibly needed does not meet this.

Fails if it does ANY of:
- Asserts that the direct watch — `watch(prefs.notifications, cb)` or `watch(prefs, cb)`
  — misses the toggles, or that it needs `deep: true` to see them. Writing `deep: true`
  on a direct watch without saying it is needed is not this — including `deep` added as
  a precaution while the answer says it is not required; nor is quoting the claim to
  refute it; nor is the accurate caveat that a direct watch of `prefs.notifications`
  stops following a replacement of that object.
- Gives a wrong cause as the explanation of why the save never runs, or affirms one as a
  co-cause: that `prefs.notifications` is not reactive, that `v-model` on a nested
  property breaks tracking, or that the watcher needs `immediate: true`. Saying that
  `v-model` mutates the nested property in place, which is why the getter sees no new
  object, is the right cause, not this.
- Recommends, as its fix or one of its fixes, a change that still does not fire on a
  nested change: moving the preferences into a `ref` without `deep`, `toRefs(prefs)`,
  `immediate: true`, or `nextTick`.

Note for scoring: `prefs.notifications` read off a `reactive` object is itself a reactive
proxy, so `watch(prefs.notifications, cb)` is a direct watch of a `reactive` object, not
of a plain value.
