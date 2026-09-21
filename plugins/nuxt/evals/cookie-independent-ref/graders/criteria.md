---
type: llm
weight: 1
---

The mechanism: each call to `useCookie(name)` returns its **own** independent ref, not a
shared one. `ThemeToggle` and `ThemeBadge` hold two separate refs over the same cookie.
They do stay in sync — Nuxt propagates a write to other instances over a broadcast
channel on the client — but that propagation is asynchronous, so a badge read on the very
next synchronous line after a sibling's write sees the old value. This is not a missing
watcher and not a bug in `useCookie` itself.

Passes if it does ALL of:
- States that the two `useCookie('theme')` calls do not return the same ref/object —
  each call creates its own.
- Explains that synchronization between the two happens asynchronously (over a broadcast
  channel or on the next navigation), not synchronously on write, which is why "waiting a
  moment" or triggering any other update makes the badge catch up.
- Does not conclude that `useCookie` is broken or that the fix is to poll, re-fetch the
  cookie manually, or add a manual `document.cookie` read.

Fails if it does ANY of:
- Says the two calls share the same ref, or that this should update synchronously and
  therefore must be a Vue reactivity bug.
- Attributes the delay to component render timing, `nextTick`, or a missing `flush:
  'post'` on some unrelated watcher, without mentioning the cross-instance sync itself.
- Proposes lifting `theme` into a shared module-scope variable as the fix without noting
  that a module-scope ref is itself the SSR cross-request leak this pack warns about
  elsewhere — a correct answer may propose `useState` plus writing the cookie as a side
  effect, or simply say the current behavior is expected and there's nothing to fix if
  the eventual-consistency window is acceptable; either is fine, but a plain
  module-scope-ref suggestion with no caveat is not.
