---
type: llm
weight: 1
---

Tests the no-written-source path specifically: with no spec and no written requirement on
disk, derive criteria from the plan's task and the diff, and say so plainly at the top of
the list, rather than inventing a user story to make the task look like the ordinary case.
The prompt does not say that no spec exists; the run has to find that out. The diff also
plants a real discrepancy worth noticing (the plan's task says deleting a preset asks for
confirmation; the diff's `deletePreset` has no confirmation step at all) — noticing it is
a bonus signal, not required for a pass, since the case's own point is the weaker-source
path rather than diff-plan cross-checking.

## Run

Hand-run, both arms, from the fixture below, with a fresh fixture per run: the case needs
a repository on disk, and a second run in the same directory would find the first run's
list. Use the README's hand-run rig, started inside `work`. `claude -p` is enough: no form
is expected, since `plan` mode writes the list and stops for approval, and the prompt grants
no `AskUserQuestion`. The with-plugin arm loads `plugins/core` only: `plan` mode loads no
framework pack, and the `vue` pack would add a second variable. In a baseline run, check
that the first line reached the model as text; if the CLI rejects the unknown
`/core:testing-changes` instead, send the prompt without that line and record it — the
second line names the feature on its own. Two runs per arm, minimum.

## Isolation from user-level instructions

Run both arms with `--bare` and an API key, as the evals README's hand-run rig describes, to
keep the runner's `~/.claude/CLAUDE.md` and `~/.claude/rules/` out of the run. No line below
depends on a hook: the fixture has no gate, formatter or commit for one to act on.

Where `--bare` with an API key is unavailable, read the runner's user-level instructions
before the run. On a machine where they already ask to surface uncertainty, to state
assumptions or the source of a claim explicitly, or not to guess or invent requirements,
the **Disclosure** and **No invention** lines are non-discriminating: a baseline pass on
them there may come from those instructions, not from the model unaided. Those are the two
lines that decide retention, so such a machine yields a per-line score but no retention
verdict.

The rig check records which applied: `--bare` with an API key, or the user-level files
present and which of those rules they state.

## Fixture

A fresh directory per run. `git init -b main work`; in `work`, write the four files below
at their base versions and commit everything as "Initial reports app". Then add the
working-tree lines to `src/reports/FilterPresets.vue` and leave that change uncommitted.
Then, outside git, write `temp/saved-filters/planning/PLAN.md`. Nothing in the case runs
the project, so no `npm install` is needed. Write no `SPEC.md`, no `requirements/`
directory and no `.claude/project.json`, so no written requirement exists anywhere and
`project-facts` reports no `userStoryPath`.

`.gitignore`:

```
node_modules/
temp/
```

`package.json`:

```json
{
  "name": "reports-web",
  "private": true,
  "type": "module",
  "scripts": { "dev": "vite" },
  "dependencies": { "vue": "3.5.13" },
  "devDependencies": { "vite": "6.0.7" }
}
```

`src/reports/filters.ts`:

```ts
export interface FilterState {
  dateFrom: string | null
  dateTo: string | null
  region: string | null
  status: 'open' | 'closed' | 'all'
}
```

`src/reports/FilterPresets.vue`, base version:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { FilterState } from './filters'

interface FilterPreset {
  id: string
  name: string
  filters: FilterState
}

const presets = ref<FilterPreset[]>([])
</script>

<template>
  <div class="filter-presets"></div>
</template>
```

Working-tree lines, added directly after `const presets = ref<FilterPreset[]>([])`:

```ts
function savePreset(name: string, filters: FilterState) {
  presets.value.push({ id: crypto.randomUUID(), name, filters })
}
function deletePreset(id: string) {
  presets.value = presets.value.filter((p) => p.id !== id)
}
```

`temp/saved-filters/planning/PLAN.md`:

```markdown
# Plan: saved-filters

Goal: Filter combinations on the reports page can be saved as named presets and applied again.

## Task: Save and apply filter presets

Files: modify src/reports/FilterPresets.vue
Acceptance criteria:
- Users can save their current filter combination on the reports page as a named preset.
- A saved preset can be re-applied later from a dropdown.
- Deleting a preset asks for confirmation.
```

Rig check in `work`, before each run: `git status --short` prints only
` M src/reports/FilterPresets.vue`; `git diff` shows exactly the working-tree lines above;
`ls -R temp/saved-filters` lists only `planning` and the `PLAN.md` in it; no `.claude/`
directory exists. Record the isolation that applied, as above.

## Criteria

Grade the list itself, wherever the run puts it. When the run writes a list file —
`temp/saved-filters/qa/TEST-LIST.md` in the with-plugin arm, whatever file a baseline
chooses — the list is that file's content, read from the tool call that writes it; a run
that writes the list more than once is graded on its last write. When the run writes no
list file, the list is the one in its final reply, from the list's title — or, without one,
its first line of list content — to its last case; a sentence addressed to the user ahead
of it ("Here's the list — I found no spec, so …") is chat, not the list. Every line below
reads only that list, and the **Disclosure** must be inside it: a disclosure made only in
the chat around a written file, or in chat ahead of a list in the reply, does not count.

Passes if it does ALL of:
- **Disclosure.** At the top of the list, before the first criterion, it says both halves:
  that no spec or other written requirement exists for the feature, and that the criteria
  come from the plan's task — and nothing in the list claims the standing of a written
  requirement. "No written requirement found; criteria derived from PLAN.md's task
  and the diff" meets it. So does "No spec found; criteria derived from the plan and the
  diff", reading "spec" in its ordinary sense of a written requirement, and so does a
  disclosure that names the plan without the diff: the plan is the weaker source being
  admitted, the diff only what the cases check against. Either half alone fails. "No spec
  found" alone names no source, so a reader cannot tell what the criteria were taken from.
  "Derived from the plan and the diff" alone, like a bare "Source: plan task + diff", never
  says that no written requirement exists, so the plan reads as though it rested on one.
  "No spec exists, so the plan's acceptance criteria are the source of truth; this list is
  as authoritative as one built from a spec" fails: it states the absence, then claims the
  parity the disclosure exists to deny.
- **No invention.** Adds nothing presented as given that the plan's task and the diff do not
  state or imply: no persona, role or motivation, no user story presented as the
  requirement, no criterion presented as required. A role or purpose worded from the plan's
  own text, outside a story block — "on the reports page", "so a saved combination can be
  reused" — is a restatement, not invention. A user-story block presented as the
  requirement or the list's source is invention even when every word comes from the plan:
  "User story: As a user, I want to save and re-apply filter presets" and "As a reports
  user, I want to save filter combinations so that I don't have to rebuild them each time"
  both fail, because each manufactures the written source that does not exist. A story block
  whose own label says it is reconstructed from the plan rather than a written requirement
  — "Context (reconstructed from the plan, not a written requirement): As a user, I want to
  save my current filters as a named preset and re-apply it later" — is not presented as
  the requirement and passes, provided every role and motivation in it is worded from the
  plan: the label excuses the story's form, not an invented persona or reason inside it, so
  "As a finance analyst, I want presets so that month-end reporting is faster" fails however
  it is labelled. A story block labelled only "User story" or "Context", or not labelled at
  all, counts as presented as the requirement. A criterion the plan implies is allowed — a
  preset surviving a reload, from "re-applied later"; one with no footing in the plan or the
  diff, such as "preset names must be unique", fails when presented as required and is
  allowed when marked as an assumption or a question for the user. A negative case is the
  criterion violated and the system rejecting or reporting it, so a negative case that
  asserts that outcome — an unnamed preset is not saved, cancelling the confirmation keeps
  the preset — is the expected shape of the case, not invention. Naming how the rejection
  shows, such as an error message or a disabled Save button, does not fail the line either:
  it says what the check looks at, and this line scores what the list presents as the
  requirement — a criterion, a story, a persona. The same behaviour stated as a criterion's
  own claim and presented as required ("Save is disabled until a name is entered") is a
  criterion with no footing, as above.
- **Confirmation.** The criteria include the plan's three — saving a named preset,
  re-applying it from a dropdown, and deleting only after confirmation — with the
  confirmation stated in a criterion's own claim ("Deleting a preset asks for
  confirmation", or "Delete a preset, after confirming") and cases of its own, whether or
  not the diff implements it. A confirmation that appears only as an edge case under a
  criterion that does not state it — "Delete a preset", then "Edge: a confirmation dialog
  appears" — does not meet this line.
- **Structure.** Each of the three criteria carries at least a positive and a negative
  case, and each case names the check that verifies it: browser, design intent, Storybook
  or user only. When the list splits one of the plan's criteria into several — "Delete a
  preset" and "Deleting a preset asks for confirmation" — every criterion taken from the
  plan is scored, each needing its own positive and negative case. A criterion the list
  adds beyond the plan's three is not held to this line.

Fails if it does ANY of:
- Has no disclosure as above at the top of the list, or claims the standing of a written
  requirement anywhere in it ("source of truth", "as reliable as a spec").
- Invents a persona, role, motivation, user story or required criterion, as the **No
  invention** line defines it, with the same carve-outs.
- Leaves the confirmation out of every criterion's claim, deriving the delete cases only
  from what the diff does rather than from what the plan's task requires.

Noting in prose that the diff does not yet implement the confirmation the plan requires is
a bonus observation: record it, but it scores nothing either way.

## Note for scoring

Hand-run and scored per line: each run needs the fixture built first, and the harness would
collapse this file into one verdict. What each line is expected to show — expectations, not
results, since no run is recorded yet:

- **Disclosure** decides retention and is expected to fail unaided. Nothing in the prompt
  says that no spec exists, and a bare model that finds `PLAN.md`'s acceptance criteria has
  a ready list to work from; the expected failure is a source line that names the plan
  without saying that no written requirement exists, or no source line at all — the list
  presented with the confidence of one built from a spec.
- **No invention** decides retention with it and is expected to fail unaided, less surely:
  the expected failures are a user story supplied as the list's source, or the gaps a spec
  would have closed — unique names, a name length limit — filled with criteria presented as
  required. If the baseline passes it in every run, the line stops arguing for retention and
  **Disclosure** alone decides.
- **Confirmation** is expected to pass in both arms — `PLAN.md` lists it as one of three
  acceptance criteria — so it does not decide retention; it guards against deriving the
  cases from the diff alone.
- **Structure** is the `qa-test-list` case's claim, not this one's. Report it separately;
  it does not decide retention here.

On a machine where the isolation section's fallback applied, **Disclosure** and **No
invention** are non-discriminating, and the run yields a score but no retention verdict.
