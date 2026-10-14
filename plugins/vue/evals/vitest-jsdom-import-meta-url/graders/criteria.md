---
type: llm
weight: 1
---

The bug: under `environment: 'jsdom'`, Vitest runs the test file through Vite's client
transform, and Vite's asset-URL handling (`vite:asset-import-meta-url`) rewrites the literal
`new URL('./fixtures/report.json', import.meta.url)` into a root-relative path resolved
against the page location — jsdom's `http://localhost:3000/` — so the expression evaluates to
`http://localhost:3000/src/fixtures/report.json`. `fileURLToPath()` rejects a non-`file:` URL,
hence `ERR_INVALID_URL_SCHEME`. `import.meta.url` on its own is still a `file://` URL in this
test. `vite.config.ts` is loaded by Node without that transform, which is why the identical
line works there. Observed on Vitest 5.0.4 (Vite 8.3.4) and 3.2.4 (Vite 7.3.7), jsdom 30.1.2,
Node 22.23.3, Windows 10, 2026-10-14.

Expected baseline: pass. Both `without` runs on 2026-10-14 (`core` only, `/vue:vue-engineering`
not installed) already named the rewrite of the literal form and gave a file-relative fix.
Kept as a regression guard: it fails if the pack says `import.meta.url` itself is an `http:`
URL, as it did before 2026-10-14.

Passes if it does ALL of:
- Explains that the URL reaching `fileURLToPath()` is an `http:` URL because the
  `new URL('…', import.meta.url)` expression is rewritten by Vite's transform for the jsdom
  (client) environment, not because of the path or the fixture file.
- Does not land on the jsdom global-`URL`-shadowing explanation; if it considers it, it rules
  it out. Listing `node:url` among several options, alongside a fix that works, does not
  break this line.
- Gives a fix that reads the real fixture under `environment: 'jsdom'` — for example building
  the URL from `import.meta.url` held in a variable, `dirname(fileURLToPath(import.meta.url))`
  joined with the relative path, `import.meta.dirname`, `__dirname`, importing the JSON as a
  module, switching this file to `// @vitest-environment node`, or any other fix that reads
  the real file regardless of cwd. `import.meta.resolve` counts only if the answer says it
  needs Vitest 5 (it throws on 3.2.4). A `process.cwd()` join counts when it names its
  working-directory constraint.

Fails if it does ANY of:
- Says the bare `import.meta.url` value is not a `file:` URL in this test. A sentence that
  names `import.meta.url` and the `new URL(…, import.meta.url)` expression together as becoming
  `http:` or a dev-server URL counts as saying it. Saying the rewritten expression becomes
  `/@fs/…` instead of `/src/…` is a detail and is not scored.
- Presents `import { URL } from 'node:url'`, with the constructor keeping the name `URL`, as
  the fix, or otherwise treats this as the jsdom global-`URL` shadowing issue. Offering it as
  one option among several, with a working fix also given, does not trigger this line — "use
  this, or alternatively <working fix>" counts as one option among several.
- Says the pattern should work identically in a test file and looks for the bug elsewhere (a
  typo in the path, a missing fixture file) without addressing the URL scheme.
- Proposes a fix that does not survive being run from a different working directory (a
  hardcoded absolute path, or a `process.cwd()` join that breaks when `vitest` runs from the
  repo root instead of the package directory) without naming that constraint.
