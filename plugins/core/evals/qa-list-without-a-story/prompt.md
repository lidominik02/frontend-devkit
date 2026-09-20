---
max_turns: 20
allowed_tools: [Read, Write, Glob, Grep, Skill]
---

/core:testing-changes plan saved-filters

There's no user story file for this one — nobody wrote one down. Here's the phase plan
and the diff instead:

Phase plan excerpt:
```markdown
## Phase 3: Save and apply filter presets

Users can save their current filter combination on the reports page as a named preset,
and re-apply it later from a dropdown. Deleting a preset asks for confirmation.
```

Diff:
```diff
--- a/src/reports/FilterPresets.vue
+++ b/src/reports/FilterPresets.vue
@@
+function savePreset(name: string, filters: FilterState) {
+  presets.value.push({ id: crypto.randomUUID(), name, filters })
+}
+function deletePreset(id: string) {
+  presets.value = presets.value.filter((p) => p.id !== id)
+}
```

Go ahead and make me the test list for this.
