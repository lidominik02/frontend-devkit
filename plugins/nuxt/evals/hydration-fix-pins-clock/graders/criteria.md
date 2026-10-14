---
type: llm
weight: 1
---

The trap: `useState` is per-request and serialised into the payload, so a time value moved
into it is computed **once, on the server**, and the client resumes with that exact
serialised value rather than recomputing it. The warning disappears only where the
server's timezone and locale match the visitor's (typically in development): both sides
then start from the same instant, the server's clock, frozen for the rest of that
request's session. Elsewhere `toLocaleTimeString()` still renders differently. Either way
the page never shows the visitor's own load time. Whether `useState` is a sound container
depends on what the label is meant to show, not on the API: it is fine for a server render
time formatted deterministically, and wrong for a time that is meant to be the visitor's.

This grader scores the meaning of the answer, not which API it names.

Expected baseline: fail. The baseline arm is `core` + `vue` without `nuxt`; the claim under
test is the nuxt pack's, and the nuxt evals README holds that a plain `vue` install gets
these questions wrong. That README records that this case was run by hand with `claude -p`,
but records no result.

A fails-if hit fails the answer even when every passes-if clause is met.

Passes if it does ALL of:
- Says the fix does not hold up / is not correct as merged for a "Loaded at" label. An
  answer that branches on what the label means counts, provided it also says the diff as
  merged is not right for a label meant to show the visitor's time.
- Explains that the value is the server's instant, computed once and serialised into the
  payload, so it is frozen, does not update after hydration, and is not the time the page
  loaded for that visitor.
- Proposes an actual fix and says which meaning it picks (an answer that branches counts
  as picking, if it names the fix for each meaning; a pick evident from the fix itself
  counts, without being stated):
  - the visitor's local time after mount: the value is created or formatted on the client
    — in `onMounted`, in `<NuxtTime>`, or inside `<ClientOnly>` — and is not read back from
    the `useState` value, which would still show the server's instant; or
  - the server's render time, either formatted deterministically (a fixed timezone and
    locale, or the ISO string), for which `useState` is an accepted container; or rendered
    deterministically through hydration and localised on the client after mount (the ISO
    string, then `toLocale*` in `onMounted`; or `<NuxtTime>` given the `useState` value),
    when the answer says the label shows the server's time.

Noticing that `toLocaleTimeString()` still renders differently under the server's and the
visitor's timezone or locale counts as a reason the diff is wrong, but is not required.

Fails if it does ANY of:
- Approves the diff unchanged as a valid fix for a hydration mismatch on a time value,
  including approving it for one meaning of the label.
- Treats the vanished warning as the fix, or says the warning being gone means the
  underlying problem is solved.
- Claims the diff, or `useState` with the original `toLocaleTimeString()`, removes the
  mismatch for every visitor, regardless of timezone or locale. A claim limited to where
  zone and locale match (e.g. development) is not this.
- Keeps a "Loaded at" label that shows the server's time, and the answer nowhere says that
  the label shows the server's time.
