---
type: llm
weight: 1
---

Tests whether a bug in this repository's own server code is fixed here and proven, rather
than handed to an owner. The repository holds a `web/` page and a `server/` with a plain
Node HTTP handler; the diagnosis names a line in the handler module's pricing function and
calls the layer backend. The code is the repository's own, so the run must fix it under
`server/` — not write an owner report — and prove the fix: the test red before it, green
after, red with the fix taken out and green once it is back, running only that test file.
Line (a) is a regression guard for `fixing-bugs`' ownership rule, which moved from the
frontend to the repository: an unaided run is expected to pass it, a run on a release
before the move to fail it. Line (b) is the revert proof outside a JavaScript frontend,
with the runner a project declares rather than one `fixing-bugs` recognises.

## Run

Hand-run from the fixture below, with the plugin and without it. Use the evals README's
hand-run rig. The with-plugin runs load `plugins/core` only: the fixture holds no
framework, so no pack applies. Start each run at the fixture's root. Stop when the run
ends, when a review report is written, or at `max_turns`. Run each arm at least twice; the
case passes when every line passes in both with-plugin runs.

Line 1 of the prompt is the typed invocation. Before the first baseline run, check whether
the CLI passes an unknown `/core:fixing-bugs` through to the model as text; when it rejects
it instead, the baseline prompt is the same without line 1. Record which, with the CLI
version. Pass the prompt's `allowed_tools` as `--allowedTools`, `Bash` unrestricted: a
skill's own `allowed-tools` need not name the declared runner, and a prompt for it is not
the variable under test.

Line (b) scores the fix phase. A review the close starts may run its own commands; record
those, and do not score them against (b). A run that reaches `max_turns` before its revert
proof is inconclusive on (b), not failed on it.

**User-level instructions.** A runner's `~/.claude/CLAUDE.md` and `~/.claude/rules/` load in
both arms unless the run isolates them. Where an API key is available, run every arm with
`--bare`, as the README's hand-run rig describes; no line here depends on a hook. Where
`--bare` is unavailable, read the runner's files: a rule that holds tests until released
makes line (b) non-discriminating on that machine, and a rule that keeps the run out of
backend code does the same for line (a). Score and record such a line, but do not let it
decide retention.

## Fixture

A fresh directory per run, one git repository, with no `package.json` at its root.

`server/package.json`:

```json
{
  "name": "paddle-server",
  "private": true,
  "type": "module",
  "scripts": { "start": "node src/main.js", "test": "node --test" }
}
```

`server/src/quote.js` (line 5 rounds down):

```js
const FIRST_HOUR_EUR = 12
const EXTRA_HOUR_EUR = 8

export function quoteEur(hours) {
  const billed = Math.floor(hours)
  if (billed <= 1) return FIRST_HOUR_EUR
  return FIRST_HOUR_EUR + (billed - 1) * EXTRA_HOUR_EUR
}

export function handleQuote(req, res) {
  const url = new URL(req.url, 'http://localhost')
  const hours = Number(url.searchParams.get('hours'))
  if (!Number.isFinite(hours) || hours <= 0) {
    res.writeHead(400, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'hours must be a positive number' }))
    return
  }
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ hours, priceEur: quoteEur(hours) }))
}
```

`server/src/main.js`:

```js
import { createServer } from 'node:http'
import { handleQuote } from './quote.js'

createServer((req, res) => {
  if (req.url.startsWith('/api/quote')) return handleQuote(req, res)
  res.writeHead(404).end()
}).listen(process.env.PORT ?? 3000)
```

`server/test/quote.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { quoteEur } from '../src/quote.js'

test('a two-hour rental costs the first hour and one extra hour', () => {
  assert.equal(quoteEur(2), 20)
})
```

`web/index.html`:

```html
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Paddle rentals</title></head>
  <body>
    <label>Hours <input id="hours" type="number" min="0.5" step="0.5" value="1"></label>
    <output id="price"></output>
    <script type="module">
      import { showQuote } from './src/quote.js'
      const hours = document.getElementById('hours')
      const price = document.getElementById('price')
      hours.addEventListener('change', () => showQuote(hours.value, price))
      showQuote(hours.value, price)
    </script>
  </body>
</html>
```

`web/src/quote.js`:

```js
export async function showQuote(hours, target) {
  const response = await fetch(`/api/quote?hours=${hours}`)
  const { priceEur } = await response.json()
  target.textContent = `€${priceEur}`
}
```

`notes/partial-hours.md`:

```
## Bug: a rental with a started hour is quoted too low

### Report
A 2.5 hour kayak rental is quoted €20 on the booking page. Every started hour is billed,
so it should be €28.

### Owning layer
backend — GET /api/quote?hours=2.5 returns {"hours":2.5,"priceEur":20}, seen in the
network tab; the page shows what the server sends.

### Root cause
server/src/quote.js:5 — the hours are rounded down with Math.floor, so a started hour is
not billed.

### Confidence
Confirmed
```

Set-up: `git init -b main`, add every file, commit as "Initial commit".

Rig check: in `server/`, `node --test test/quote.test.js` exits 0 and reports one test;
`git status --short` prints nothing; the root holds no `package.json`. The baseline arm's
init event lists no `core` plugin; a with-plugin arm's lists `core`, from the source the run
records. Record whether every arm ran with `--bare` or none did — a pair that mixes the two
is void — and whether line 1 reached the baseline as text.

## Scripted answers

1. A question about which feature the work belongs to: "none".
2. A form offering to fix the code here or to write an owner report instead: the option
   that fixes it here.
3. A form offering a guard or workaround in another layer: the option that adds none.
4. Anything else: the option marked "(recommended)", else the first option.

## Lines

Passes if it does ALL of:
- **(a)** At the end `server/src/quote.js` bills every started hour — `quoteEur(2.5)` is 28.
  An owner report written beside the fix does not fail this line; it is recorded.
- **(b)** Before `server/src/quote.js` changes, a test with a started hour in it is run and
  fails on its assertion; after the fix the same test passes; with the fix in place and
  passing, the fix is taken back out, the test is run and fails on the same assertion, and
  the fix is put back and the test passes again. Every test command names exactly one test
  file, the one holding that test — a new file or `server/test/quote.test.js`, whichever
  the run put it in. A rig-check style run of another single file is not a test command of
  the run's.

Fails if it does ANY of:
- **(a)** Ends with `server/src/quote.js` unchanged and a report addressed to a backend or
  server owner — in chat or in a written file — as the outcome.
- **(a)** Corrects the quote outside `server/` — in `web/src/quote.js`, say — instead of
  fixing `server/src/quote.js`. A `web/` change beside the server fix is recorded, not
  scored.
- **(b)** Changes `server/src/quote.js` before any failing run of a test with a started hour.
- **(b)** Runs `node --test`, `npm test` or `npm run test` with no file, or takes the fix out
  with `git stash`, `git checkout` or `git restore`.
- **(b)** Says the test would fail without the fix, with no run that shows it.

Recorded, not scored: whether anything under `web/` changed; whether an owner report was
written beside the fix; whether the run asked before editing `server/`, and in what words;
whether anything was staged, committed or stashed (`git stash list`,
`git diff --cached --name-only`, `git log`).

## Note for scoring

Score per line, and compare plugin against no plugin. Read the order of events from the
transcript: which file changed when, and what each test run printed. Line (b) is reachable
only on a run that fixes the code; a run that fails (a) by stopping with an owner report
fails (b) too, and the note says so rather than scoring (b) on its own. A run that finds no
test runner and fixes without a test fails (b); the note names that as the reason, since it
is a runner rule failing, not the proof discipline.

Expected baseline. Without the plugin, (a) is expected to pass — the notes name the line and
the directory is writable — and (b) to fail, an unaided run fixing first and testing after,
if at all; that half is a prediction, and a baseline that writes the test first passes it.
With `core` 0.4.1, (a) is expected to fail: its `fixing-bugs` sends a diagnosis whose owning
layer is not the frontend to the owner report and edits no backend code, so (b) fails with
it. A with-plugin run that passes both says the ownership rule now follows the repository,
not the layer.
