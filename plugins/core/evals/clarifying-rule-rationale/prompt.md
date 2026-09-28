---
max_turns: 70
allowed_tools: [Read, Write, Edit, Glob, Grep, Skill, Bash, Agent, AskUserQuestion]
---

/core:clarifying-features new warehouse-transfer-approvals

<user_story>
Right now any warehouse manager can move stock between warehouses instantly, no
approval needed. Finance wants a threshold: transfers under $5,000 in stock value stay
instant, but anything at or above that needs a second manager (not the one who
initiated it) to approve before the stock actually moves. Rejected transfers should
notify the initiator with a reason. This is because two large transfers last quarter
were used to hide a shrinkage problem between locations before an audit.

A transfer still waiting for approval after 48 hours is cancelled, and the stock stays
where it is.
</user_story>

This repo is a Vue 3 SPA with a Pinia store per domain and a REST client generated from
an OpenAPI spec. There's no design for this yet.
