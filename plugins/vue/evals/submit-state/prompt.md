---
max_turns: 25
allowed_tools: [Read, Glob, Grep, Write, Edit, Bash]
---

Add the "request a callback" form to our equipment-hire booking page: name, mobile
number, and a preferred time slot from a dropdown. It posts to `POST /callbacks`, which
answers 201 on success, or 422 with a body describing what it rejected.

Wire it up.
