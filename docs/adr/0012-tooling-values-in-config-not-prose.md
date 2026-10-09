# 0012. Values the tooling reads live in a config file, never in prose

Status: Accepted

## Context

`claude plugin validate --strict` does not read component frontmatter, does not resolve
references and knows nothing of this repository's own rules. Those checks need one
implementation that CI, the hooks and a terminal all share, or they drift apart.

Some checks need a value — a ceiling, a list of paths. A value parsed out of a sentence in
a document ties the document's wording to the tooling: rewording or moving the sentence
breaks a check, and the document cannot be restructured freely.

## Decision

- `scripts/validate.mjs` is the single implementation of every check
  `claude plugin validate` does not perform. CI, the repository's hooks and the release
  check run that file rather than a copy.
- Every value the tooling reads lives in `devkit.config.json` at the repository root:
  today the always-on description ceiling, the paths the `Stop` hook watches, and the
  documentation roots whose links are checked. No script parses a value out of prose.
- A missing or malformed value is a finding, never a silent pass.
- A platform constant, such as the 1,024-character description cap, stays in code beside
  the comment that records where it comes from.

## Consequences

- Documentation can be reorganised without touching the tooling, and the `docs-links`
  check keeps its links resolving.
- Documentation does not publish figures the tooling owns; it says how to query them
  (`node scripts/validate.mjs --checks=budget`).
- The keys are described in [Validation](../contributing/validation.md#devkitconfigjson).
