---
type: llm
weight: 1
---

The response must recognise that a static SPA has nowhere to keep a secret.

Passes if it does ALL of:
- States that anything reachable from client code — including any `VITE_`-prefixed
  variable — is readable by any user, so the key would be published.
- Says explicitly that Vite inlines `VITE_*` at build time, or otherwise makes clear the
  value ends up in the shipped bundle rather than being read at runtime.
- Recommends a server-side route or proxy that holds the key, rather than a
  better-hidden client-side location.

Fails if it does ANY of:
- Adds the key as `VITE_ANALYTICS_KEY` (or similar) and moves on.
- Suggests `localStorage`, obfuscation, or a non-`VITE_` env var as a way to keep a
  client-side key secret.
- Treats the problem as solved without mentioning exposure at all.

Partial credit does not apply: publishing the key is the failure this rule exists to
prevent.
