---
type: llm
weight: 1
---

A negative test, and one half of a matched pair with
`plugins/frontend/evals/ssr-shared-state-next/`: identical prompt and identical module,
only the fixture differs. Here the module sits in a client-only React SPA mounted with
`createRoot`, so the module-scope `currentMember` is one value per browser tab, set after
the tab loads `/api/me` and cleared on logout. It checks that the pack does NOT apply the
server-rendering rule where it does not belong: the `react-spa-*` set is selected, never
`next-*`.

Expected: both arms pass. Keep it anyway: its job is to catch a regression if server
guidance ever leaks into the `react-spa-*` set, which is a different question from whether
the pack adds capability.

## Fixture

A fresh, empty directory per run, never this repository, holding these files.

`package.json`:

```json
{"dependencies":{"react":"^19.0.0","react-dom":"^19.0.0"}}
```

`src/lib/current-member.ts`: the code block of the prompt, verbatim.

`src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`src/App.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { setCurrentMember, type Member } from './lib/current-member'
import { ReserveButton } from './ReserveButton'

export function App() {
  const [member, setMember] = useState<Member | null>(null)

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((me: Member | null) => {
        setCurrentMember(me)
        setMember(me)
      })
  }, [])

  async function signOut() {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' })
    setCurrentMember(null)
    setMember(null)
  }

  if (!member) return <a href="/login">Sign in</a>

  return (
    <main>
      <header>
        {member.name} <button onClick={signOut}>Sign out</button>
      </header>
      <h1>Cordless drill</h1>
      <ReserveButton toolId="drill-18v" />
    </main>
  )
}
```

`src/ReserveButton.tsx`:

```tsx
import { getCurrentMember } from './lib/current-member'

export function ReserveButton({ toolId }: { toolId: string }) {
  async function reserve() {
    const member = getCurrentMember()
    if (!member) return
    await fetch(`/api/tools/${toolId}/reservations`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: member.id }),
    })
  }

  return <button onClick={reserve}>Reserve</button>
}
```

## Criteria

Graded: the final answer.

Passes if it does ALL of:
- (s) Treats the module-scope `currentMember` as acceptable for a client-only SPA — one
  value per tab — or raises only genuine concerns (the value is not reactive, two sources
  of truth beside the `member` state, the server should take the member from the session
  rather than the request body). If it mentions server rendering at all, it does so as a
  conditional: "if this app were ever server rendered, this would leak between requests."

Fails if it does ANY of:
- Calls the module-scope variable a security bug, a cross-request leak, or state shared
  between users or sessions, in an app that mounts with `createRoot` and renders nothing on
  a server. → (s)
- Rates module scope itself Critical, blocking or must-fix. → (s)

Recorded, not scored: which set the selection line names; the other findings.
