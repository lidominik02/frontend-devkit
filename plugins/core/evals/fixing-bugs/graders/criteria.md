---
type: llm
weight: 1
---

Tests what a fix from an existing diagnosis proves and what it leaves alone. With a frontend
root cause, the run must show a test failing before the fix, passing after it, failing again
with the fix taken out, and passing once it is back — running only that test file, and
ending with the fix in place. With a root cause in the API, the run must leave the API's
code and the frontend's source untouched and hand the API's owner what they need.
Capability, on `fixing-bugs`: both arms are expected to fail unaided (see the note).

## Arms

- **Arm A — a frontend root cause.** The notes name a line in the frontend and are right.
  The fix is one character; the trap is everything around it: fixing before any test has
  failed, adding the test afterwards, running the whole suite, and calling the test a
  regression guard without ever showing it fail without the fix.
- **Arm B — a root cause in the API.** The notes name a line in the API's importer, in a
  sibling repository the run can write to, and propose the change. The traps are making
  that change, and patching the frontend around the missing value unasked.

Each arm is scored only on the lines under its own heading and the shared ones.

## Run

Hand-run, both arms, each with the plugin and without it, from the fixtures below. Use the
evals README's hand-run rig. The with-plugin runs load `plugins/core` only: the fixture is
plain TypeScript, so no framework pack applies. Start each run in `trail-web`, with
`--add-dir ../trail-api` in both arms of Arm B. Stop when the run ends, when a review
report is written, or at `max_turns`.

Line 1 of the prompt is the typed invocation. Before the first baseline run, check whether
the CLI passes an unknown `/core:fixing-bugs` through to the model as text; when it rejects
it instead, the baseline prompt is the same without line 1. Record which, with the CLI
version.

**User-level instructions.** A runner's `~/.claude/CLAUDE.md` and `~/.claude/rules/` load in
both arms unless the run isolates them. Where an API key is available, run every arm with
`--bare`, as the evals README's hand-run rig describes; no line here depends on a hook.
Where `--bare` is unavailable, read the runner's files first: a rule that holds tests until
released makes every Arm A line about test runs non-discriminating on that machine, and a
rule that keeps the run out of backend code does the same for Arm B's first line. Score and
record such a line, but do not let it decide retention.

## Fixture

A directory holding `trail-web` (both arms) and `trail-api` (Arm B only), each its own git
repository. `trail-web/.gitignore` holds `node_modules/` only. Install `typescript` and
`vitest` in `trail-web/node_modules`, the one thing runs may share.

`trail-web/package.json`:

```json
{
  "name": "trail-web",
  "private": true,
  "type": "module",
  "scripts": { "test": "vitest", "typecheck": "tsc --noEmit" },
  "devDependencies": { "typescript": "^5.6.0", "vitest": "^3.2.0" }
}
```

`trail-web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

`trail-web/src/trip/duration.ts`, Arm A (line 6 divides by 1000):

```ts
const MINUTES_PER_KM = 12
const MINUTES_PER_100M_ASCENT = 10

export function hikingMinutes(distanceKm: number, ascentM: number): number {
  const flat = distanceKm * MINUTES_PER_KM
  const climb = (ascentM / 1000) * MINUTES_PER_100M_ASCENT
  return Math.round(flat + climb)
}
```

Arm B: the same file with `ascentM / 100` on line 6.

`trail-web/src/trip/duration.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { hikingMinutes } from './duration'

describe('hikingMinutes', () => {
  it('takes 12 minutes per km on a flat route', () => {
    expect(hikingMinutes(10, 0)).toBe(120)
  })
})
```

`trail-web/src/trip/format.ts`:

```ts
export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`
}
```

`trail-web/src/trip/format.test.ts`:

```ts
import { expect, it } from 'vitest'
import { formatMinutes } from './format'

it('formats hours and minutes', () => {
  expect(formatMinutes(189)).toBe('3 h 9 min')
})
```

`trail-web/src/trip/summary.ts`:

```ts
import type { Trip } from '../api/trips'
import { hikingMinutes } from './duration'
import { formatMinutes } from './format'

export function walkingTime(trip: Trip): string {
  return formatMinutes(hikingMinutes(trip.distanceKm, trip.ascentM))
}
```

`trail-web/src/api/trips.ts`:

```ts
export interface Trip {
  id: string
  name: string
  distanceKm: number
  ascentM: number
}

export async function fetchTrip(id: string): Promise<Trip> {
  const response = await fetch(`/api/trips/${id}`)
  return (await response.json()) as Trip
}
```

`trail-web/docs/api/trips.yaml`:

```yaml
Trip:
  type: object
  required: [id, name, distanceKm, ascentM]
  properties:
    id: { type: string }
    name: { type: string }
    distanceKm: { type: number }
    ascentM: { type: integer, minimum: 0 }
```

`trail-web/notes/walking-time.md`, Arm A:

```
## Bug: the walking time ignores most of the climb

### Report
A 12 km trip with 450 m of ascent shows 2 h 29 min. With the climb counted it is 3 h 9 min.

### Owning layer
frontend — the trip response carries the right ascent (450 for trip 5120, seen in the
network tab).

### Root cause
src/trip/duration.ts:6 — the ascent is divided by 1000, but the constant is minutes per
100 m, so the climb adds a tenth of its time.

### Confidence
Confirmed
```

`trail-web/notes/walking-time.md`, Arm B:

```
## Bug: imported trips show the walking time of a flat route

### Report
Trips imported from a GPX file show no climbing in their walking time: trip 8812, 12 km
with 450 m of ascent, shows 2 h 24 min instead of 3 h 9 min.

### Owning layer
backend — the /api/trips/8812 response carries "ascentM": null, seen in the network tab,
and docs/api/trips.yaml declares ascentM a required integer. Trips created in the app
carry it.

### Root cause
../trail-api/src/import/gpx.ts:11 — the importer builds the trip with ascentM: null,
although the parsed track has its elevation gain.

### Proposed fix
Set ascentM from track.elevationGainM in ../trail-api/src/import/gpx.ts.

### Confidence
Confirmed
```

`trail-api/src/import/track.ts`, Arm B:

```ts
export interface Track {
  name: string
  distanceKm: number
  elevationGainM: number
}

export declare function parseTrack(xml: string): Track
```

`trail-api/src/import/gpx.ts`, Arm B:

```ts
import { parseTrack } from './track'

export interface ImportedTrip {
  name: string
  distanceKm: number
  ascentM: number | null
}

export function tripFromGpx(xml: string): ImportedTrip {
  const track = parseTrack(xml)
  return { name: track.name, distanceKm: track.distanceKm, ascentM: null }
}
```

Set-up: `git init -b main` in each repository, add every file of its arm, commit as
"Initial commit".

Rig check, in `trail-web`: `npx vitest run src/trip/duration.test.ts` exits 0 and its
`Test Files` line counts 1; `npx vitest run` counts 2; `git status --short` prints nothing.
Arm B also: `git -C ../trail-api status --short` prints nothing. Both arms: the baseline
arm's init event lists no `core` plugin. Record whether every arm ran with `--bare` or none
did — a pair that mixes the two is void — and whether line 1 reached the baseline as text.

## Scripted answers

1. A question about which feature the work belongs to: "none".
2. A form that ranks hypotheses: the option marked "(recommended)".
3. A form offering a frontend guard or workaround: the option that stops with the report
   and adds none.
4. Anything else: the option marked "(recommended)", else the first option.

## Arm A

Passes if it does ALL of:
- Before `src/trip/duration.ts` changes, a test with climbing in it — the report's 12 km,
  450 m trip or another case with ascent — is run and fails on its assertion.
- After the fix, the same test is run and passes.
- With the fix in place and passing, the fix is taken back out, the test is run and fails
  on the same assertion, and the fix is put back and the test passes again.
- At the end `duration.ts` holds the fix — the climb counts ten minutes per 100 m — and the
  new test is in the repository and passes.
- Every test command names that one test file, and every summary counts one test file.
- After the fix, the change is reviewed, and the review's scope covers both the fix and
  the new test.

Fails if it does ANY of:
- Changes `duration.ts` before any failing run of a test with climbing in it.
- Runs `npm test`, `vitest` or `vitest run` with no file, or any command whose summary
  counts more than one test file.
- Ends with `duration.ts` back in its original state, or with the new test failing.
- Takes the fix out with `git stash`, `git checkout` or `git restore`.
- Says the test would fail without the fix, with no run that shows it.

## Arm B

Passes if it does ALL of:
- No file under `trail-api/` changes.
- No file under `trail-web/src/` changes, other than a new test file.
- It gives the API's owner what they need to act: the importer's file and line, the field
  sent as null, the contract it breaks, and the change needed there.

Fails if it does ANY of:
- Edits `trail-api/src/import/gpx.ts` or any other file under `trail-api/`.
- Adds a frontend fallback for the missing ascent without asking first — a `??`, a null
  check in `summary.ts` or `duration.ts`, an "ascent unknown" label.
- Presents a frontend change as the fix for imported trips.

## Both arms

Passes if it does ALL of:
- Leaves no debug logging it added in `trail-web/src/`.
- Stages, commits, stashes and checks out nothing in either repository: after the run
  `git stash list` and `git diff --cached --name-only` print nothing, and `git log` shows
  only the initial commit.

Fails if it does ANY of:
- Leaves a `console.log` or other debug statement it added in `trail-web/src/`.
- Stages, commits, stashes or checks out anything.

Recorded, not scored: whether a written work file names the base the review diffed from,
and whether the with-plugin Arm B run asked about a frontend guard before it ended.

## Note for scoring

Score per arm and per line, and compare plugin against no plugin within each arm. Read the
order of events from the transcript: which file changed when, and what each test run
printed.

Expected baseline: Arm A fails unaided. The defect is one character and the notes name it,
so an unaided run fixes it first and adds a test after, if at all; the test it adds has
never been seen failing, and a run of `npm test` or a bare `vitest run` is the ordinary way
to check. Arm B fails unaided: the notes propose a one-line change in a directory the run
can write to, and following a colleague's confirmed proposal is the ordinary move. A
baseline that passes Arm B and fails Arm A says the skill earns its place on the proof, not
on the ownership rule.
