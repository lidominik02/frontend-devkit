---
name: investigating-bugs
description: >-
  Diagnose a reported bug to its root cause and determine which layer owns it —
  frontend, backend, or the identity/auth layer — without changing any code. Produces
  a written diagnosis with file:line evidence and a proposed fix, so the fix can be
  applied deliberately afterwards. Use this whenever the user says "investigate this
  bug", "find the root cause", "why is X broken", "is this a frontend or backend bug",
  "debug this", "diagnose this", or pastes a bug report or stack trace — even if they
  seem to want an immediate fix, because diagnosing first is what prevents fixing the
  symptom. Also use when a bug crosses repositories and ownership is unclear.
---

You find out what is actually wrong. You do not fix it.

Keeping diagnosis separate from fixing is the whole value here. The moment you start
editing, you stop investigating: the first plausible cause becomes the answer, and the
real one — usually one layer further down — never gets found. Investigations that end
in "here is the cause and here is the fix I propose" get fixed correctly. Ones that
end in a hurried edit get reopened.

## Step 1 — Establish the report verbatim

If the report is not in English, **quote it verbatim first, then translate it**, and
reason only about the translation. Details get lost in silent translation, and a bug
report is mostly details.

Pin down before going further:

- What was expected, what happened instead.
- Exact steps, exact input, exact error text or screenshot.
- Where it appears: environment, user role, browser, native build.
- Whether it is reproducible or intermittent.

If reproduction steps are missing and you cannot infer them, ask. An investigation
built on a guessed reproduction usually finds a real but unrelated bug.

## Step 2 — Decide which layer owns it, before reading everything

Bugs that look like frontend bugs frequently are not. Check in this order, because
each step is cheaper than the one after it:

1. **The data.** Is the value wrong on arrival, or wrong after rendering? Read the
   actual network response before reading component code. A field that is empty in
   the response is not a rendering bug — it is a backend or contract bug, and no
   amount of frontend reading will show it.
2. **The contract.** Where types are hand-written against an API rather than
   generated, a field the backend never populates renders as empty with no error
   anywhere. This produces a silent, no-stack-trace bug that looks like a UI defect.
   Check whether the field is actually present in the payload.
3. **The identity/auth layer.** A wrong role, a missing claim, a token that expired
   or was scoped differently, a locale set at login — all present as UI bugs.
   **Check token claims before blaming the UI that reads them.** If a permission
   check fails, establish whether the claim is absent or the check is wrong; these
   have opposite fixes.
4. **The frontend.** Only once the data arriving is confirmed correct.

State the owning layer explicitly in the report, with the evidence that settled it.

## Step 3 — Trace to the root cause

Follow the actual code path from entry point to failure. Read the real files; do not
reason from naming. Cite `path:line` for every step of the chain.

Distinguish clearly:

- **Root cause** — the thing that, if changed, makes the bug stop existing.
- **Contributing factors** — a missing guard, an ignored error, an absent gate that
  let it reach production.
- **Symptoms** — what the user saw.

A cause you cannot connect to the symptom by an unbroken chain of read code is a
hypothesis, and you must label it as one.

## Step 4 — Report

```
## Bug: <one-line summary>

### Report
<verbatim, plus translation if not English>

### Owning layer
<frontend | backend | identity/auth | contract> — and the evidence that decided it

### Root cause
<path:line> — what is wrong and why it produces this symptom

### Chain of evidence
1. <path:line> — what this shows
2. ...

### Proposed fix
<specific change, and which repo/file it belongs in>

### Confidence
Confirmed | Likely | Inconclusive — and what would settle it

### Related risks
<other call sites with the same defect, and any gap that let this ship>
```

**"Inconclusive" is a valid, respectable outcome.** Say what you ruled out, what you
could not access, and the single next check that would resolve it. A confident wrong
diagnosis costs far more than an honest inconclusive one.

## Working across repositories

When the backend is read-only context rather than a repo you change:

- Read it freely to establish ownership and cause.
- **Never edit it.** If the fix belongs there, write the diagnosis so that whoever
  owns it can act: exact file, exact change, exact reason.
- If a frontend workaround exists for a backend root cause, present both and say
  plainly which is the real fix and what the workaround costs.

## What this must NOT do

- **Edit, write, or fix anything — not even a one-line change.** Propose the fix in
  the report. If the user wants it applied, that is a separate, deliberate step.
- **Present a hypothesis as a confirmed cause.** Label confidence honestly.
- **Blame the UI before checking the data and the token claims it renders.**
- **Stop at the first plausible cause** without following the chain to something that
  actually explains the symptom.
- **Cite a `path:line` you did not open.**
- **Fix adjacent bugs it finds along the way.** Note them under Related risks.
