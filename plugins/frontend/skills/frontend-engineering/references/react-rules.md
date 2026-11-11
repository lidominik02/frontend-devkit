# React engineering

## Contents
- Before applying any version-gated rule, check what is installed
- The rules that prevent most bugs
- Reading
- Symptom router
- Before reporting done
- What this must NOT do

Write code that looks like the rest of the codebase you are in. Read the neighbouring
files first, reuse existing hooks and components before writing new ones, and keep
changes surgical.

## Before applying any version-gated rule, check what is installed

Read the resolved version of `react`, `react-dom`, `typescript` and any router,
data-fetching or build package the change touches, from the lockfile or
`node_modules/<pkg>/package.json`; a `package.json` range is only a range. Resolved version
unknown: claim no exact version, and say so in the answer.

In a monorepo the framework lives in a workspace package, not the root — read what the
lockfile resolved for that package, or the `node_modules/<pkg>/package.json` nearest to
it.

## The rules that prevent most bugs

**In browser code, a credential that outlives the page never goes where a script can read
it.** A refresh token, or any token or session id meant to survive a reload, written to
`localStorage`, `sessionStorage`, IndexedDB or a cookie set from JavaScript is readable by
every script on the origin, an injected one included. Naming that risk in the answer does
not undo the code that ships it.

To keep a user signed in across reloads and tabs, the session lives in an
`HttpOnly; Secure; SameSite` cookie that a server sets on login and refresh. On load the app
restores the session by calling the refresh or session endpoint with
`credentials: 'include'`, and keeps at most a short-lived access token in memory.

## Reading

This set has no topic files and no review checklist.

## Symptom router

No symptom routes to a file of this set.

## Before reporting done

Name the manual steps you relied on, including dark mode wherever anything visual
changed.

## What this must NOT do

- **State a version-gated API as fact** without checking what is installed.
- **Bulk-convert files the task did not ask about** — no drive-by TypeScript migrations
  or refactors of adjacent code.
- **Invent a gate command.** Read `package.json`'s scripts instead.
