# The survey

Read this when there is no question to settle. The survey finds what in the
codebase is worth a decision, writes at most five candidates, and stops. It changes
nothing and proposes no design: the candidate the user picks becomes the question, and
the loop designs it.

The guards in `codebase-design.md` hold throughout. A pattern match is a candidate for
reading, not a finding: open the code before writing it down.

## Detector tools

Before the signals, look for the project's own detectors among its dependencies and
scripts — unused-code finders, duplicate-code finders, dependency-graph checkers. When it
has any, ask once per run with one form: "Read and grep only (recommended)", and "Run
<tool>" for each, its description naming the command and what it reads. A detector runs
only with that run's approval; an approval from an earlier run does not carry over.

Declined, or none present, the survey reads and greps. Say so in chat and in SURVEY.md's
Confidence line: findings rest on reading, and a duplicate or an unused export the reading
did not reach can be missing.

## The three signals, in order

1. **Hot spots in the history.** The files changed most often in the last six months, from
   `git log --since="6 months ago" --name-only --format=`, counted per file, and the files
   that change together in the same commits. Code that changes often is where structure
   costs the most; code nobody touches is rarely worth restructuring, however it looks.
   With no git history — not a repository, or no commits — skip this signal, and say so in
   chat and in SURVEY.md.
2. **Friction points.** Read the hot spots, or the main feature folders when there is no
   history, and note where understanding one thing means jumping between many files:
   the same rule written in several places that must change together; a decision — a
   format, an order, a shape — repeated across files; callers reaching past a shared piece
   to what it wraps; a shared piece that grows a parameter or a branch per caller; a shared
   layer importing from a feature.
3. **The deletion test.** Apply it, as `codebase-design.md` states it under "Deep and
   shallow modules", to each piece the friction points name. The survey adds one rule: if
   merging two pieces would gather one rule into one place, they belong together.

## A candidate

Each candidate has:

- **Title** — what it is, in the project's and the framework's words.
- **Strength** — `Strong`: the evidence shows a recurring cost now. `Worth exploring`: the
  cost is real but small, or the evidence is partial. `Speculative`: a plausible shape the
  evidence does not yet show.
- **Evidence** — `path:line` for every claim, each one opened, with the hot-spot count or
  the call-site count where one applies.
- **Cost of keeping it** — what breaks, what has to change in how many places, or what a
  developer must know that they would not otherwise need.
- **What deleting or merging it would concentrate** — the rule, decision or logic that
  would end up in one place.

A candidate without `path:line` evidence or a stated cost is not written. At most five,
strongest first.

**Zero candidates is a valid result.** It means nothing the survey read costs enough to
be worth a decision. Say so in chat and in SURVEY.md, and stop.

## SURVEY.md

`temp/architecture/<slug>/SURVEY.md`, where `<slug>` is `survey-YYYY-MM-DD`, or
`survey-YYYY-MM-DD-2`, `-3` and on when an earlier survey that day already has the folder:

```
# Survey — YYYY-MM-DD

Signals: hot spots <ran | skipped: no git history> · friction points · what removing each piece would lose
Detectors: <the tools run, each with its command | declined | none present>
Confidence: <full | reading and grep only: what may be missing>

## 1. <title> — <Strong | Worth exploring | Speculative>
Evidence:
- <path:line> — <what it shows>
Cost of keeping it: <what breaks, changes in how many places, or must be known>
Deleting or merging it would concentrate: <the rule, decision or logic>

## 2. ...
```

With zero candidates, the file holds the header lines and "No candidates."

## The stop

In chat: one line per candidate — its number, title and strength — and the path of
SURVEY.md. Then one form: "Which one becomes the question?" Its options are up to three of
the strongest candidates and "End here"; the question text lists every candidate by number,
and the free-text answer picks any of them. The pick becomes the question in step 1 of
the loop, and its record goes to the same folder. "End here" stops the run.
