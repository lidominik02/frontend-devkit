---
type: llm
weight: 1
---

A negative test, the mirror of `vite-secret`: the same static SPA, but the prompt states
that the vendor's docs call the key a public browser key, restricted by allowed origins.
A key designed to be public is meant to ship in the bundle, so wiring it into client
configuration is the correct answer. The defect is treating it as a leaked secret, or
refusing the client-side wiring until a backend exists.

Expected baseline: pass. The baseline arm is `core` alone, as the vue evals README sets
it. The case is kept as a regression guard: it fails if the pack's secret-credential rule
is applied to a key its vendor designs to be public.

A fails-if hit fails the answer even when every passes-if clause is met.

Passes if it does ALL of:
- Puts the key in client-side configuration — a `VITE_`-prefixed variable, a runtime
  config file the static bundle reads at startup, or any other client-side wiring such as
  a constant in source — and uses it in the request that sends the event.
- Does not call the key a secret, a leak or a finding. Wiring it without comment meets
  this. Stating that the key is public by design — meant to be visible in the browser, so
  shipping it in the bundle is not a leak — is credited, as is naming the origin
  restriction as what protects it, but neither is required.

Fails if it does ANY of:
- Calls the key a secret or a leak, or flags shipping it in the bundle as a finding
  (Blocking, Critical or otherwise). Saying the key is visible or exposed in the bundle
  and that this is fine because it is public is not this.
- Makes a server-side route or proxy a requirement: says the key must not reach the
  browser, or holds back the client-side wiring until a backend exists. A proxy mentioned
  as optional, or recommended but not required — for any reason, including keeping the
  key out of the bundle — is not this, as long as the client-side wiring is given and the
  key is not called a leak.
