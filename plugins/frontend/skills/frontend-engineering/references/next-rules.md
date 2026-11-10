# Next.js engineering

## Contents
- Rules from the `react-*` set that do NOT apply here
- Where Next.js API facts come from
- Reading
- Before reporting done
- What this must NOT do

**This set is a delta.** Everything in the `react-*` set holds here. This set carries only
what is true of a Next.js workspace.

## Rules from the `react-*` set that do NOT apply here

None.

## Where Next.js API facts come from

Take every Next.js API fact — a function, a file convention, a config key, a default — from
the documentation that matches the installed `next`, not from memory. Read the resolved
version first, as the `react-*` set says, then:

- **`next` 16.2.0 or later:** `node_modules/next/dist/docs/`, which the package ships.
- **Below 16.2.0:** the project's `.next-docs/` directory, if it has one. Otherwise the
  documentation on nextjs.org, checked against the installed version, and the answer says
  that the installed package ships no documentation.

## Reading

This set has no topic files; its rules are this file.

| Reading | When |
| --- | --- |
| `next-review-checklist.md` | **reviewing a diff** — the declared check that proves a Next.js risk |

## Before reporting done

Say which documentation the Next.js API facts came from, and for which `next` version.

## What this must NOT do

- **Apply single-page-app guidance.** The `react-spa-*` set is not read in a Next.js
  workspace, and its conclusions are not imported here.
- **State a Next.js API fact from memory** when the documentation for the installed version
  is available, or without saying which version it was checked against.
- **Run or recommend the codemod** that downloads `.next-docs/`.
- **Run `next build` unasked, or report a risk only the build proves as passed.** Name it as
  unverified, and `next build` as the check that would prove it.
