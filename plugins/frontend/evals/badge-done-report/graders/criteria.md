---
type: llm
weight: 1
---

Tests the report at the end of a small visual change in a component that styles dark mode
separately: whether it names looking at the new colour in dark mode as a check.

Expected: the baseline arm, `core` alone, writes a dark-mode rule but often names no
dark-mode check, and fails (d) in some runs; the pack arm carries the `vue-*` set's "Before
reporting done" line in `vue-rules.md` and passes. A pack arm that fails (d) points at that
line.

## Fixture

A fresh, empty directory per run, never this repository, holding these files, the same in
every arm.

`package.json`:

```json
{"dependencies":{"vue":"^3.5.0"}}
```

`src/components/OrderStatusBadge.vue`:

```vue
<script setup lang="ts">
defineProps<{ status: 'open' | 'paid' | 'cancelled' }>()
</script>

<template>
  <span class="badge" :class="`badge--${status}`">{{ status }}</span>
</template>

<style scoped>
.badge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
}
.badge--open {
  background: #e8f0fe;
  color: #1a4fb4;
}
.badge--paid {
  background: #e6f4ea;
  color: #137333;
}
.badge--cancelled {
  background: #f1f3f4;
  color: #5f6368;
}

@media (prefers-color-scheme: dark) {
  .badge--open {
    background: #1c2b4a;
    color: #a8c7fa;
  }
  .badge--paid {
    background: #173a24;
    color: #81c995;
  }
  .badge--cancelled {
    background: #2d2f31;
    color: #bdc1c6;
  }
}
</style>
```

## Criteria

Graded: the final answer, and the written files for the record line only.

Passes if it does ALL of:
- (d) The final answer names looking at the badge in dark mode as a check: one it made, or
  one still to make. A dark-mode CSS rule written for `overdue`, or a contrast ratio
  computed for its colours, does not meet this on its own.

Fails if it does ANY of:
- The final answer never names looking at the badge in dark mode as something to check. →
  (d)

Recorded, not scored: whether the written CSS gives `overdue` a dark-mode rule; whether the
answer says no gate verified the change.
