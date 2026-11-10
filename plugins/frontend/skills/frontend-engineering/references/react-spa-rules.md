# React SPA engineering

## Contents
- Rules from the `react-*` set that do NOT apply here
- The rules that prevent most bugs
- Reading
- What this must NOT do

**This set is a delta.** Everything in the `react-*` set holds here. This set carries only
what is true of React code that runs in a browser, rendered on the client.

## Rules from the `react-*` set that do NOT apply here

None.

## The rules that prevent most bugs

**The session cookie comes from the API server or a backend-for-frontend.** The `react-*`
set keeps a persistent credential in an `HttpOnly` cookie a server sets; here that server is
not the app. Write the client against that cookie, and name the server change it needs: the
login and refresh endpoints set and read the cookie instead of returning the refresh token in
the body, and logout clears it.

## Reading

This set has no topic files; its rules are this file.

## What this must NOT do

- **Apply Next.js guidance.** Server Components, the `'use client'` and `'use server'`
  directives, route handlers and `next/*` imports do not exist here; do not import their
  conclusions into this set.
