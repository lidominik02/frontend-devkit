# Runtime configuration and secrets

## What replaces the SPA rule

The `vue` pack's rule is that a Vite SPA has no server, so nothing is secret and
configuration must be fetched at boot from `/config.json`. Both halves change here.

Nuxt has a server, and `runtimeConfig` is read **at runtime** from the environment. One
built artifact serves staging and production, which is the thing the SPA workaround
existed to fake. Do not add a boot-time config fetch to a Nuxt app: it is a waterfall in
front of the first paint, a second source of truth, and it forces the value to be public
in order to be fetchable.

## The public/private boundary

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    stripeSecretKey: '',            // server only
    public: {
      apiBase: '/api',              // shipped to the browser
    },
  },
})
```

- **Top-level keys are server-only.** Readable in `server/`, in server-side plugins, and
  during SSR. Read one from client code and you get `undefined` — not an error, not a
  warning. The value is simply absent, which is why this fails quietly and reaches
  production.
- **Everything under `public` is in the browser.** It is in the payload and in the
  client bundle. `runtimeConfig.public` is the new `VITE_`: not a place for a secret.

Read it with `useRuntimeConfig()`, never `process.env`, in app code:

```ts
const config = useRuntimeConfig()        // server: all keys; client: public only
```

In a Nitro handler `useRuntimeConfig(event)` is the form to prefer — it resolves
per-request values correctly.

## Environment overrides

Any key can be overridden by an environment variable named `NUXT_` plus the key path in
upper snake case. `runtimeConfig.stripeSecretKey` is `NUXT_STRIPE_SECRET_KEY`;
`runtimeConfig.public.apiBase` is `NUXT_PUBLIC_API_BASE`.

The key **must exist in `nuxt.config`** for the override to apply, with a placeholder
value. An env var with no matching key is ignored silently, which is the second-most
common config bug here. Declare it as `''` rather than omitting it.

**`.env` is a development and build-time convenience only.** Once the server is built,
Nuxt does not read `.env` — the process environment is what counts, and setting it is
the deployment's job. An app that works locally and reads `undefined` in production
usually has its configuration only in `.env`.

## Which file for which fact

| Fact | Where |
| --- | --- |
| Varies per environment, or is a secret | `runtimeConfig` |
| Public, varies per environment | `runtimeConfig.public` |
| Non-secret, reactive, may change without a redeploy | `app.config.ts` |
| Build-time only, cannot change after build | `nuxt.config.ts` |

`app.config.ts` is bundled and reactive but **public and not environment-overridable**,
so it is for theme and feature-flag shaped values, not configuration. If a value must
differ between staging and production, it is `runtimeConfig`.

## Tokens

A Nuxt app has somewhere safe to put a credential, which an SPA does not: a Nitro route
that holds the secret and calls the third party server-side. Prefer that to any
client-side hiding place.

For a user session, set an `HttpOnly; Secure; SameSite` cookie from a server route and
read it with `useCookie` (which will not see an `HttpOnly` cookie from client code —
that is the point). Do not put a token in `useState`: the payload is HTML.

## Review list

- A secret under `runtimeConfig.public`, or a `NUXT_PUBLIC_*` variable holding one.
- A private key read from a component or a client-side composable — silently `undefined`.
- An env var with no declared key in `nuxt.config`, so the override never applies.
- `process.env` read in app code rather than `useRuntimeConfig()`.
- Configuration that only exists in `.env`, so the built server has none.
- A third-party API key used from the browser where a server route would hold it.
