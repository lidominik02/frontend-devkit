# Vue Router

## Guards deny by default

A guard that returns nothing lets the navigation through. That means a bug in a
permission check — a thrown error swallowed, a branch that falls off the end — fails
open, and the page renders for a user who should never have reached it.

Write guards so the permitted path is the explicit one.

Make the access metadata a required, typed field, so a route whose `meta` leaves it out
fails to compile. A route with no `meta` at all still compiles, so the guard treats
missing metadata as denied, never as public.

Guards run on every navigation including the first, so keep them cheap. An `await` on a
network call in a global guard delays every route change; resolve the session once at
boot and let the guard read the result.

## Redirect loops

The usual cause is a guard that redirects to a route which the same guard also rejects —
sending an unauthenticated user to `/login` while `/login` itself requires
authentication. Exempt the destination explicitly, and treat "already going there" as a
pass:

```ts
if (to.name === 'login') return true
```

## Scroll and focus

`scrollBehavior` restores position on back/forward; without it every back navigation
lands at the top, which reads as data loss on a long list.

Focus is the accessibility half of the same problem: a client-side navigation does not
move focus, so a keyboard or screen-reader user stays where they were while the page
changes underneath them. Move focus to the new view's heading on navigation.

## Params are input from outside

Route params and query strings are user-controlled strings. Validate them at the
boundary with the repo's schema library before they reach anything typed — an `id` that
arrives as `undefined` or `"[object Object]"` should fail at the edge, not three layers
in.

Deriving the accepted values from the same schema that describes the API, rather than
hand-writing a second copy, means a backend change surfaces as a type error rather than
an empty page.
