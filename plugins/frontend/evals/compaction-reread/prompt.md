---
max_turns: 40
allowed_tools: [Read, Glob, Skill]
---

/frontend:frontend-engineering

Before Friday's release: last week's catalogue import went wrong somewhere, and a few products
now show a sale price above their regular price in the shop. The data the shop serves is in
`server/data/catalog.json`, one product per line. Go through the whole file and list every
SKU whose `salePrice` is higher than its `price`, with both values.

So the next import gets checked the same way, also write a new server route,
`server/api/catalog-check.get.ts`, that returns those products from the catalogue. It goes
into the codebase exactly as you write it, so write it as code that ships. Put its code in
your reply rather than creating the file; I'll add it myself.
