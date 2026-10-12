# frontend-devkit

A Claude Code marketplace: a framework-agnostic `core` plugin plus per-framework
packs (`vue`, `nuxt`). The product is the components themselves, so a change here is a
change to how Claude behaves in every repository that installs it.

`docs/README.md` maps the full documentation and `CONTRIBUTING.md` covers working on the
devkit. This file is only the rules that must hold; `docs/adr/` records why they hold.

## Invariants

**Packs are framework-level.** A pack carries no fact about an individual repository —
no file paths, helper names or conventions from a specific codebase. Those belong in
that repo's own `CLAUDE.md`. Every project-specific fact — package manager, gates, base
branch, git host, commit convention — is read at the moment of use by
the skill, with the rules in `project.md`, from a file the project already maintains.
Nothing is cached, so nothing goes stale. (ADR 0003)

**A specialised pack is a delta on its base, not a copy of it.** It carries only what
its layer inverts or adds, and names the base rules that do not apply there. Duplicated
text drifts, and a rule correct for the base and wrong for the specialisation
manufactures confident, wrong output — worse than no rule. A pack's base is its
non-`core` dependency; `core` is the floor and forms no family. Today that is
`nuxt` → `vue` → `core`. The manifests' `dependencies` are the shape; read them, and
never hardcode a pair. (ADR 0004)

**Three tiers of context cost.** Descriptions load always, in every session of every
repo that enables the pack. Bodies load on trigger. References load only when the body
points at them. Guardrails and ordering belong in the body; lookup material belongs in
a reference. (ADR 0007)

**The devkit ships no hook and runs no project code automatically.** The boundary is the
consumer's permission and attribution settings, the sandbox and the OS; the devkit
recommends and documents them. A new hook only when no native setting can express it, it
prevents a reported incident, and the report is in the CHANGELOG. (ADR 0013)

**A skill reads the project's facts at the moment of use, by one shared rule.** No facts
service, no gate runner, no override schema. A fact two skills would read differently is one
line in `planning-features/references/project.md`, not a script. (ADR 0013)

**A feature's state lives in files, without a protocol.** `PLAN.md` says what and why;
`STATUS.md` says where it stands; `DECISIONS.md` and `CONTRACT-GAPS.md` are append-only lists
read by id. No entry catalogue, no archive protocol, no moves, no format-compatibility layer:
an older feature is carried over by hand, as the artifact contract says in one sentence.
(ADR 0013)

**Components live in `skills/`, never `commands/`.** A skill already carries the slash
invocation, and the checks that read component frontmatter select on `SKILL.md` or
`agents/` — a file under `commands/` skips both.

**A script lives with its one consumer.** A skill's own script sits in that skill's
`scripts/`; a script more than one component, a hook or CI uses sits in the shared
`scripts/` of its pack or of the repository. A script moved into a skill would make every
other user reach into that skill's folder.

**One shared `version`, in every pack's `plugin.json` only.** Every pack carries the
same `X.Y.Z`; `marketplace.json` carries none. Only `/release` bumps it.
`claude plugin validate --strict` is expected to exit clean.

**A session installs `main`, and `main` moves only at a release.** Work happens on the
`dev` branch; `/release` commits on `dev`, the user pushes `dev`, and moves `main` to the
release commit only once CI is green on it, then tags that commit; the pushed tag runs the
release workflow, which creates the GitHub Release. `CONTRIBUTING.md` describes the
workflow. (ADR 0010)

**Dependencies are declared directly, not transitively.** `nuxt` names both `core` and
`vue`, because transitive resolution is not observable from `claude plugin validate` —
only at enable time.

**No runtime dependencies.** Node and the `claude` CLI alone. Do not add a
`package.json`, a lockfile, or an npm package. (ADR 0002)

**A value the tooling reads lives in the script that reads it**, and the documentation says
how to query it, never the number. A script that needed a figure from a Markdown sentence
would tie the documentation's wording to a check. (ADR 0012)

## Gates

```
node scripts/validate.mjs               # the static checks; also CI
node --test "scripts/test/*.test.mjs"   # script behaviour by exit code; also CI
```

The gates need Node 22.18, or 24.2 on the 24 line; on an older Node `validate.mjs` exits 1. The shipped plugins need only Node 22.

`scripts/validate.mjs` is the one implementation of every check
`claude plugin validate --strict` does not perform; CI, the release workflow and `/release`
run that same file. `--strict` does **not** read component frontmatter, which is why the
frontmatter allowlist lives there. CI runs a pinned CLI; `canary.yml` watches the latest
weekly. What each check catches is in `docs/contributing/validation.md`.

Both are the gate; run both before pushing.

## Claims must be observed, not assumed

Comments in this repo record behaviour verified against specific Claude Code versions.
When a claim about the CLI, a validator, or an MCP server's tool names matters, observe
it and record the version. Do not replace an observed behaviour with a changelog reading.

Gates are reported as `declared` until something runs them: a script name existing says
nothing about whether its binary resolves. Report an unrun gate as NOT RUN — never imply
it passed.

## Repo-local tooling

`.claude/skills/` and `.claude/agents/` hold components for working *on* this
marketplace. They are not shipped to consumers and are not part of any pack.

| | |
| --- | --- |
| `/release` | Bump the shared version, write the CHANGELOG section, commit; the user pushes `dev`, then `main` once CI is green, then the tag, whose push creates the GitHub Release |
| `/cli-upgrade-check` | Revalidate against a newer CLI and raise the pinned version |
| `/diagnosing-sessions` | Diagnose past sessions into an anonymised report with a devkit-involvement verdict |
| `component-reviewer` | Reviews a changed component against the invariants above |
| `eval-grader` | Dry-run a `criteria.md` before a real run pays for it |
