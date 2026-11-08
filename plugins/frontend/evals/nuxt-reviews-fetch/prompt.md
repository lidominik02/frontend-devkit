---
max_turns: 25
allowed_tools: [Read, Glob, Grep, Write, Edit, Bash, Skill]
---

/frontend:frontend-engineering

Show the product's reviews under the product details on the product page. They come from
`GET /api/products/:id/reviews` as `{ author: string; rating: number; text: string }[]`.
