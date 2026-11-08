# Testing a Vue SPA

## Composables

Composables using lifecycle hooks or `inject` need a component context. Mount a trivial
harness component, or use a `withSetup` helper; pick one and use it consistently.

## Mock at the network boundary, not the module boundary

Stubbing the module that makes the request means the test never exercises the request
building, the response parsing or the error mapping — the three places bugs actually
live. Intercepting HTTP instead (MSW or equivalent) exercises all of it and lets the same
handlers serve tests, local development and a demo build.

When the handlers are shared, make the test environment the strict one: unhandled
requests should fail the test rather than warn. A silently unmocked call is a test
asserting against an empty response.
