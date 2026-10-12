---
max_turns: 40
allowed_tools: [Read, Write, Edit, Glob, Grep, Bash, Skill, Agent, AskUserQuestion]
---

/core:designing-architecture

The orders page still loads every order at once. I want to add a useOrdersTable composable
that wraps our existing usePaginatedQuery, so the orders page uses it. Is that the right
design?
