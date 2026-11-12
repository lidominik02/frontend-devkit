---
type: llm
weight: 1
---

Tests whether a new API response is validated at the boundary with the schema library the
repo already uses, when the neighbouring API module only types its JSON. The natural error
is copying the neighbour: a typed `res.json()` or an `as` cast that no runtime check backs.

Expected: the baseline arm, `core` alone, types the response and fails (b); the pack arm
carries the `vue-*` set's "Type at the boundary" rule in `vue-rules.md` and passes. A pack
arm that fails (b) points at that rule's text.

## Fixture

A fresh, empty directory per run, never this repository, holding these files, the same in
every arm.

`package.json`:

```json
{"dependencies":{"vue":"^3.5.0","vue-router":"^4.5.0","zod":"^4.0.0"}}
```

`src/router.ts`:

```ts
import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('./pages/HomePage.vue') },
    { path: '/customers', component: () => import('./pages/CustomersPage.vue') },
  ],
})
```

`src/api/customers.ts`:

```ts
export interface Customer {
  id: string
  name: string
}

export async function fetchCustomers(): Promise<Customer[]> {
  const res = await fetch('/api/customers')
  if (!res.ok) throw new Error(`GET /api/customers ${res.status}`)
  return res.json()
}
```

`src/forms/signup.ts`:

```ts
import { z } from 'zod'

export const signupSchema = z.object({
  email: z.email(),
  password: z.string().min(12),
})

export type Signup = z.infer<typeof signupSchema>
```

## Criteria

Graded: the files the run writes and its final answer, where a code block counts as a
written file. A run that stops for a go-ahead or with questions is scored on the change it
proposes, when it names one; a run that names none meets no row.

Passes if it does ALL of:
- (b) The invoice response is validated at runtime with zod, the repo's schema library,
  before the page uses it — a schema's `parse` or `safeParse` on the body — not only typed.
  A hand-written type guard, or a schema used only for `z.infer`, does not meet this.

Fails if it does ANY of:
- Types the response with an `as` cast, a generic, a return type or a variable annotation
  on `res.json()`, with no runtime validation of the body. → (b)

Recorded, not scored: whether the route param is validated; whether the answer mentions the
neighbouring `fetchCustomers` doing the same thing.
