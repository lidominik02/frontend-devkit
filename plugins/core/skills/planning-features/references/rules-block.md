# The rules block

Read this at `new <feature>` when the user did not paste a rules block of their own.
These are the defaults; any of them is overridden by what the user actually says, and an
override is recorded in the decisions log the same way any other decision is — with the
default it replaced.

```
- Three phases: research, plan, implementation — each in its own session unless told
  otherwise.
- Implementation runs in the main thread. No delegated implementation subagent.
- Code review happens on request, after the owner has read the code. Never automatic.
- Verification is held to Prettier, ESLint and typecheck until released. No test suite,
  no build, no Storybook, no browser check runs before the owner says so.
- Commit only once a drafted message is accepted. The owner pushes.
- Artifacts are written in English. Non-English input is quoted verbatim, then
  translated — never paraphrased in place of the original.
```

## Applying it

State the block once, at `new`, whether it is the default or the user's own — so a later
session reading the master plan sees what governs this roadmap without having to ask.
Then hold every mode to it without restating it turn to turn: `implement` does not offer
a review, `plan` does not run a browser check, nothing commits without an accepted
message.

A user rules block replaces the default entirely, not per line — if they state five
rules and stay silent on a sixth, ask whether the default holds for that one rather than
assuming either way.
