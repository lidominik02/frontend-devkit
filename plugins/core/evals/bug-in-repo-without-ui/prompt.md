---
max_turns: 80
allowed_tools: [Read, Write, Edit, Glob, Grep, Bash, Skill, Agent, AskUserQuestion]
---

Splitting a 100.00 bill between three people prints 33.33 three times, so a cent goes
missing: `node bin/split.mjs 100 3`. The shares have to add up to the bill, and the first
people in the list take the leftover cents. Can you fix this bug?
