---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---

on the order page the order date first reads one time and then, right after load, another
one. getOrder returns the timestamp as stored. why are there two values?

```tsx
// app/orders/[id]/OrderDate.tsx
'use client'

export function OrderDate({ placedAt }: { placedAt: string }) {
  return <time dateTime={placedAt}>{new Date(placedAt).toLocaleString()}</time>
}
```

```tsx
// app/orders/[id]/page.tsx
import { getOrder } from '@/lib/orders'
import { OrderDate } from './OrderDate'

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const order = await getOrder(id)
  return (
    <article>
      <h1>Order {order.number}</h1>
      <OrderDate placedAt={order.placedAt} />
    </article>
  )
}
```
