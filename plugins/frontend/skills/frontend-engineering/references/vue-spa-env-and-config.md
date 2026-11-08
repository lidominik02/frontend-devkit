# Environment, config and secrets in an SPA

## Runtime configuration

This section and its review checks apply when one built artifact is promoted across
environments; a pipeline that builds once per environment can read `import.meta.env`.
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

Where a token must be held in memory, keep it in a module variable rather than storage,
and accept that a reload requires a silent refresh.

## What to check in review

- `import.meta.env` read outside the one module allowed to.
- `/config.json` or `index.html` served without a no-store header.
- A boot path that can fail to a blank page.
