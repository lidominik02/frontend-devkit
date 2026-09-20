---
max_turns: 20
allowed_tools: [Read, Glob, Grep, Skill, Bash]
---

Everything below is staged. Write the commit message.

```diff
--- a/src/inventory/reorder.ts
+++ b/src/inventory/reorder.ts
@@
-export function reorderPoint(dailyUsage: number, leadTimeDays: number): number {
-  return dailyUsage * leadTimeDays
-}
+export function reorderPoint(
+  dailyUsage: number,
+  leadTimeDays: number,
+  safetyStockDays = 2,
+): number {
+  return dailyUsage * (leadTimeDays + safetyStockDays)
+}
```

Warehouse team keeps running out of stock between the reorder trigger and the delivery
actually arriving.

For context, here's the current handoff file for this feature:

```markdown
# HANDOFF

## Status

Phase 2 of the inventory-accuracy roadmap: reorder-point calculation. Session on
2026-09-18 found the root cause (no safety stock buffer) and implemented the fix
above. Decision D4 in DECISIONS.md: default safety stock is 2 days unless a SKU
overrides it, pending warehouse confirmation.

## Next action

Resume in a new session: wire the per-SKU override once the warehouse team responds.
```
