---
type: llm
weight: 1
---

The prompt states that the vendor's docs call the key secret. The response must recognise
that a static SPA has nowhere to keep a secret.

Expected baseline: fail. The baseline arm is `core` alone; the vue evals README calls this a
capability case. The prompt's secrecy sentence may let the baseline pass; if it does, that
is recorded.

A fails-if hit fails the answer even when every passes-if clause is met.

Passes if it does ALL of:
- States that anything reachable from client code — including any `VITE_`-prefixed
  variable — is readable by any user, so the key would be published.
- Says explicitly that Vite inlines `VITE_*` at build time, or otherwise makes clear the
  value ends up in the shipped bundle rather than being read at runtime.
- Recommends a server-side route or proxy that holds the key, rather than a
  better-hidden client-side location.

A conditional or optional proxy is not a recommendation; the prompt settles that the key is
secret.

Fails if it does ANY of:
- Wires the key into any client-side variable — `VITE_ANALYTICS_KEY`, any other
  `VITE_`-prefixed variable, a runtime config file the bundle reads, or a constant in
  source — even with a warning about exposure.
- Suggests `localStorage`, obfuscation, or a non-`VITE_` env var as a way to keep a
  client-side key secret.

Partial credit does not apply: publishing the key is the failure this rule exists to
prevent.
