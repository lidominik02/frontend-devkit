---
max_turns: 20
allowed_tools: [Read, Write, Glob, Grep, Skill]
---

/core:testing-changes plan low-stock-alerts

<user_story>
Warehouse staff should get an alert when an item's stock falls to or below its
configured reorder threshold. The alert should appear in the app's notification bell,
and staff can dismiss it. If an item's threshold is set to 0, alerts are disabled for
that item — treat 0 as "never alert", not "alert immediately at zero".
</user_story>

There's no existing test list for this feature yet.
