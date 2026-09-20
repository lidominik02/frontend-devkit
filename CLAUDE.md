# frontend-devkit

A Claude Code marketplace: a framework-agnostic `core` plugin plus per-framework
packs (`vue`, `nuxt`). The product is the components themselves, so a change here is a
change to how Claude behaves in every repository that installs it.

`README.md` is the full reference. This file is only the rules that must hold.

## Invariants

**Packs are framework-level.** A pack carries no fact about an individual repository —
no file paths, helper names or conventions from a specific codebase. Those belong in
that repo's own `CLAUDE.md`. Every project-specific fact — package manager, gates, base
branch, git host, commit convention — is read at the moment of use by
`plugins/core/scripts/project-facts.mjs` from a file the project already maintains.
Nothing is cached, so nothing goes stale.

**A specialised pack is a delta on its base, not a copy of it.** It carries only what
its layer inverts or adds, and names the base rules that do not apply there. Duplicated
text drifts, and a rule correct for the base and wrong for the specialisation
manufactures confident, wrong output — worse than no rule. A pack's base is its
non-`core` dependency; `core` is the floor and forms no family. Today that is
`nuxt` → `vue` → `core`. `node scripts/pack-graph.mjs` reports the current shape, so
never hardcode a pair.

**Three tiers of context cost.** Descriptions load always, in every session of every
repo that enables the pack. Bodies load on trigger. References load only when the body
points at them. Guardrails and ordering belong in the body; lookup material belongs in
a reference.

**Hooks are Node, never bash.** Bash exits `2` on a syntax error and `2` is the hook
protocol's block signal, so a broken shell hook blocks every tool call — including the
edit that would repair it. Node exits `1` on a `SyntaxError`, which is non-blocking.
Fail closed on a policy decision; fail open on a broken interpreter.

**Components live in `skills/`, never `commands/`.** A skill already carries the slash
invocation, and the checks that read component frontmatter select on `SKILL.md` or
`agents/` — a file under `commands/` skips both.

**No `version` field in `plugin.json`.** Omitted deliberately so installs track the
commit SHA. `claude plugin validate --strict` reports this; it is the one expected
finding and CI allows exactly it.

**Dependencies are declared directly, not transitively.** `nuxt` names both `core` and
`vue`, because transitive resolution is not observable from `claude plugin validate` —
only at enable time.

**No runtime dependencies.** Node and the `claude` CLI alone. Do not add a
`package.json`, a lockfile, or an npm package.

## Gates

```
node scripts/validate.mjs      # five static checks; also the Stop hook and CI
bash scripts/test-hooks.sh     # hook behaviour by exit code
node scripts/pack-graph.mjs    # pack layering, derived from the manifests
```

`scripts/validate.mjs` checks frontmatter (description present, under the 1024-char
packaging cap, skill name matching its directory, every field one Claude Code actually
reads), the always-on description budget against the figure `README.md` publishes, that
every cited `.md` resolves from the file citing it, that every blocked `mcp__` tool
appears in `browser-tools.md`, and that every `.mjs` parses. `claude plugin validate --strict` does **not** read component frontmatter, which
is why that allowlist lives here.

Run both before pushing. The Stop hook runs the first automatically when anything under
`plugins/`, `scripts/` or `README.md` has changed.

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
| `/eval-case` | Scaffold an eval case under the retention methodology |
| `/new-pack` | Scaffold a framework pack and wire it in everywhere |
| `/pack-parity` | Check the delta contract for drift, for every family the manifests declare |
| `/body-vs-reference-audit` | Which parts of a body have earned their place there |
| `/cli-upgrade-check` | Revalidate against a newer CLI and move the pin |
| `trigger-tester` | Would this description fire? Judges descriptions, never bodies |
| `eval-grader` | Dry-run a `criteria.md` before a real run pays for it |
| `component-reviewer` | Reviews a changed component against the invariants above |
