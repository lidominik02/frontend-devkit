# Dispatch prompts, the report and the chat brief

## Dispatch prompts

Every dispatch to `core:reviewer` has this shape:

```
Role: two-axis | lens <name> | verify | re-review
Diff file: <path>
Intent sources: <paths, the approved in-chat design pasted verbatim> | none — the spec axis is NOT RUN
Gates (already run — report as given, do not re-run):
<the run-gates.mjs JSON output, verbatim, one block per command run>
Released: test released | held · build released | held
<role material>
```

The role material:

- `two-axis` — none. For the gap sweep: `Restrict the review to these files:` and the paths.
- `lens <name>` — `Lens:` followed by that section of `lenses.md`, verbatim.
- `verify` — the candidates, each with these fields and nothing else:

  ```
  <id, or every id a merged candidate absorbs> — <file:line> — <category> — <severity>
  summary: <one sentence>
  failure scenario: <inputs or state → wrong outcome>
  ```

- `re-review` — the prior findings the user has not set aside, each block as the report
  prints it.

## The report

```
# Review: <branch> — <date>

Scope: <the stat summary line> · base <base> · snapshot tree <tree>
Diff: <diff file path>
Tier: small | large
Intent sources: <paths> | none
Gates: <gate> pass | FAIL | NOT RUN (<reason>) · ...
Framework packs: <packs applied, in order> | none — stack.packs is empty
Reviewers: <each dispatch, by role> · did not return: <role> | none
NOT RUN: <each item, with the reason>

Overall: CONFIRMED <n> critical · <n> important · <n> minor — PLAUSIBLE <n> — conflicts with a decision <n> — PREDATES_CHANGE <n> — REFUTED <n>

## Spec findings
## Quality findings
## Conflicts with a decision
## Predates the change
## Refuted
## Declined to judge
## Runtime-only
## Clean
## Inconclusive
```

1. **NOT RUN** lists the spec axis when there was no intent source, each held gate, and a
   lens or reviewer that did not return.
2. **Spec findings** and **Quality findings** hold CONFIRMED findings first, then PLAUSIBLE,
   each group from critical to minor. Each is the verifier's block for that finding — its
   verdict, its severity and the evidence it quoted — with the finder's `fix` line, in the
   reviewer's finding format:

   ```
   #### <id> — <summary, one sentence>
   - axis: spec | quality
   - category: <category>
   - severity: critical | important | minor
   - location: <file:line>
   - failure scenario: <inputs or state → wrong outcome; for a cleanup, its cost>
   - verdict: CONFIRMED | PLAUSIBLE
   - evidence: <the verifier's evidence line, verbatim>
   - fix: <the finder's suggestion>
   ```

3. **Conflicts with a decision** holds each finding that contradicts a DECISIONS line or an
   EXTRA-tagged criterion, in the same block, headed by the line
   `conflicts with D<n> — the user decides`.
4. **Predates the change** holds the PREDATES_CHANGE blocks. They are not blocking.
5. **Refuted** holds one line each: `<id> — <summary> — guard: <the quoted line> (<file:line>)`.
6. **Clean** lists each changed file that no CONFIRMED or PLAUSIBLE finding touches. The
   other closing sections merge what every reviewer returned, without duplicates.
7. A section with nothing in it says `none`.

### A re-review report

```
# Re-review: <branch> — <date>

Re-reviews: <path of the earlier report>
Scope: <the fix diff's stat summary line> · base <the earlier snapshot tree> · snapshot tree <tree>
Diff: <fix diff path>
Gates: ...
Framework packs: ...
NOT RUN: ...

Overall: ADDRESSED <n> — NOT ADDRESSED <n> — set aside by the user <n> — new findings <n>

## Prior findings
## Set aside by the user
## New findings
## Out of scope
## Runtime-only
## Clean
## Inconclusive
```

**Prior findings** holds one block per finding as the reviewer returns it: the id, ADDRESSED
or NOT ADDRESSED, the `file:line`, the three evidence lines, and `untested` where it
applies. **Set aside by the user** holds one line per prior finding left out of the dispatch:
`<id> — <summary> — <the PROGRESS.md ledger line, verbatim>`; without a feature it says
`none`. **New findings** are unverified — no `verify` runs in `re-review` — so their
verdict stays empty.

## The chat brief

```
Review: <the overall line>
- <id> <severity> — <summary> — <file:line> [— conflicts with D<n>]
NOT RUN: <each item> | none
Report: <path>
```

One line per critical and important finding. After a re-review, one line per NOT ADDRESSED
finding and per new finding instead.
