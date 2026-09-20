---
max_turns: 20
allowed_tools: [Read, Glob, Grep, Skill, Bash]
---

alright everything's staged, give me a commit msg, keep it short but informative

```diff
--- a/src/billing/invoice.ts
+++ b/src/billing/invoice.ts
@@
-export function totalDue(lines: LineItem[]): number {
-  return lines.reduce((sum, l) => sum + l.amount, 0)
-}
+export function totalDue(lines: LineItem[], taxRate: number): number {
+  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0)
+  return subtotal + subtotal * taxRate
+}
```
