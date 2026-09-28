# The rules block

The default rules for a feature's lifecycle. They govern every stage when the user has not
stated rules of their own.

```
- Clarification and planning share a session. Subagent-per-task execution continues in
  it. For inline execution, approval asks whether to start a new session from the
  handoff's kickoff prompt — recommended — or to continue in it.
- The execution mode — subagent per task or inline — is chosen when the plan is
  approved.
- Code review runs automatically after implementation. Browser, design-tool and
  Storybook checks run only on request.
- Verification is held to the fast gates until the user releases more. No test suite,
  no build, no Storybook and no browser check runs before that.
- Commit only after the user accepts a drafted message. The user pushes.
- Artifacts are written in English. Non-English input is quoted verbatim, then
  translated — never paraphrased in place of the original.
- The user's own instructions outrank these defaults.
```

## Applying it

State the governing rules once, when the feature's HANDOFF.md is first written, and record
there whether the defaults or the user's own rules govern. Every kickoff prompt carries
them, so a new session knows what governs without asking. Hold every stage to them without
restating them turn to turn.

A rules block from the user replaces the defaults entirely, not line by line. When it is
silent on one of the defaults, ask whether that default holds rather than assuming either
way.

## Recording an override

An override that holds for the rest of the feature gets a DECISIONS.md line, with the
default it replaced in the rejected-alternative slot:

```
D7 — 2026-03-14 — run the full gates after every task — default: fast gates only until released — the user, when approving the plan
```

A one-off override for a single turn gets no line.
