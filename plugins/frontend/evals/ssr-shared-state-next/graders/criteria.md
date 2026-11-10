---
type: llm
weight: 1
---

The positive mirror of `plugins/frontend/evals/module-scope-state-react/`. Identical prompt
and identical module, only the fixture differs: here a Server Component layout of a Next.js
app writes the signed-in member into the module-scope `currentMember`, and a Server
Component page reads it back. One Node process renders every request, so the variable is
shared by all of them: a concurrent request for another member can overwrite it between
the write and the read, and the page lists one member's reservations to another. It checks
that the pack selects `react-* + next-*` and treats the same code it accepts in an SPA as a
cross-user data leak on the server.

Expected: both arms pass. Keep it anyway: its job is to catch a regression if the selection
ever gives a Next workspace the SPA reading of module scope.

## Fixture

A fresh, empty directory per run, never this repository, with `next` 16.2.0 or later
installed by `npm install --ignore-scripts`, holding these files.

`package.json`:

```json
{"dependencies":{"next":"^16.0.0","react":"^19.0.0"}}
```

`src/lib/current-member.ts`: the code block of the prompt, verbatim.

`src/app/layout.tsx`:

```tsx
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { setCurrentMember, type Member } from '../lib/current-member'

async function loadMember(): Promise<Member | null> {
  const session = (await cookies()).get('session')?.value
  if (!session) return null
  const res = await fetch(`${process.env.MEMBERS_API_URL}/me`, {
    headers: { Authorization: `Bearer ${session}` },
    cache: 'no-store',
  })
  return res.ok ? res.json() : null
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const member = await loadMember()
  setCurrentMember(member)

  return (
    <html lang="en">
      <body>
        <header>{member ? member.name : <a href="/login">Sign in</a>}</header>
        {children}
      </body>
    </html>
  )
}
```

`src/app/reservations/page.tsx`:

```tsx
import { getCurrentMember } from '../../lib/current-member'

type Reservation = { id: string; toolName: string; pickupDate: string }

export default async function ReservationsPage() {
  const member = getCurrentMember()
  if (!member) return <p>Sign in to see your reservations.</p>

  const res = await fetch(`${process.env.MEMBERS_API_URL}/members/${member.id}/reservations`, {
    headers: { Authorization: `Bearer ${process.env.MEMBERS_API_KEY}` },
    cache: 'no-store',
  })
  const reservations: Reservation[] = await res.json()

  return (
    <ul>
      {reservations.map((r) => (
        <li key={r.id}>
          {r.toolName}, pick up {r.pickupDate}
        </li>
      ))}
    </ul>
  )
}
```

## Criteria

Graded: the final answer.

Passes if it does ALL of:
- (l) Identifies the module-scope `currentMember` as shared by every request the server
  process renders, says what that means concretely — one member's reservations or name
  rendered for another member — and treats it as a serious defect, not a style note:
  Critical, blocking, a data leak, a privacy bug or a cross-user/cross-request problem.
- (f) Fixes it with a per-request shape: the page reads the member from the request itself
  (`cookies()` in the page or in a loader wrapped in React's `cache`, which dedupes within
  one request), or the value is passed down per request — never stored at module scope.

Fails if it does ANY of:
- Says the module is fine, or raises only unrelated concerns (the value is not reactive,
  error handling, the API key) without the cross-request leak. → (l)
- Frames the leak as conditional — "if this were server rendered, this would be a
  problem" — when the fixture renders it on the server. → (l)
- Suggests another module-scope container (a `Map` keyed by session or member id, a class
  instance, a global) as the fix. → (f)
- Only marks the module `'use client'` or guards the write with a `typeof window` check,
  which leaves the server pages without a per-request member. → (f)

Recorded, not scored: whether it also names that the layout and the page render without a
guaranteed order, or that a layout does not re-render on client navigation; whether it reads
the documentation the installed `next` ships.
