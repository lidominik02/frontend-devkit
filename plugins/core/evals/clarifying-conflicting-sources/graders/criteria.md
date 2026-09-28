---
type: llm
weight: 1
---

Tests whether sources that disagree become a question whose recommendation follows
authority — a rule its owner confirmed, then the written story, then the design, and a
document written from the design never above the design itself — rather than a silent
pick, and whether the answer is recorded with the source that lost. Capability, on
`clarifying-features`.

The fixture plants two conflicts:

- **Confirmation.** The story and the product owner's confirmed rule require a confirmation
  before archiving; the frame, and the notes written from it, archive straight away with an
  undo toast. The owner's rule wins.
- **Undo window.** The frame's export keeps undo available for 5 seconds before the archive
  is final; the handover notes, dated two days after the frame's version and saying they
  were written from it, give 10. The frame wins: a derived document never outranks its
  source. "Written beats visual" and "newer wins" both pick the notes, and the window
  decides when an archive becomes final — behaviour, not a visual detail the design would
  own — so the notes' 10 seconds is the confident wrong answer this conflict exists to
  catch.

## Run

Hand-run, both arms, from the fixture below, with the scripted answers. The skill asks
through forms, so a harness run ends at its first form with nothing written. Use the
README's hand-run rig, interactively (`claude`, not `-p`), so each form can be answered;
the with-plugin arm loads `plugins/core` and `plugins/vue`, since the fixture is a Vue
app. Every run gets `--strict-mcp-config` with an empty `{"mcpServers":{}}`, so the export
is the only way to the frame. Stop where the scripted answers say.

**User-level instructions.** Where an API key is available, run both arms with `--bare`, as
the evals README's hand-run rig describes. No line here depends on a hook. Without an API
key, run without `--bare` and score the lines "Note for scoring" names as
non-discriminating on that machine.

## Fixture

A fresh directory per run, a git repository with one commit:

```
.gitignore                     node_modules/ and temp/, one per line
package.json                   below
src/api/messages.ts            below
src/components/ConfirmDialog.vue   below
src/inbox/InboxList.vue        below
```

`package.json`:

```json
{
  "name": "inbox-web",
  "private": true,
  "type": "module",
  "scripts": { "typecheck": "vue-tsc --noEmit", "lint": "eslint src" },
  "dependencies": { "vue": "^3.5.0" },
  "devDependencies": { "eslint": "^9.0.0", "typescript": "^5.6.0", "vue-tsc": "^2.1.0" }
}
```

`src/api/messages.ts`:

```ts
export interface Message { id: string; subject: string; receivedAt: string; archived: boolean }

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

export const listMessages = () => request<Message[]>('GET', '/messages')
export const archiveMessages = (ids: string[]) => request<{ archived: string[] }>('POST', '/messages/archive', { ids })
export const restoreMessages = (ids: string[]) => request<{ restored: string[] }>('POST', '/messages/restore', { ids })
export const deleteMessage = (id: string) => request<void>('DELETE', `/messages/${encodeURIComponent(id)}`)
```

`src/components/ConfirmDialog.vue`:

```vue
<script setup lang="ts">
defineProps<{ title: string; confirmLabel: string }>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <div role="dialog" aria-labelledby="confirm-title">
    <h2 id="confirm-title">{{ title }}</h2>
    <slot />
    <button @click="emit('confirm')">{{ confirmLabel }}</button>
    <button @click="emit('cancel')">Cancel</button>
  </div>
</template>
```

`src/inbox/InboxList.vue`:

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { deleteMessage, listMessages, type Message } from '../api/messages'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const messages = ref<Message[]>([])
const selected = ref(new Set<string>())
const pendingDelete = ref<Message | null>(null)

onMounted(async () => {
  messages.value = await listMessages()
})

function toggle(id: string) {
  if (selected.value.has(id)) selected.value.delete(id)
  else selected.value.add(id)
}

async function confirmDelete() {
  if (!pendingDelete.value) return
  await deleteMessage(pendingDelete.value.id)
  messages.value = messages.value.filter((m) => m.id !== pendingDelete.value?.id)
  pendingDelete.value = null
}
</script>

<template>
  <ul>
    <li v-for="m in messages" :key="m.id">
      <input type="checkbox" :checked="selected.has(m.id)" @change="toggle(m.id)" :aria-label="`Select ${m.subject}`" />
      {{ m.subject }}
      <button @click="pendingDelete = m">Delete</button>
    </li>
  </ul>
  <ConfirmDialog v-if="pendingDelete" title="Delete this message?" confirm-label="Delete" @confirm="confirmDelete" @cancel="pendingDelete = null" />
</template>
```

After the commit, outside git:

- `temp/bulk-archive/requirements/story.md`:

  ```markdown
  # Bulk archive

  As an inbox user, I want to select several messages and archive them in one action, so
  I can clear my inbox quickly. Archiving asks me to confirm before anything is archived.
  ```

- `temp/bulk-archive/requirements/handover-notes.md`:

  ```markdown
  # Bulk archive — handover notes

  Written from the design frame "Inbox — bulk select" on 2026-09-12, for the sprint handover.

  - Selecting 2 or more messages shows "Archive selected" in the toolbar.
  - Archive runs immediately; no confirmation.
  - Undo toast for 10 seconds, then the archive is final.
  ```

- `temp/bulk-archive/design/inbox-bulk-select.svg`, the frame exported with its text kept
  as text:

  ```svg
  <svg xmlns="http://www.w3.org/2000/svg" width="720" height="480" viewBox="0 0 720 480">
    <title>Inbox — bulk select</title>
    <text x="24" y="28" font-size="12">Inbox — bulk select · v3 · 2026-09-10</text>
    <g id="toolbar">
      <rect x="24" y="48" width="672" height="48" fill="#f4f4f5"/>
      <text x="40" y="78" font-size="14">2 selected</text>
      <g id="archive-selected">
        <rect x="544" y="56" width="136" height="32" rx="6" fill="#1d4ed8"/>
        <text x="560" y="77" font-size="14" fill="#ffffff">Archive selected</text>
      </g>
    </g>
    <g id="message-list">
      <text x="40" y="132" font-size="14">☑ Invoice 2291 overdue</text>
      <text x="40" y="164" font-size="14">☑ Team offsite agenda</text>
      <text x="40" y="196" font-size="14">☐ Password expires in 3 days</text>
    </g>
    <g id="toast">
      <rect x="224" y="400" width="272" height="40" rx="6" fill="#18181b"/>
      <text x="240" y="425" font-size="14" fill="#ffffff">2 messages archived · Undo</text>
    </g>
    <g id="annotations">
      <text x="24" y="456" font-size="12" fill="#b91c1c">Archive selected: archives immediately and shows the toast.</text>
      <text x="24" y="472" font-size="12" fill="#b91c1c">Toast: undo available for 5 s, then the archive is final.</text>
    </g>
  </svg>
  ```

Rig check before each run: `git status --short` prints nothing,
`ls temp/bulk-archive/requirements` lists exactly `handover-notes.md` and `story.md`,
`ls temp/bulk-archive/design` lists exactly `inbox-bulk-select.svg`, and `/mcp` in the
session lists no connected server. Record which isolation applied: `--bare` with an API key,
or, without it, the user-level instruction files present
(`ls ~/.claude/CLAUDE.md ~/.claude/rules/`).

## Scripted answers

In order of precedence, for every form or chat question in either arm:

1. A question about either conflict: the option marked "(recommended)"; with none marked,
   record that and pick the first option; raised in chat with no options, "Go with what
   you'd recommend." The recommendation is scored, the answer is not.
2. A question asking for more of the frame — the live link, screenshots: the free-text
   answer "That export is all I have — work from it."
3. The extras block: "leave it out" for every extra.
4. The question confirming the spec (Plan it, Change something, Stop here): "Plan it".
   End the session at the next question after it, unanswered.
5. A question asking whether to start building: end the session there, unanswered.
6. Anything else: the option marked "(recommended)"; with none marked, the first option.
   A chat question with no options gets "Go with what you'd recommend."

A chat message holding several questions gets one reply, answering each by these rules. The
session also ends when the run ends its turn with no question and no background task still
running, and at the first edit to an application file, which is scored.

Record, per run, the full text of every question asked, its options in order, and the
option picked.

## Criteria

"The decision log" is `temp/bulk-archive/planning/DECISIONS.md` with the plugin. In the
baseline arm it is whichever file records decisions or, when there is none, the final chat
message that records them. "An application file" is anything under `src/` or
`package.json`.

Passes if it does ALL of:
- Puts the confirmation conflict to the user as a question that states both sides and
  where each comes from — the frame, and the notes written from it, archive straight away,
  and naming either passes; the story and the product owner require a confirmation — with
  the confirmation step as the recommended answer.
- Puts the undo-window conflict to the user as a question — the frame's 5 seconds against
  the notes' 10 — with 5 seconds recommended, and the recommendation's stated reason is that
  the notes were written from the frame. A 5-second recommendation resting on anything else
  — the design owning interaction details, a common default, which source is newer — fails
  this line.
- Records each answer in the decision log with the losing source named in the same entry as
  the rejected alternative: "immediate archive (frame)" for the first, "10 seconds (handover
  notes)" for the second. A rejected alternative without its source fails.
- Keeps the undo toast alongside the confirmation step: the conflict was about the
  confirmation, not the toast.
- Implements nothing: no application file is created or changed.

Fails if it does ANY of:
- Settles either conflict without asking — including settling it the right way. An entry
  tagged assumed in a draft, before the question is asked, is not settling it.
- Recommends the notes' 10 seconds, treating written notes as outranking the frame they
  were written from; or recommends archiving without a confirmation.
- Asks about a conflict with no recommendation, or with one it does not tie to a source.
  For the undo window, a recommendation tied to anything but the notes having been written
  from the frame counts as untied.
- Records only the winning answer, or a rejected alternative without its source.
- Averages the sources — a confirmation only above some selection size no source
  mentions, offered as a considered decision.
- Drops the undo toast — including a drop the run recommended and the scripted answer
  accepted.

## Note for scoring

Score per line. The baseline is expected to fail the undo-window line — by recommending the
notes, by settling it silently, or by recommending 5 seconds for another reason — and the
losing-source line. The undo-window line is the one that separates the authority order from
a simpler ladder: the frame's version is older than the notes and the 5 seconds appears
nowhere in chat, so "newer wins" and "written beats visual" both pick the notes, and only
the derivation reason recommends the frame. The confirmation line is not that evidence: it
passes on any ladder that ranks the product owner first.

**Lines a runner's user-level instructions can decide.** Without `--bare`, user-level
instructions load in both arms. Where they tell the model to ask rather than guess, they
already carry the confirmation question line and the no-silent-settling line; where they
tell it to surface a conflict rather than average it, the averaging line; where they prefer
the more recent of two sources, they push both arms toward the notes, and the undo-window
line joins the others. On such a machine, record those lines but score them
non-discriminating.
