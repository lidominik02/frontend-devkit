---
type: llm
weight: 1
---

Tests whether bringing a branch up to date loses nothing from either side. The branch and
main both changed one function for different reasons, both added a dependency, and each
added its own helper for the same job with no conflict between them. The run must keep
both changes to the function, regenerate the lockfile rather than merge it, raise the
duplicate helper with the user before touching it, rewrite the branch only with a way back,
and push nothing. Capability, on `syncing-branches`: expected to fail unaided (see the note).

## Run

Hand-run, with the plugin and without it, from the fixture below. Use the evals README's
hand-run rig. The with-plugin runs load `plugins/core` only: the fixture is plain
JavaScript, so no framework pack applies. Start each run in `pantry-web`. Stop when the run
ends, when a review report is written, or at `max_turns`.

Line 1 of the prompt is the typed invocation. Before the first baseline run, check whether
the CLI passes an unknown `/core:syncing-branches` through to the model as text; when it
rejects it instead, the baseline prompt is the same without line 1. Record which, with the
CLI version.

**User-level instructions and hooks.** A runner's `~/.claude/CLAUDE.md` and
`~/.claude/rules/` load in both arms unless the run isolates them. Where an API key is
available, run every arm with `--bare`, as the evals README's hand-run rig describes. Where
`--bare` is unavailable, read the runner's files first: a rule that the user pushes makes
the no-push line non-discriminating on that machine, and a hook in `core` that denies
`git push` does the same in the with-plugin arm, since it measures the hook rather than the
skill. Score and record such a line, but do not let it decide retention.

## Fixture

A directory holding `pantry-origin.git` (a bare remote), `pantry-web` (the user's clone)
and `colleague` (a second clone, used only to build the fixture). Node and npm are needed;
every install is offline, since the only dependencies are local folders. Every
`npm install` below runs with `--offline --no-audit --no-fund`.

In `pantry-web`, on `main`:

`.gitignore`:

```
node_modules/
```

`package.json`:

```json
{
  "name": "pantry-web",
  "private": true,
  "type": "module"
}
```

`src/units.js`:

```js
export function formatQuantity(quantity) {
  return quantity.toFixed(1)
}
```

`vendor/fraction-kit/package.json`:

```json
{ "name": "fraction-kit", "version": "1.0.0", "type": "module", "main": "index.js" }
```

`vendor/fraction-kit/index.js`:

```js
export const toFraction = (n) => String(n)
```

`vendor/csv-lite/package.json`:

```json
{ "name": "csv-lite", "version": "1.0.0", "type": "module", "main": "index.js" }
```

`vendor/csv-lite/index.js`:

```js
export const toCsv = (rows) => rows.map((r) => r.join(',')).join('\n')
```

Set-up, in order:

1. `git init --bare -b main pantry-origin.git`.
2. In `pantry-web`: `git init -b main`, write the files above, `npm install`, commit
   everything as "Initial commit", `git remote add origin ../pantry-origin.git`,
   `git push origin main`.
3. `git switch -c feature/scale-recipes`. Change `src/units.js` to the version below and
   commit it as "Show the unit next to each scaled quantity":

   ```js
   export function formatQuantity(quantity, unit) {
     return `${quantity.toFixed(1)} ${unit}`
   }
   ```

4. `npm install ./vendor/fraction-kit`, add `src/format/plural.js` and `src/scale.js`
   below, commit everything as "Add the portion scaler", then
   `git push -u origin feature/scale-recipes`.

   `src/format/plural.js`:

   ```js
   export function pluralUnit(unit, count) {
     if (count === 1) return unit
     return unit.endsWith('f') ? `${unit.slice(0, -1)}ves` : `${unit}s`
   }
   ```

   `src/scale.js`:

   ```js
   import { formatQuantity } from './units.js'
   import { pluralUnit } from './format/plural.js'

   export function scaleLine(line, factor) {
     const quantity = line.quantity * factor
     return `${formatQuantity(quantity, pluralUnit(line.unit, quantity))} ${line.name}`
   }
   ```

5. `git clone pantry-origin.git colleague`. In `colleague`, change `src/units.js` to the
   version below and commit it as "Round quantities to the nearest half":

   ```js
   export function formatQuantity(quantity) {
     return String(Math.round(quantity * 2) / 2)
   }
   ```

6. In `colleague`: `npm install ./vendor/csv-lite`, add `src/text/pluralize.js` and
   `src/export.js` below, commit everything as "Add a shopping-list export", then
   `git push origin main`.

   `src/text/pluralize.js`:

   ```js
   export function pluralize(word, count) {
     return count === 1 ? word : `${word}s`
   }
   ```

   `src/export.js`:

   ```js
   import { toCsv } from 'csv-lite'
   import { pluralize } from './text/pluralize.js'

   export function shoppingList(items) {
     return toCsv(items.map((item) => [item.name, `${item.count} ${pluralize(item.unit, item.count)}`]))
   }
   ```

`pantry-web` is not fetched after step 6: its `origin/main` still names the initial commit,
as it would for a user who has not fetched since.

Rig check, in `pantry-web`: `git status --short` prints nothing; the branch is
`feature/scale-recipes` with two commits over `main`; `git -C ../pantry-origin.git log
--oneline main` shows three commits. In a throwaway copy of the directory, `git fetch` then
`git rebase origin/main` stops with a `CONFLICT (content)` in `src/units.js`, and once that
is resolved and continued, with `CONFLICT (content)` in `package.json` and
`package-lock.json`. Record `git -C ../pantry-origin.git rev-parse feature/scale-recipes`
before the run. Both arms: the baseline arm's init event lists no `core` plugin. Record
whether every arm ran with `--bare` or none did — a pair that mixes the two is void — and
whether line 1 reached the baseline as text.

## Scripted answers

1. A question about which feature the work belongs to: "none".
2. A form approving a plan before anything runs: the option marked "(recommended)".
3. A question about how to resolve a conflicted file: the option marked "(recommended)",
   else the first option.
4. A question about `pluralize` and `pluralUnit` doing the same job: the free-text answer
   "Keep both as they are for now."
5. A form showing the resolutions for approval: the option marked "(recommended)".
6. A question about pushing: "No, I push myself."
7. Anything else: the option marked "(recommended)", else the first option.

## Criteria

Passes if it does ALL of:
- Before the branch's history is rewritten, a branch or tag points at its original tip —
  the commit "Add the portion scaler" — and it still does at the end.
- At the end, `feature/scale-recipes` has the remote's `main` tip,
  `git -C ../pantry-origin.git rev-parse main`, as an ancestor, holds no merge commit over
  it, and `git log --format=%s <that tip>..feature/scale-recipes` lists both of the
  branch's commit subjects.
- `src/units.js` keeps both changes: run from `pantry-web`,
  `node -e "import('./src/units.js').then((m) => console.log(m.formatQuantity(2.3, 'g')))"`
  prints `2.5 g`.
- `package.json` lists both `csv-lite` and `fraction-kit`. `package-lock.json` holds no
  conflict marker, parses as JSON, and lists `node_modules/csv-lite` and
  `node_modules/fraction-kit`; in a copy of the directory,
  `npm install --package-lock-only --offline` leaves it byte-identical.
- Before the run ends, the user is asked about `pluralize` in `src/text/pluralize.js` and
  `pluralUnit` in `src/format/plural.js` as doing the same job, and the question names a
  difference in what they return — a unit ending in `f`, such as "loaf". Both files are
  unchanged at the end.
- Before the first `git add` of a conflicted file, the user is shown how each conflicted
  file at that point was resolved, and approves it.
- After the branch is up to date, the change is reviewed, and the review's base is the
  branch as it stood before the sync.

Fails if it does ANY of:
- Pushes anything: the recorded `feature/scale-recipes` commit in `pantry-origin.git`
  differs after the run, or any other ref there moved.
- Merges `main` into the branch.
- Resolves the conflict markers inside `package-lock.json` by editing the file.
- Changes `src/text/pluralize.js`, `src/format/plural.js` or a caller of either before the
  user's answer about them.
- Attributes the rounding change to the branch, or the unit change to main, in any question
  or summary shown to the user.
- Runs `git reset --hard`, deletes a branch, or drops a stash entry.

Recorded, not scored: whether a written work file names each conflicted file's kind, both
sides' intent with the commit it came from, the resolution and its evidence; and whether
the run fetched before planning or as the plan's first step.

## Note for scoring

Score per line, and compare plugin against no plugin. Read the order of events from the
transcript: which command ran when, what each question showed, and what the files held
after each step.

Expected baseline: fails. An unaided run fetches and rebases, which scores the ancestry
line, but on the conflict in `src/units.js` it commonly keeps one side — often reading
"ours" as the user's side, which during a rebase is main's — and loses either the rounding
or the unit. It resolves `package-lock.json` by hand or by taking one side without
regenerating it, so one dependency goes missing from the lockfile. It has no reason to look
for `pluralize` and `pluralUnit`, since nothing conflicts there. It stages each file as it
resolves it, rewrites the branch with no ref left at its old tip, and offers to force-push
or runs it. A baseline that passes the lockfile and ancestry lines and fails the rest says
the skill earns its place on intent, overlap and order, not on git mechanics.
