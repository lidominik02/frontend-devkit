---
type: llm
weight: 1
---

The bug: inside a test file transformed by Vite under `environment: 'jsdom'`,
`import.meta.url` does not resolve to a real `file://` path — it resolves to a virtual
dev-server URL like `http://localhost:.../@fs/...`. `new URL('./fixtures/report.json',
import.meta.url)` against that base yields a URL with `protocol: 'http:'`, and
`fileURLToPath()` rejects anything that isn't `file:`/`node:`, hence
`ERR_INVALID_URL_SCHEME`. This is specific to the jsdom/browser-mode test transform;
`vite.config.ts` is a real Node module with a real `file://` `import.meta.url`, which is
why the identical pattern works there.

Passes if it does ALL of:
- Identifies that `import.meta.url` inside this test resolves to a non-`file://` (dev
  server / virtual) URL, not a real filesystem path.
- Distinguishes this from the well-known jsdom global-`URL`-shadowing gotcha — does not
  claim the fix is importing `URL` explicitly from `node:url` (and if it considers that
  first, correctly rules it out rather than landing there).
- Gives the fix: resolve the fixture path from `process.cwd()` instead of
  `import.meta.url` (e.g. `path.join(process.cwd(), 'src/format.test.ts/../fixtures/...')`
  or an equivalent relative-to-cwd join), relying on `pnpm --filter` / running `vitest`
  inside the package setting cwd to that package's directory.

Fails if it does ANY of:
- Proposes importing `URL` from `node:url` (or otherwise treating this as the jsdom
  global-`URL` shadowing issue) as the fix.
- Says the pattern should work identically in a test file and looks for the bug
  elsewhere (a typo in the path, a missing fixture file) without addressing the URL
  scheme.
- Proposes a fix that does not survive being run from a different working directory
  (e.g. a fix that hardcodes an absolute path, or that would break if `vitest` were run
  from the repo root instead of the package directory) without at least naming that
  constraint.
