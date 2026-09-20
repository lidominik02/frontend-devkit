---
max_turns: 20
allowed_tools: [Read, Glob, Grep, Skill, Bash]
---

Give me a couple of options for the commit message, and tell me if this should be one
commit or split up.

```diff
--- a/src/orders/pricing.ts
+++ b/src/orders/pricing.ts
@@
-export function applyDiscount(total: number, code: string): number {
-  if (code === 'SAVE10') return total * 0.9
-  return total
-}
+export function applyDiscount(total: number, rule: DiscountRule): number {
+  return rule.kind === 'percent'
+    ? total * (1 - rule.value)
+    : Math.max(total - rule.value, 0)
+}
+
+export type DiscountRule =
+  | { kind: 'percent'; value: number }
+  | { kind: 'flat'; value: number }
--- a/src/orders/checkout.ts
+++ b/src/orders/checkout.ts
@@
-import { applyDiscount } from './pricing'
+import { applyDiscount, type DiscountRule } from './pricing'
+
+const CODES: Record<string, DiscountRule> = {
+  SAVE10: { kind: 'percent', value: 0.1 },
+  FIVEOFF: { kind: 'flat', value: 5 },
+}
@@
-  const total = applyDiscount(subtotal, code)
+  const rule = CODES[code]
+  const total = rule ? applyDiscount(subtotal, rule) : subtotal
--- a/src/orders/pricing.test.ts
+++ b/src/orders/pricing.test.ts
@@
-test('SAVE10 takes 10% off', () => {
-  expect(applyDiscount(100, 'SAVE10')).toBe(90)
-})
+test('percent rule takes a fraction off', () => {
+  expect(applyDiscount(100, { kind: 'percent', value: 0.1 })).toBe(90)
+})
+
+test('flat rule floors at zero', () => {
+  expect(applyDiscount(200, { kind: 'flat', value: 5 })).toBe(195)
+  expect(applyDiscount(3, { kind: 'flat', value: 5 })).toBe(0)
+})
```

Everything above is staged, nothing is committed yet.
