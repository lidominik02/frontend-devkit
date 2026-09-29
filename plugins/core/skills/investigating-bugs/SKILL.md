---
name: investigating-bugs
description: >-
  Diagnoses a reported bug to its root cause and the layer that owns it — frontend,
  backend or identity/auth — without changing any code. Use whenever the user says
  "investigate this bug", "find the root cause", "why is X broken", "is this a frontend
  or backend bug", "debug this", "diagnose this", or pastes a bug report, stack trace or
  QA findings. Diagnosis only; for "fix this bug" use fixing-bugs; for "why does it look
  wrong", verifying-ui.
disallowed-tools: Edit, Write, NotebookEdit, MultiEdit
allowed-tools: Read Grep Glob Agent
---

You find out what is actually wrong. You do not fix it.

Keeping diagnosis separate from fixing is the whole value here. The moment you start
editing, you stop investigating: the first plausible cause becomes the answer, and the
real one — usually one layer further down — never gets found. Investigations that end
in "here is the cause and here is the fix I propose" get fixed correctly. Ones that
end in a hurried edit get reopened.

One bug goes through Steps 1 to 4. Several findings at once — a QA run's — go through
the batch mode below: lighter, one short report per finding, grouped by independent area.

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
Confirmed (an unbroken chain of read code) | Likely | Inconclusive — and what would settle it

### Related risks
<other call sites with the same defect, and any gap that let this ship>

### Next step
fix inline | fixing-bugs | owner report (outside the frontend: <owner>) — and why
```

**"Inconclusive" is a valid, respectable outcome.** Say what you ruled out, what you
could not access, and the single next check that would resolve it. A confident wrong
diagnosis costs far more than an honest inconclusive one.

## Choosing the next step

The report names one, for after the user's ruling:

- **Owner report** when the owning layer is not the frontend. The line flags it: outside
  the frontend, and whose it is. The Proposed fix is written for that owner, as "Working
  across repositories" says. `fixing-bugs`, started from this report, writes the owner
  report and changes no frontend code unless the user approves a guard.
- **Fix inline** when the confidence is Confirmed and the cause is evident and one
  function by "The triage threshold" in `../fixing-bugs/references/loop.md`:
  `fixing-bugs`' evident-cause entry fixes it at once, with a regression test where a
  correct seam exists.
- **fixing-bugs** for any other frontend cause — Likely, Inconclusive, or a fix beyond one
  function. It proves the diagnosis with a failing test before it fixes, and ranks
  hypotheses when the test contradicts it.

A cause that spans layers gets a step for each part.

Then stop. Whether the bug is the user's to fix is the user's ruling, often made after
asking a PM, a tester or the backend. The report gives that ruling its evidence and starts
nothing.

## Batch mode: several findings

For a QA report's Findings: `testing-changes` offers this after a run. `executing-plans`'
`fix-findings` runs the same dispatch itself for its unclear review findings, without
calling this skill. It stays light: code is only read, nothing runs, and
each finding gets a short report rather than the full one — never Steps 1 to 4.

1. **Take the findings verbatim** from the report the caller names; non-English text is
   quoted, then translated. Ask nothing per finding: what a finding lacks goes into its
   short report as what would settle it.
2. **Group them by area.** Findings on the same screen, component, store or endpoint go to
   one agent, since they may share a cause, and two agents reading the same code can return
   two answers. Independent findings go to separate agents.
3. **Dispatch** one agent per area, all in one message, in the foreground, of the built-in
   read-only `Explore` agent type where the host offers it (observed in Claude Code
   2.1.283); `model: sonnet`. With no such type, dispatch nothing: work through the areas
   yourself, one at a time, on the main thread, where this skill's disallowed-tools block
   the file tools. Each area follows the dispatch prompt in `references/batch.md` and
   returns the short report's blocks it gives.
4. **Check each root cause** by opening its `path:line`. One that does not show what its
   block says drops to Inconclusive, with the reason.
5. **Report** the blocks in the findings' order, in the short report's shape in
   `references/batch.md`, each with its Next step chosen as "Choosing the next step" says,
   then stop. Fixing is a separate decision: the user rules on remit finding by finding.

## Working across repositories

When the backend is read-only context rather than a repo you change:

- Read it freely to establish ownership and cause.
- **Never edit it.** If the fix belongs there, write the diagnosis so that whoever
  owns it can act: exact file, exact change, exact reason.
- If a frontend workaround exists for a backend root cause, present both and say
  plainly which is the real fix and what the workaround costs.

## What this must NOT do

- **Edit, write, or fix anything — not even a one-line change.** The file tools are blocked
  for this turn rather than merely discouraged: you will still see them in your own schema,
  and the call is refused when you make it, so this is not negotiable mid-conversation. Propose the fix in the report; applying it is a separate,
  deliberate step.
- **Start the next step it names**, or rule on whether the bug is the user's to fix.
- **Blame the UI before checking the data and the token claims it renders.**
- **Stop at the first plausible cause** without following the chain to something that
  actually explains the symptom.
- **Cite a `path:line` you did not open.**
- **Fix adjacent bugs it finds along the way.** Note them under Related risks.
