# Shaping commits

Two decisions that come up often enough to need a default, and neither is about
rewriting history: both are about the *uncommitted* diff in front of you right now.

## Alternatives, when asked

Two by default — title and body — not more unless asked for more:

```
Option A
<title>

<body, or "no body — trivial change">

Option B
<title>

<body>
```

Vary what actually differs: a shorter subject, a different emphasis in the body, a
different type/scope if the diff genuinely supports more than one reading. Two options
that differ only in punctuation are not two options — pick the better one and offer a
single alternative that changes something real (length, focus, or granularity).

## One commit, or several

A diff becomes several commits when it contains changes that are independently
reviewable and independently revertable — a refactor plus the feature built on it, or
a dependency bump plus the code that needed it. It stays one commit when splitting it
would leave an intermediate commit that does not build, does not pass the repository's
own gates, or tells only half a story.

State the split and why, in one line, before writing the messages:

> "Two commits: the extraction is a pure refactor with no behaviour change, and the
> feature that uses it depends on it — splitting them makes the refactor reviewable on
> its own."

If the diff could go either way, default to one commit and say why several was not
worth it. A history of many tiny, correctly-atomic commits nobody asked for is not
tidier — it is more commits to read.

## The accepted-message flow

Produce → wait → commit only once told. This is not a formality: a message that reads
as final and a message that has been *accepted* are different states, and only the
second permits `git commit`. If the user asks for one change to a drafted message,
apply it and show the result before committing — do not commit the corrected version
without showing it once, on the theory that the correction implies approval of
everything else.

None of this reaches into git history. Splitting or combining commits here means
choosing how to commit *changes not yet committed* — never `rebase`, `commit --amend`,
or any command that alters a commit already made. That is a different job, done only
when the user explicitly asks for it, and never by this skill.
