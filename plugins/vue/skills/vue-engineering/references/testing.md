# Testing Vue

## Boundaries

| Level | Tool | Test this |
| --- | --- | --- |
| Unit | Vitest | Composables, pure functions, store logic |
| Component | Vitest + `@vue/test-utils` | Rendering, props/emits, conditional UI |
| End-to-end | Playwright | Real user journeys through a running app |

Push tests down. A composable test that runs in milliseconds beats an e2e test covering
the same logic in thirty seconds — but keep enough e2e coverage that a broken build
cannot pass.

## What makes a test worth keeping

A test must be able to fail when the business rule changes. A test asserting that a
component renders without throwing catches almost nothing. Encode *why* the behaviour
matters: the total includes tax, the disabled button cannot submit, an expired token
redirects to login.

Test behaviour, not implementation. Assert on rendered output and emitted events; do not
reach into internal refs. A test that breaks when you rename a private variable is a
maintenance tax with no safety benefit.

Prefer querying by accessible role or label over CSS selectors — it keeps tests stable
across restyles and doubles as an accessibility check. Where the UI is not in English,
a `data-testid` is often the only selector that survives a translation change; that is a
legitimate reason to use one, and the only one.

## Composables

Composables using lifecycle hooks or `inject` need a component context. Mount a trivial
harness component, or use a `withSetup` helper; pick one and use it consistently.

Composables that accept getters rather than raw values are far easier to test, because
the test can drive the input without constructing a component.

## Mock at the network boundary, not the module boundary

Stubbing the module that makes the request means the test never exercises the request
building, the response parsing or the error mapping — the three places bugs actually
live. Intercepting HTTP instead (MSW or equivalent) exercises all of it and lets the same
handlers serve tests, local development and a demo build.

When the handlers are shared, make the test environment the strict one: unhandled
requests should fail the test rather than warn. A silently unmocked call is a test
asserting against an empty response.

## Determinism

Never `waitForTimeout`. Wait for the condition — an element, a request, a state — not
for a duration. A timeout is a race that passes on your machine and fails in CI.

Seed state through the API or a fixture rather than clicking through setup UI. A login
flow re-run in fifty specs is fifty slow specs and one flaky one.

**Under Vitest + jsdom, `fileURLToPath(new URL('./fixture.json', import.meta.url))`
throws `ERR_INVALID_URL_SCHEME`**, though the same line works in `vite.config.ts` and
under `environment: 'node'`. `import.meta.url` itself is still a `file://` URL; the
whole expression is what changes. Vite's asset-URL transform (`vite:asset-import-meta-url`)
applies to the client environment, which Vitest's jsdom environment runs test files in,
and rewrites the literal `new URL('<string>', import.meta.url)` into a root-relative path
resolved against `self.location` — jsdom's `http://localhost:3000/` by default. The result
is `http://localhost:3000/src/fixture.json`, which `fileURLToPath()` rejects. Observed on
Vitest 5.0.4 (Vite 8.3.4) and 3.2.4 (Vite 7.3.7) with jsdom 30.1.2, Node 22.23, on
Windows. This is **not** the jsdom global-`URL`-shadowing gotcha: with `URL` imported from
`node:url` the expression reads the same, is rewritten the same, and throws the same. The
tell, if you log the values instead of assuming which bug this is: `import.meta.url`
prints `file://…`, the `new URL(…)` built from it prints `http://localhost:3000/…`.
Resolve the path without the literal form — `join(dirname(fileURLToPath(import.meta.url)),
'fixture.json')`, or `import.meta.dirname` — which stays relative to the test file
whatever directory `vitest` runs from; a `process.cwd()` join holds only while the cwd is
the package directory.

## What the official guide does not cover

vuejs.org's testing page still centres Cypress component testing and does not mention
Vitest Browser Mode, which left experimental status in Vitest 4. On a Vite project,
Vitest is the runner that shares your build config, and browser mode is the current
answer for component tests that need real layout, real CSS or real focus behaviour
rather than a jsdom approximation. Check the installed Vitest major before writing
config: 5.x requires Node ≥ 22.12 and Vite ≥ 6.4.
