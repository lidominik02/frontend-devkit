---
max_turns: 60
allowed_tools: [Read, Write, Edit, Glob, Grep, Skill, Bash, Agent, AskUserQuestion]
---

/core:clarifying-features

Ticket #4471 just landed on me. Its title is "Supplier list: inactive suppliers" and that's
all it says. Here are my notes from the call with purchasing:

> - a beszállítói listában alapból ne látszódjanak az inaktív beszállítók
> - legyen egy kapcsoló, amivel mégis megjeleníthetők
> - inaktív beszállítónak nem lehet új rendelést leadni
> - design: https://www.figma.com/design/Q7pXz2LmNc4R/Procurement?node-id=118-2045

The supplier list already paginates on the server, so that part's covered. Let's get this
one going.
