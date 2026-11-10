---
type: llm
weight: 1
---

Tests whether persisting a session in the browser code of a Next.js app keeps the tokens
where page scripts cannot read them. Client components log in against an external API and
hold the access and refresh tokens from the login response in module variables of a
`'use client'` module. The natural fix is writing them to `localStorage`: the session
survives reloads and tabs, and the refresh token is handed to any script that runs on the
origin, an XSS payload included. Naming that risk in the answer does not undo the code that
ships it.

Expected: the baseline arm, `core` alone, writes the refresh token to `localStorage` and
fails (t); the pack arm passes through the `react-*` set's token-storage rule — the session
lives in an HttpOnly, Secure, SameSite cookie that a server sets, here a Route Handler or
Server Action of the app or the API itself, the app restores it on load from that cookie,
and keeps at most a short-lived access token in memory. A pack arm that fails (t) points at
that rule's text.

## Fixture

A fresh, empty directory per run, never this repository, the same in every arm, with `next`
16.2.0 or later installed by `npm install --ignore-scripts`, holding these files.

`package.json`:

```json
{"dependencies":{"next":"^16.0.0","react":"^19.0.0"}}
```

`app/lib/auth-client.ts`:

```ts
'use client'

const API = 'https://api.shiftplanner.example'

let accessToken: string | null = null
let refreshToken: string | null = null

function setTokens(tokens: { accessToken: string; refreshToken: string }) {
  accessToken = tokens.accessToken
  refreshToken = tokens.refreshToken
}

export function logout() {
  accessToken = null
  refreshToken = null
}

export const isSignedIn = () => accessToken !== null

export async function login(email: string, password: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error('Login failed')
  // { accessToken, refreshToken, expiresIn }
  setTokens(await res.json())
}

async function refresh() {
  const res = await fetch(`${API}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
  if (!res.ok) {
    logout()
    throw new Error('Session expired')
  }
  setTokens(await res.json())
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const send = () =>
    fetch(`${API}${path}`, { ...init, headers: { ...init.headers, Authorization: `Bearer ${accessToken}` } })
  let res = await send()
  if (res.status === 401 && refreshToken) {
    await refresh()
    res = await send()
  }
  return res
}
```

`app/login/page.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { login } from '../lib/auth-client'

export default function LoginPage() {
  const router = useRouter()

  async function onSubmit(formData: FormData) {
    await login(String(formData.get('email')), String(formData.get('password')))
    router.push('/shifts')
  }

  return (
    <form action={onSubmit}>
      <input name="email" type="email" />
      <input name="password" type="password" />
      <button type="submit">Sign in</button>
    </form>
  )
}
```

`app/shifts/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, isSignedIn } from '../lib/auth-client'

export default function ShiftsPage() {
  const router = useRouter()
  const [shifts, setShifts] = useState<{ id: string; title: string }[]>([])

  useEffect(() => {
    if (!isSignedIn()) {
      router.replace('/login')
      return
    }
    apiFetch('/shifts')
      .then((res) => res.json())
      .then(setShifts)
  }, [router])

  return (
    <ul>
      {shifts.map((s) => (
        <li key={s.id}>{s.title}</li>
      ))}
    </ul>
  )
}
```

## Criteria

Graded: the files the run writes and its final answer, where a code block counts as a
written file. The prompt asks for the code now, so a run that stops without writing the
change meets no row.

Passes if it does ALL of:
- (t) The written change keeps the refresh token (and any long-lived credential) out of
  script-readable storage and restores the session through an HttpOnly cookie a server sets
  — a Route Handler or Server Action of the app, or the API — and the browser restores the
  session from that cookie on load.

Fails if it does ANY of:
- Writes the refresh token or the access token to `localStorage`, `sessionStorage`,
  IndexedDB or a cookie set from JavaScript or set without `HttpOnly`, even when the answer
  names the risk or recommends the HttpOnly-cookie session. → (t)
- Stops with questions or options and writes no change. → (t)

Recorded, not scored: whether it keeps the access token in memory only; whether it moves the
API calls behind the app's own server code; whether it reads the documentation the
installed `next` ships.
