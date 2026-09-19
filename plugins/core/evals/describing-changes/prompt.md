---
max_turns: 20
allowed_tools: [Read, Glob, Grep, Skill, Bash]
---

I've finished this change and I'm ready to push it. Write the commit message and the
merge request description.

```diff
--- a/src/session/refresh.ts
+++ b/src/session/refresh.ts
@@
-const REFRESH_MARGIN_MS = 30_000
+const REFRESH_MARGIN_MS = 120_000
 
 export function scheduleRefresh(expiresAt: number, refresh: () => Promise<void>) {
-  const delay = expiresAt - Date.now() - REFRESH_MARGIN_MS
-  setTimeout(refresh, delay)
+  const delay = Math.max(expiresAt - Date.now() - REFRESH_MARGIN_MS, 0)
+  const timer = setTimeout(refresh, delay)
+  return () => clearTimeout(timer)
 }
```

Support have been getting reports of people being logged out mid-form on slow
connections.
