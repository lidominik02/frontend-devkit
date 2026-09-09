# Nitro server routes

A file under `server/` is a real HTTP endpoint on a real server. This is what the `vue`
pack means when it says an SPA has nowhere to put a secret and no backend of its own —
here you have both, and with them the obligations of a backend.

Note that `server/` roots at the project root, **not** inside the app source directory.
Which directories root where changed between majors; see `references/versions.md`.

## Layout

| Path | Becomes |
| --- | --- |
| `server/api/orders.get.ts` | `GET /api/orders` |
| `server/api/orders/[id].get.ts` | `GET /api/orders/:id` |
| `server/api/orders.post.ts` | `POST /api/orders` |
| `server/routes/healthz.ts` | `GET /healthz` (no `/api` prefix) |
| `server/api/proxy/[...path].ts` | catch-all under `/api/proxy/` |
| `server/middleware/log.ts` | runs on every request, adds no route |

A file with no method suffix answers every method — usually not what is wanted. Name the
method.

`server/middleware/` runs for **every** request and must not return a value; returning
one ends the request for everything. Use it to attach context, not to guard routes.

## A handler

```ts
// server/api/orders/[id].get.ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const session = await requireUserSession(event)

  const order = await db.order.find(id)
  if (!order) throw createError({ statusCode: 404, statusMessage: 'Order not found' })
  if (order.tenantId !== session.tenantId) throw createError({ statusCode: 404 })

  return order
})
```

Return a plain value and Nitro serialises it. Throw `createError` for a failure — an
uncaught throw becomes a 500 with a body you did not choose.

## Validation is not optional here

The body of a request is attacker-controlled, and a TypeScript type on it is a comment.
Parse it:

```ts
const body = await readValidatedBody(event, schema.parse)
const query = await getValidatedQuery(event, querySchema.parse)
```

`readBody` and `getQuery` return `any`-shaped data. Use the validated forms with the
schema library the project already has. This is the `vue` pack's type-at-the-boundary
rule applied to the boundary that actually faces the internet.

## Authorisation belongs here

Route middleware decides which page renders; it does not stop anyone calling the
endpoint directly. Every handler that returns or mutates data owned by someone must
check the caller itself.

Prefer **404 over 403** for a resource the caller may not see, so the endpoint does not
confirm that it exists. Scope the query by the caller's tenant rather than fetching and
then comparing — a filter that is part of the query cannot be forgotten in a later edit.

## Secrets and outbound calls

This is where a third-party key lives. Read it with `useRuntimeConfig(event)` and keep
it out of `public` — see `references/runtime-config.md`. A handler that proxies a
third-party API is the correct answer to "the browser needs to call this service with a
key".

Never interpolate a caller-supplied value into an outbound URL path or a shell command,
and validate any URL the caller supplies before fetching it.

## Errors and caching

- `createError({ statusCode, statusMessage })` for the response; keep internal detail
  out of `statusMessage`, which reaches the client.
- Do not leak a database error's text. Log it server-side, return something generic.
- `defineCachedEventHandler` and `routeRules` cache responses. **Anything user-specific
  must not be cached without varying on the user** — a cached authenticated response is
  the same cross-request leak as module state, delivered by the cache instead.

## Version-gated surface

The server layer is the part of Nuxt that changes most between majors: the import
specifiers for handler utilities, the shape of the event object, and whether error
fields are named `statusCode`/`statusMessage` or `status`/`statusText` have all moved.
Check what is installed before writing a handler from memory — `references/versions.md`.

## Review list

- A handler with no method suffix answering every verb.
- `readBody`/`getQuery` used without validation.
- A handler returning another tenant's or user's data with no ownership check.
- A 403 that confirms the existence of a resource the caller cannot see.
- A secret read from `runtimeConfig.public`.
- A caller-supplied value interpolated into an outbound URL or command.
- A cached handler returning per-user data.
- An internal error message returned to the client.
- `server/middleware/` returning a value and ending unrelated requests.
