# Dispatch prompts, the report and the chat brief

## Dispatch prompts

Every dispatch to `core:reviewer` has this shape:

```
Role: two-axis | verify | re-review
Diff file: <path>
Intent sources: <paths, the approved in-chat design pasted verbatim> | none — the spec axis is NOT RUN
Packs: <each framework pack, in order> | none
Gates (already run — report as given, do not re-run):
<one gate line per gate — <workspace> · <command> · <source> · <result> — a FAIL with its quoted error lines>
Released: <each held check the project declares: released | held> | none declared
<role material>
```

**Model and effort.** model: sonnet · effort: low · run_in_background: false. One line for
`two-axis`, `verify` and `re-review` alike; `re-review` follows `two-axis`. The dispatch
passes the model named; "the session's" and "not set" leave that parameter out.

A task review adds `Implementer message:` and `Raised by the dispatcher:` after Released.
The role material: `two-axis` — none. `re-review` — `Prior findings:` and each open finding
block as the report prints it. `verify` — the candidates, each with these fields only:

```
<id> — <file:line> — <category> — <severity> [— conflicts with D<n>]
summary: <one sentence>
failure scenario: <inputs or state → wrong outcome>
```

## The report

```
# Review: <branch> — <date>
Scope: <the stat summary line> · base <base> · snapshot tree <tree>
Diff: <diff file path>
Intent sources: <paths> | none
Gates: <gate line>; <gate line>; ...
Framework packs: <packs applied, in order> | none
NOT RUN: <each item, with the reason>
Overall: CONFIRMED <n> critical · <n> important · <n> minor — PLAUSIBLE <n> — PREDATES_CHANGE <n> — REFUTED <n>
## Spec findings · ## Quality findings · ## Predates the change · ## Refuted
## Declined to judge · ## Runtime-only · ## Clean · ## Inconclusive
```

**Spec findings** and **Quality findings** hold CONFIRMED findings first, then PLAUSIBLE,
each group from critical to minor, each the verifier's block with the finder's `fix` line:

```
#### <id> — <summary, one sentence>
- axis: spec | quality
- category: <category>
- severity: critical | important | minor
- location: <file:line>
- failure scenario: <inputs or state → wrong outcome; for a cleanup, its cost>
- verdict: CONFIRMED | PLAUSIBLE [— conflicts with D<n>, the user decides]
- evidence: <the verifier's evidence line, verbatim>
- fix: <the finder's suggestion>
```

**Predates the change** holds the PREDATES_CHANGE blocks; they are not blocking. **Refuted**
holds one line each: `<id> — <summary> — guard: <the quoted line> (<file:line>)`. **Clean**
lists each changed file no CONFIRMED or PLAUSIBLE finding touches. A section with nothing in
it says `none`.

### A re-review report

```
# Re-review: <branch> — <date>
Re-reviews: <path of the earlier report>
Scope: <the fix diff's stat summary line> · base <the earlier snapshot tree> · snapshot tree <tree>
Diff: <fix diff path>
Gates: ... · Framework packs: ... · NOT RUN: ...
Overall: ADDRESSED <n> — NOT ADDRESSED <n> — closed by the user <n> — new findings <n>
## Prior findings · ## Closed by the user · ## New findings
## Out of scope · ## Runtime-only · ## Clean · ## Inconclusive
```

**Prior findings** holds one block per finding as the reviewer returns it. **Closed by the
user** holds `- <id> — <summary>` with its STATUS.md `Closed findings` line beneath it.
**New findings** are unverified — no `verify` runs in `re-review` — so their verdict stays
empty.

## The chat brief

```
Review: <the overall line>
- <id> <severity> — <summary> — <file:line> [— conflicts with D<n>]
NOT RUN: <each item> | none
Report: <path>
```

One line per critical and important finding; after a re-review, per NOT ADDRESSED and new finding.
