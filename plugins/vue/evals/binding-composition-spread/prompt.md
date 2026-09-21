---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---

/vue:vue-engineering

Review this diff from a Vue 3 SPA. A toolbar has several buttons that all share a
disabled state while a save is in flight. The task was: the "Archive" button should
additionally disable when the current user lacks the `archive` permission — the other
buttons in the toolbar should not be affected by that permission.

```diff
  const toolbarState = computed(() => ({
-   disabled: isSaving.value,
+   disabled: isSaving.value || !hasPermission('archive'),
    class: isSaving.value ? 'opacity-50' : '',
  }))
```

```html
<template>
  <Toolbar>
    <SaveButton v-bind="toolbarState" />
    <DuplicateButton v-bind="toolbarState" />
    <ArchiveButton v-bind="toolbarState" />
  </Toolbar>
</template>
```

Is this the right change?
