# Next.js review checklist

## Contents
- Before writing the verdict

**This is a delta.** It carries only what a Next.js review adds.

## Before writing the verdict

Static review does not prove a Next.js risk, such as a server/client boundary or a route's
rendering mode. Two kinds of declared check do: the project's type check, and `next build`.
Read `package.json`'s scripts for the one the project declares, and invent none.

`next build` is a build: do not run it unasked. Until the user asks for it, report a risk that
only the build proves as unverified, naming `next build` as the check that would prove it,
never as passed.
