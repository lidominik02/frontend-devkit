---
max_turns: 25
allowed_tools: [Read, Glob, Grep, Write, Edit, Bash, Skill]
---

/frontend:frontend-engineering

Add an invoice detail page. `InvoiceDetail.vue` shows an invoice's number, customer name,
line items and total, from `GET /api/invoices/:id`, with the id taken from the route. Put
the request in `src/api/invoices.ts` next to the other API module, and add the route.

The endpoint answers like this:

```json
{
  "number": "INV-2041",
  "customer": { "id": "c_9", "name": "Acme Ltd" },
  "lines": [{ "description": "Scissor lift, 2 days", "quantity": 2, "unitPrice": 14000 }],
  "total": 28000
}
```
