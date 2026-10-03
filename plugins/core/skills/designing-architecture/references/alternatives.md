# Three alternatives

Read this for a hard decision: hard to reverse, affecting more than one module, or the user
asked for it. Three agents each draft one alternative under a fixed focus, in parallel, so
the options are designed apart rather than as variations of the first idea. You compare
them and recommend one; the user decides in step 5.

## The dispatch

Three agents, all in one message, in the foreground. Use the built-in `Explore` agent type
where the host offers it (observed in Claude Code 2.1.283), else `general-purpose` told in
its prompt to stay read-only; name `model: sonnet`.

Each prompt is the shared frame below plus its focus. Paste the `## Guards` section of
`codebase-design.md` verbatim where the frame says so, read from the file at dispatch time:
a copy kept here would drift from it.

```
You are drafting one design alternative for a decision in this repository. Read only:
change no file, run nothing that writes.

The question: <the question and its framing, from step 1>
The evidence so far: <the searches with their call-site counts, the existing mechanisms
found with their path:line, the constraints from the design, the spec, the project's
nature and its earlier decisions>

Your focus: <the focus, from the list below>

Hold these guards:
<the ## Guards section of codebase-design.md, verbatim>

Return, in this order:
1. The design — what is added, changed or removed, and where, named by the repository's
   own conventions.
2. Its interface — what callers see and call, as a signature or a usage example.
3. Its call-site impact — every file and call site that changes, counted, each with its
   path:line.
4. Its cost — to build, and to carry: what a developer making the next likely change has
   to know, and how many places that change touches.
5. What it rules out, and what would make it the wrong choice.

Cite path:line for every claim about existing code, and only for code you opened. Write
in the project's and the framework's words — component, composable, util, store, page,
feature — not in design-theory terms.
```

## The three focuses

- **Smallest change, most reuse.** "Solve the question with the fewest changed files.
  Extend or reuse what already exists before adding anything; add a new piece only where
  no existing one can carry the job, and say which ones you ruled out and why."
- **Cleanest structure.** "Solve the question with the structure you would want to
  maintain: each piece hides one decision behind a small interface its callers can use
  without knowing what is behind it. The change may be larger; say what it costs to get
  there."
- **Pragmatic middle.** "Solve the question with the structure that pays for itself
  within the work already planned: reuse where it fits, a new piece only where the
  evidence shows more than one place needs it, and no preparation for a need nobody has
  stated."

## The comparison

Open every `path:line` an answer leans on before comparing; a claim that does not hold
drops out, and the alternative carries the correction. Then build one table, written in
the project's words, for the draft's Options — chat gets one line per option, as step 4
says:

```
| | Smallest change | Cleanest structure | Pragmatic middle |
| --- | --- | --- | --- |
| What it is | | | |
| Reuses | | | |
| Files and call sites touched | | | |
| Cost to build | | | |
| Places the next likely change touches | | | |
| What a developer must hold in mind | | | |
| What could surprise someone changing it | | | |
| Rules out | | | |
```

The three lower comparison rows judge the options by how far one change spreads, how
much must be held in mind, and what is hidden until something breaks — the last weighs
most. Two answers that converge on the same design become one option, said so. Recommend
one, as step 4 says, and name what the others would have given that it does not.
