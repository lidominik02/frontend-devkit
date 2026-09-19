---
max_turns: 20
allowed_tools: [Read, Glob, Grep, Skill, Bash]
---

/core:verifying-ui

I just added an error state to the saved-searches panel — when the fetch fails it should
show a retry message instead of the "no saved searches yet" placeholder. Check it
actually does that before I push.
