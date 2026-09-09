# Environment, config and secrets

## The rule that matters most

**Vite inlines `import.meta.env.VITE_*` into the bundle at build time.** Those values are
not read at startup; they are string-substituted into the JavaScript that ships. Two
consequences, both expensive:

1. **Nothing prefixed `VITE_` is a secret.** It is in the bundle, readable by anyone who
   opens devtools or `curl`s the asset. An API key placed there is published.
2. **One build cannot serve two environments.** A build that inlined the staging API URL
   *is* the staging build. Promoting the tested artifact to production is impossible; you
   must rebuild, which means the thing you deploy is not the thing you tested.

Vars without the `VITE_` prefix are not exposed to client code at all — which is a guard
against accident, not a way to ship a secret. There is no server in a static SPA, so
there is nowhere for a secret to live. If a call needs a credential, it belongs behind an
endpoint you control.

## Runtime configuration, instead

Fetch configuration when the app boots, before mounting:

```ts
// main.ts
const res = await fetch('/config.json', { cache: 'no-store', credentials: 'same-origin' })
const config = await res.json()
app.provide(configKey, config)
app.mount('#app')
```

The container renders `/config.json` from environment variables at start-up, so the same
image runs in every environment. Three details decide whether this actually works:

- **`/config.json` must never be cached.** A cached config file means a deploy changes
  nothing. Same for `index.html`, and for a service worker if you have one.
- **Validate it on arrival.** A malformed config should fail loudly at boot with a
  readable message, not produce `undefined` deep inside a component an hour later.
- **Boot failure needs a visible state.** A white screen is not an acceptable failure
  mode. Render a plain-DOM error panel that does not depend on the framework or the
  i18n layer having initialised.

A single module may read `import.meta.env` — the one that exposes genuinely build-time
facts such as the version string or the mode. Everything else reads the runtime config.
That boundary is worth enforcing mechanically; an ESLint `no-restricted-syntax` rule on
`MemberExpression[object.type='MetaProperty'][property.name='env']`, with one file
exempted, makes the accidental case impossible rather than merely discouraged.

## Tokens in the browser

There is no safe client-side store for a long-lived credential. `localStorage` is
readable by any script on the origin, which makes a single XSS a full account
compromise, and it persists until explicitly cleared.

Prefer a `HttpOnly; Secure; SameSite` cookie set by the server, so the token is never
reachable from JavaScript. Where a token must be held in memory, keep it in a module
variable rather than storage, and accept that a reload requires a silent refresh.

Never log a token, never put one in a URL (they land in history, logs and `Referer`),
and never place one in the Pinia state that a devtools extension serialises.

## Build-time facts worth exposing

Version, commit SHA and build timestamp are genuinely build-time and belong in the
bundle. Surfacing them — in a meta tag, a console line, or a request header — turns "the
user is on an old build" from a guess into a fact.

## What to check in review

- Any new `VITE_`-prefixed variable. Ask what it holds and whether the build is now
  environment-specific.
- `import.meta.env` read outside the one module allowed to.
- A credential, token or key present in client code, Pinia state, or a query string.
- `/config.json` or `index.html` served without a no-store header.
- A boot path that can fail to a blank page.
