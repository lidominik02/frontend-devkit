# 0012. Values the tooling reads live in a config file, never in prose

Status: Accepted. Amended 2026-10-12: the config file is gone; the one value left lives in
the script that reads it, and the documentation says how to query it (ADR 0013).

## Context

`claude plugin validate --strict` does not read component frontmatter, does not resolve
references and knows nothing of this repository's own rules. Those checks need one
implementation that CI and a terminal share, or they drift apart.

Some checks need a value — a ceiling, a list of paths. A value parsed out of a sentence in
a document ties the document's wording to the tooling: rewording or moving the sentence
breaks a check, and the document cannot be restructured freely.

## Decision

- `scripts/validate.mjs` is the single implementation of every check
  `claude plugin validate` does not perform. CI and the release workflow run that file
  rather than a copy.
- A value the tooling reads lives in the script that reads it — today the always-on
  description ceiling, `BUDGET_CEILING` in `validate.mjs`. No script parses a value out of
  prose.
- A platform constant, such as the 1,024-character description cap, stays in code beside
  the comment that records where it comes from.

## Consequences

- Documentation can be reorganised without touching the tooling.
- Documentation does not publish figures the tooling owns; it says how to query them
  (`node scripts/validate.mjs --checks=budget`).
- The checks are described in [Validation](../contributing/validation.md).
