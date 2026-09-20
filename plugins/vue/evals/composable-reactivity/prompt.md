---
max_turns: 20
allowed_tools: [Read, Glob, Grep, Write, Edit, Bash]
---

In a Vue 3 project, write a composable `useOrder` that takes an order id and returns the
order's current status. Then use it from a component that receives `orderId` as a prop.

The component must keep showing the right status when the parent passes a different
`orderId`.
