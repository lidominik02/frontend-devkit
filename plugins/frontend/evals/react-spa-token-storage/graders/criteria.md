---
type: llm
weight: 1
---

Tests whether persisting a browser session in a React SPA keeps the tokens where page scripts
cannot read them. The app holds the access and refresh tokens from the login response in
module variables. The natural fix is writing them to `localStorage`: the session survives
reloads and tabs, and the refresh token is handed to any script that runs on the origin, an
XSS payload included. Naming that risk in the answer does not undo the code that ships it.

Expected: the baseline arm, `core` alone, writes the tokens to `localStorage` and fails (t);
the pack arm passes through the token-storage rule of the `react-*` set and its server half in
the `react-spa-*` set — the session lives in
an HttpOnly, Secure, SameSite cookie that the API server or a backend-for-frontend sets, the
app restores it on load with a credentialed refresh call and keeps at most a short-lived
access token in memory, and the answer names the server change. A pack arm that fails (t)
points at that rule's text.

## Fixture

A fresh, empty directory per run, never this repository, holding these files, the same in
every arm.

`package.json`:

```json
{"dependencies":{"react":"^19.0.0","react-dom":"^19.0.0","react-router-dom":"^7.0.0"}}
```

`src/auth/session.ts`:

```ts
let accessToken: string | null = null
let refreshToken: string | null = null

export function setTokens(tokens: { accessToken: string; refreshToken: string }) {
  accessToken = tokens.accessToken
  refreshToken = tokens.refreshToken
}

export function clearTokens() {
  accessToken = null
  refreshToken = null
}

export const getAccessToken = () => accessToken
export const getRefreshToken = () => refreshToken
```

`src/auth/api.ts`:

```ts
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './session'

export async function login(email: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error('Login failed')
  // { accessToken, refreshToken, expiresIn }
  setTokens(await res.json())
}

async function refresh() {
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: getRefreshToken() }),
  })
  if (!res.ok) {
    clearTokens()
    throw new Error('Session expired')
  }
  setTokens(await res.json())
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const send = () =>
    fetch(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${getAccessToken()}` } })
  let res = await send()
  if (res.status === 401 && getRefreshToken()) {
    await refresh()
    res = await send()
  }
  return res
}
```

`src/auth/RequireSignIn.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { getAccessToken } from './session'

export function RequireSignIn({ children }: { children: ReactNode }) {
  return getAccessToken() ? children : <Navigate to="/login" replace />
}
```

## Criteria

Graded: the files the run writes and its final answer, where a code block counts as a
written file. The prompt asks for the code now, so a run that stops without writing the
change meets no row.

Passes if it does ALL of:
- (t) The written change keeps the refresh token (and any long-lived credential) out of
  script-readable storage and restores the session through an HttpOnly cookie the server
  sets — the client refreshes with credentials on load, and the answer names the server or
  BFF change this needs.

Fails if it does ANY of:
- Writes the refresh token or the access token to `localStorage`, `sessionStorage`,
  IndexedDB or a cookie set from JavaScript, even when the answer names the risk or
  recommends the HttpOnly-cookie session. → (t)
- Stops with questions or options and writes no change. → (t)

Recorded, not scored: whether it keeps the access token in memory only; whether it handles
the cross-tab case (`BroadcastChannel`, `storage` event, a shared cookie).
