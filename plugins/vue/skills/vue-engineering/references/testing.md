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

**Reading a file relative to the test's own location under Vitest + jsdom needs
`process.cwd()`, not `import.meta.url`.** The `fileURLToPath(new URL('../fixture.json',
import.meta.url))` idiom that works in `vite.config.ts` throws
`ERR_INVALID_URL_SCHEME` inside a test file transformed by Vite under
`environment: 'jsdom'`, because `import.meta.url` there resolves to a virtual dev-server
URL (`http://localhost:.../@fs/...`) rather than a real `file://` path — `new URL(...)`
against it yields `protocol: 'http:'`, which `fileURLToPath()` rejects. This is **not**
the well-known jsdom global-`URL`-shadowing gotcha, and importing `URL` explicitly from
`node:url` does not fix it — the rewritten string itself is the problem, not which `URL`
class evaluates it. The tell, if you log the value instead of assuming which bug this is:
the printed `.href` starts with `http://localhost:…/@fs/…`. Resolve from `process.cwd()`
instead, which is stable because both `pnpm --filter <pkg> <script>` and running
`vitest` directly inside a workspace package set cwd to that package's directory.

## What the official guide does not cover

vuejs.org's testing page still centres Cypress component testing and does not mention
Vitest Browser Mode, which left experimental status in Vitest 4. On a Vite project,
Vitest is the runner that shares your build config, and browser mode is the current
answer for component tests that need real layout, real CSS or real focus behaviour
rather than a jsdom approximation. Check the installed Vitest major before writing
config: 5.x requires Node ≥ 22.12 and Vite ≥ 6.4.
