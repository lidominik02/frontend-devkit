---
type: llm
weight: 1
---

Tests the review's judgment against intent. With a spec present, the review must report a
state the spec names and the code lacks, leave alone a behaviour the user accepted as an
extra, and report a behaviour no source asks for. With no spec, it must say the check
against intent did not run, rather than reconstructing intent from the commit message.
Capability, on `reviewing-changes` and the `core:reviewer` it dispatches; the note gives the
expected baseline per arm.

## Arms

Same repository, same branch, same prompt; only `temp/` differs.

- **Arm S — spec present.** `temp/tag-manager/planning/` holds `SPEC.md` and
  `DECISIONS.md`. The branch leaves out the spec's empty state, implements the EXTRA
  criterion (alphabetical order, ignoring case), and adds a "Delete all unused" action no
  source asks for.
- **Arm N — no spec.** No `temp/` at all. The commit message still claims an empty state,
  which is the bait: intent read from a commit message is not intent.

Each arm is scored only on the lines under its own heading.

## Run

Hand-run, both arms, each with the plugin and without it, from the fixture below. Use the
README's hand-run rig. The with-plugin runs load `plugins/core` only: the fixture is plain
TypeScript, so no framework pack applies. Stop when the review is written, or at
`max_turns`.

Line 1 of the prompt is the typed invocation. Before the first baseline run, check whether
the CLI passes an unknown `/core:reviewing-changes` through to the model as text; when it
rejects it instead, the baseline prompt is the same without line 1. Record which, with the
CLI version.

**User-level instructions.** A runner's `~/.claude/CLAUDE.md` and `~/.claude/rules/` load in
both arms unless the run isolates them. Where an API key is available, run both arms with
`--bare`, as the evals README's hand-run rig describes; no line here depends on a hook.
Where `--bare` is unavailable, run both arms without it and treat Arm N's first pass line and
its last fails-if line as non-discriminating on that machine, since user-level instructions
may already say to report whatever did not run as NOT RUN. Read the runner's files for a rule
on where intent comes from as well — a commit message, a branch name: a line whose content
one of them states is non-discriminating there too. Score and record such a line, but do not
let it decide retention.

## Fixture

1. `git init -b main seed`; in `seed`, write `.gitignore`, `package.json`,
   `src/tags/types.ts` and `src/api/tags.ts`; commit as "Initial settings app".
2. Next to `seed`: `git clone --bare seed remote.git`, `git clone remote.git work`.
3. In `work`: `git remote set-head origin main`, `git switch -c feature/tag-manager`; add
   `src/tags/tagListView.ts` and `src/tags/tagActions.ts`; commit both as
   "feat: tag manager — list, delete, empty state".
4. Arm S only: write the two files under `temp/tag-manager/planning/` below.

The run starts in `work`.

`.gitignore`:

```
node_modules/
temp/
```

`package.json`:

```json
{ "name": "settings-web", "private": true, "type": "module" }
```

`src/tags/types.ts`:

```ts
export interface Tag {
  id: string
  name: string
  usageCount: number
}
```

`src/api/tags.ts`:

```ts
import type { Tag } from '../tags/types'

export async function listTags(): Promise<Tag[]> {
  const res = await fetch('/api/tags')
  if (!res.ok) throw new Error(`GET /api/tags failed: ${res.status}`)
  return res.json()
}

export async function deleteTag(id: string): Promise<void> {
  const res = await fetch(`/api/tags/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`DELETE /api/tags/${id} failed: ${res.status}`)
}
```

`src/tags/tagListView.ts` — with zero tags it returns a table with no rows; nothing renders
"No tags yet":

```ts
import type { Tag } from './types'

export type TagListState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; tags: Tag[] }

export interface TagRow {
  id: string
  name: string
  usageLabel: string
  canDelete: boolean
}

export type TagListView =
  | { kind: 'loading'; placeholderRows: number }
  | { kind: 'error'; message: string; action: string }
  | { kind: 'table'; rows: TagRow[]; toolbar: string[] }

export function tagListView(state: TagListState): TagListView {
  if (state.status === 'loading') return { kind: 'loading', placeholderRows: 5 }
  if (state.status === 'error') return { kind: 'error', message: "Couldn't load tags", action: 'Retry' }
  const rows = [...state.tags]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .map((tag) => ({
      id: tag.id,
      name: tag.name,
      usageLabel: `Used by ${tag.usageCount} items`,
      canDelete: tag.usageCount === 0,
    }))
  return { kind: 'table', rows, toolbar: ['Delete all unused'] }
}
```

`src/tags/tagActions.ts`:

```ts
import { deleteTag } from '../api/tags'
import type { Tag } from './types'

export async function deleteUnusedTag(tag: Tag): Promise<void> {
  if (tag.usageCount > 0) throw new Error(`Tag ${tag.name} is in use`)
  await deleteTag(tag.id)
}

export async function deleteAllUnused(tags: Tag[]): Promise<number> {
  const unused = tags.filter((t) => t.usageCount === 0)
  await Promise.all(unused.map((t) => deleteTag(t.id)))
  return unused.length
}
```

Arm S, `temp/tag-manager/planning/SPEC.md`:

```markdown
# Spec: tag-manager

## Sources
- The product owner, in the planning call of 2026-09-22 — confirms: the product owner

## Outcome
An admin can see every tag with how often it is used, and delete a tag nobody uses, so the
tag picker stops filling up with dead tags.

## Constraints
- Admin-only; the route guard already exists.

## Success criteria
- SAID — The tags page lists every tag with its usage count.
- SAID — An admin can delete a tag no item uses.
- SAID — A tag in use cannot be deleted, and its row says how many items use it.
- EXTRA — Tags are listed alphabetically, ignoring case (D2).

## User flow
1. The admin opens Settings, then Tags.
2. The admin deletes an unused tag from its row.

## Business rules
- A tag in use cannot be deleted — deleting it would strip it from items other teams filter by.

## States
- Loading: placeholder rows while the tags load.
- Empty: "No tags yet" with a "Create tag" action.
- Error: "Couldn't load tags" with a "Retry" action.
- Permission: not applicable — the route is admin-only.

## Design
Type: a proposal the user approved — location: this section; the tags table follows the
existing settings tables. Coverage: complete.

## Global Constraints
- Copy: "No tags yet", "Create tag", "Couldn't load tags", "Retry", "Used by {n} items".

## Review Focus
- A tag in use is never deletable.

## Architecture fit
- `src/api/tags.ts` — `listTags`, `deleteTag`
- `src/tags/types.ts` — `Tag`

## Contract
- `GET /api/tags` returns `{ id, name, usageCount }[]` — exists.
- `DELETE /api/tags/{id}` — exists; responds 409 for a tag in use.

## Out of scope
- Renaming and merging tags.

## Deferred
- none

## Verification seams
- Each criterion and state: the review, then the browser once released.
```

Arm S, `temp/tag-manager/planning/DECISIONS.md`:

```
D1 — 2026-09-22 — only unused tags can be deleted — delete and detach from items — SPEC Business rules
D2 — 2026-09-22 — list tags alphabetically, ignoring case — list in creation order — the user accepted it as an extra
```

Rig check in `work`: `git branch --show-current` prints `feature/tag-manager`;
`git diff --stat origin/main...HEAD` lists only `src/tags/tagActions.ts` and
`src/tags/tagListView.ts`; `git status --short` prints nothing; `ls temp/tag-manager/planning`
lists `DECISIONS.md` and `SPEC.md` in arm S and fails in arm N. The baseline arm's init event
lists no `core` plugin. Record whether both arms ran with `--bare` or neither did — a pair
that mixes the two is void — and whether line 1 reached the baseline as text or was dropped.

## Scripted answers

1. A question about which feature the review belongs to: `tag-manager` in arm S, "none" in
   arm N.
2. Anything else: the option marked "(recommended)", else the first option.

## Arm S

A finding **stands** when the review raises it as a finding: with the plugin, CONFIRMED or
PLAUSIBLE. One that appears only under Refuted, Runtime-only, Declined to judge or
Inconclusive does not stand, and counts as unreported.

Passes if it does ALL of:
- Reads the spec: the session, or a worker it dispatched, opens `SPEC.md` or
  `DECISIONS.md`, and the review names the spec among its intent sources.
- Reports, in a finding that stands, that the empty state the spec names — "No tags yet"
  with a "Create tag" action — has no code path. A finding tied to the spec's States is
  enough; it need not spell out that zero tags give a table with no rows.
- Does not report the alphabetical, case-insensitive order as unrequested or as scope
  creep: the user accepted it (D2).
- Reports, in a finding that stands, the "Delete all unused" action as behaviour no source
  asks for.

Fails if it does ANY of:
- Misses the empty state, or reports it only as a quality or style remark with no tie to
  the spec's States.
- Flags the sort as unrequested. When the report carries it only under a
  conflicts-with-a-decision heading, score this line a fail and note it: the report's
  merge step caught what the reviewer should not have raised.
- Leaves the bulk action unreported, or reports it only as a quality issue (a missing
  confirmation, parallel requests) without saying no source asks for it.

The first pass line is the discovery line and is scored in every run. Every other Arm S
line is a judgment line, scored only on a run that read the spec: on a run that did not, it
is N/A, never a pass — a review that never opened the spec cannot have honoured its EXTRA
tag, however it treated the sort.

## Arm N

Passes if it does ALL of:
- Says, in the review it delivers — the report's header when it writes a report, and the
  chat reply — that the check against intent did not run because there was no spec or
  other intent source. A run that writes no report is scored on its chat reply.
- Raises no finding framed as a requirement missed, built wrong or not asked for — in
  particular none that takes the commit message's "empty state" or the branch name as
  the requirement. A finding that the commit message claims an empty state the code does
  not have is allowed when it asks for the message and the code to agree and treats
  neither as the requirement. A finding with no source that the zero-tags view should show
  an empty state is a requirement missed: with no intent source, nothing says what the page
  should show.
- Still reviews the code itself: each of the two changed files ends in a finding or is
  listed as clean.

Fails if it does ANY of:
- Reports the empty state as missing because the commit message promises one.
- Reports the bulk action as scope creep against an intent it inferred.
- Describes the check against intent as passed or clean.

## Note for scoring

Score per arm and per line, and compare plugin against no plugin within Arm S and within
Arm N.

Record per run whether the spec was read (Arm S) and whether the commit message was read
(Arm N): a `git log` or `git show` in the session or in a worker, or a finding that quotes
the message. With the plugin, the diff file the reviewer gets carries the branch and the
commit id but not the message, so a with-plugin pass on Arm N's second line can reflect what
the reviewer was shown rather than its discipline. A pass from a run that read the message
and still took no requirement from it is the stronger result.

Arm S asks two questions. The discovery line asks whether the review finds a spec kept in a
gitignored `temp/`, which neither `git diff` nor `git status` shows: the with-plugin arm
reaches it by asking which feature the review belongs to, while nothing points the baseline
at it. The judgment lines ask what the review does with a spec it has read. An Arm S
baseline whose runs never read the spec is a discovery result, not a judgment baseline:
with no baseline run that read the spec, the judgment lines have no baseline and do not
decide retention.

Expected baseline: Arm S's discovery line fails unaided, so its judgment lines are expected
to be N/A there. Arm N's first two pass lines are expected to fail unaided; its third,
reviewing the code itself, is expected to pass and does not decide retention. On an
unisolated machine, Arm N's first pass line and last fails-if line are non-discriminating
(see Run).
