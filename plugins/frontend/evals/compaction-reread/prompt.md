---
max_turns: 40
allowed_tools: [Read, Glob, Skill]
---

/frontend:frontend-engineering

Two things before Friday's release, in this order: finish the first before you open
anything for the second.

First, last week's catalogue import went wrong somewhere: a few products now show a sale
price above their regular price in the shop. The data the shop serves is in
`server/data/catalog.json`, one product per line. Go through the whole file and list every
SKU whose `salePrice` is higher than its `price`, with both values.

Second, a teammate added `composables/useRecentlyViewed.ts` so the product page can show the
last few products a shopper looked at. Review it before it merges: can it ship as it is?
