# Environment, config and secrets

## Tokens in the browser

There is no safe client-side store for a long-lived credential. `localStorage` is
readable by any script on the origin, which makes a single XSS a full account
compromise, and it persists until explicitly cleared.

Prefer a `HttpOnly; Secure; SameSite` cookie set by the server, so the token is never
reachable from JavaScript.

Never log a token, never put one in a URL (they land in history, logs and `Referer`),
and never place one in the Pinia state that a devtools extension serialises.

## Build-time facts worth exposing

Version, commit SHA and build timestamp are genuinely build-time and belong in the
bundle. Surfacing them — in a meta tag, a console line, or a request header — turns "the
user is on an old build" from a guess into a fact.

## What to check in review

- A secret credential — a private key, a password, a user's session or access token —
  present in client code, Pinia state, or a query string.
