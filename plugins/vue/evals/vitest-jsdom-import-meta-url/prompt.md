---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---

/vue:vue-engineering

This Vitest test (`environment: 'jsdom'`, run via `pnpm --filter @app/reports test`)
fails with `ERR_INVALID_URL_SCHEME`:

```ts
// packages/reports/src/format.test.ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const fixturePath = fileURLToPath(new URL('./fixtures/report.json', import.meta.url))

describe('formatReport', () => {
  it('matches the fixture', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
    expect(fixture.total).toBe(1200)
  })
})
```

This exact pattern works fine in `vite.config.ts` elsewhere in the repo. Why does it
break here, and what's the fix?
