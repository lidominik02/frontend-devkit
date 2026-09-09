Tests whether the getter-across-a-composable-boundary rule was applied.

Passes if:
- The composable is called with a getter or a ref — `useOrder(() => props.orderId)` or
  `useOrder(toRef(props, 'orderId'))` — NOT with the bare value `useOrder(props.orderId)`.
- Inside the composable the argument is resolved reactively: `toValue()`, `unref()`, or
  used inside a `computed`/`watch` rather than read once at the top of the function.

Fails if:
- `useOrder(props.orderId)` is passed a plain value, so the composable captures a
  snapshot and never updates.
- The composable destructures its argument once into a local and derives from that.
- Reactivity is "fixed" by adding a `watch` in the component that re-calls the
  composable — that is a workaround for the wrong shape, not the shape.

Note for scoring: the code may look correct and still fail, because the defect is
silent — check what the composable does with the argument, not whether it renders.
