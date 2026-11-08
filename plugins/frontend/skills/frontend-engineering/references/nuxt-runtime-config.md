# Runtime configuration

## Reading it

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

Read it with `useRuntimeConfig()`, never `process.env`, in app code:

```ts
const config = useRuntimeConfig()        // server: all keys; client: public only
```

In a Nitro handler `useRuntimeConfig(event)` is the form to prefer — it resolves
per-request values correctly.

## Environment overrides

A key **must exist in `nuxt.config`** for its environment override to apply, with a
placeholder value. An env var with no matching key is ignored silently, which is the
second-most common config bug here. Declare it as `''` rather than omitting it.

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

For a user session, set an `HttpOnly; Secure; SameSite` cookie from a server route and
read it with `useCookie` (which will not see an `HttpOnly` cookie from client code —
that is the point). Do not put a token in `useState`: the payload is HTML.

## Review list

- An env var with no declared key in `nuxt.config`, so the override never applies.
- `process.env` read in app code rather than `useRuntimeConfig()`.
- Configuration that only exists in `.env`, so the built server has none.
