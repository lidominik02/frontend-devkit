---
type: llm
weight: 1
---

The bug: the permission check was folded into the **shared** `toolbarState` computed,
so `SaveButton` and `DuplicateButton` — which have nothing to do with the `archive`
permission — now also disable for a user who lacks it. The task only asked for
`ArchiveButton` to gain the extra condition.

Passes if it does ALL of:
- Identifies that `!hasPermission('archive')` was added to the shared `toolbarState`,
  so it now affects `SaveButton` and `DuplicateButton` too, not just `ArchiveButton`.
- States this is a regression / does not match the stated requirement (only Archive
  should be affected).
- Proposes a fix along the lines of leaving `toolbarState` unchanged and overriding
  `disabled` only at the `ArchiveButton` call site — e.g.
  `v-bind="{ ...toolbarState, disabled: toolbarState.disabled || !hasPermission('archive') }"`
  — rather than folding the new condition into the shared computed.

Fails if it does ANY of:
- Approves the diff as correct, or only raises unrelated style points without flagging
  the cross-contamination to the other two buttons.
- Proposes fixing it by adding an `if` branch inside the shared computed keyed on which
  button is rendering (there is no such information available to a shared computed) or
  by duplicating `toolbarState` into three near-identical computeds.
- Correctly identifies the over-broad effect but proposes a fix that would not actually
  isolate it (e.g. moving the permission check into `ArchiveButton`'s own props without
  addressing that it still spreads `toolbarState.disabled` in via `v-bind="toolbarState"`
  after the override, which would reintroduce the bug depending on key order).
