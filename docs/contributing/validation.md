# Validation

`scripts/validate.mjs` is the single implementation of everything `claude plugin validate`
will not check. CI, the repository's `Stop` hook and two `PostToolUse` hooks all call that
same file rather than carrying their own copy, so they cannot drift. It runs in a terminal
in well under a second. Why the values it reads live in a config file:
[ADR 0012](../adr/0012-tooling-values-in-config-not-prose.md).

## Checks

| Check | Catches |
| --- | --- |
| `frontmatter` | In every shipped component and every skill and agent under `.claude/`: a missing description, one past the 1024-char packaging cap, a `<` or `>` in the description, a skill whose `name` is not kebab-case or does not match its directory, an agent without a `name` or with a `:` in it, any frontmatter field Claude Code does not read, and `permissionMode` in a plugin agent (honoured for a project agent and ignored for a plugin agent, observed on 2.1.283) |
| `skill-dirs` | A directory under a pack's `skills/` or under `.claude/skills/` without a `SKILL.md` |
| `budget` | The always-on description total of the shipped packs over `budget.ceiling` in `devkit.config.json`. When it passes, it prints the total against the ceiling |
| `references` | A cited `.md` that does not resolve **from the file citing it** |
| `mcp-names` | A blocked `mcp__` tool absent from the table documenting it |
| `scripts` | A `.mjs` that does not parse, or a `hooks.json` arg that is not a file inside the pack holding that `hooks.json` |
| `plugin-root` | A `${CLAUDE_PLUGIN_ROOT}/` path in any `.md` under a pack's `skills/` or `agents/`, references included, that does not resolve inside that pack |
| `versions` | A `plugin.json` without `version`, one not `X.Y.Z`, two packs disagreeing, a `marketplace.json` entry declaring `version`, no entries at all, or a `plugins/` directory with no entry |
| `changelog` | A plugin version with no `## X.Y.Z - YYYY-MM-DD` section in `CHANGELOG.md`, the heading the release workflow takes the notes from; `TBD` in place of the date is a finding |
| `docs-links` | A relative link that does not resolve, resolves outside the repository, or names an anchor that matches no heading in its target — in the files under `docs.roots` and in every listed pack's `README.md` and `evals/README.md`. Inline links (`<…>` targets included) and reference definitions are read; ATX and setext headings give anchors. Fenced code and inline code are skipped, as are links with a scheme such as `https:`. A link inside an indented code block is not recognised as code |

Every check that reads a pack reads the packs `marketplace.json` lists, through
`pack-graph.mjs`, so a marketplace entry it cannot follow — a non-path source, a missing
or invalid `plugin.json` — is a finding in each of them, and a pack it does not list is
read by none of them until it is, apart from the `scripts` check's parse step, which
parses every `.mjs` under `plugins/` whether its pack is listed or not.

Run a subset with `--checks=frontmatter,budget`; `node scripts/validate.mjs --checks=budget`
prints the current always-on total.

## `devkit.config.json`

The values the tooling reads. It is development configuration for this repository only:
no pack reads it, and it is not shipped.

| Key | Read by | Meaning |
| --- | --- | --- |
| `budget.ceiling` | the `budget` check, `scripts/hooks/budget-on-write.mjs` | The most characters the always-on descriptions of all shipped packs may total. Raise it only as a deliberate decision: every listed description is paid for in every session of every repository that enables the pack |
| `stopHook.watch` | `scripts/hooks/on-stop.mjs` | The paths whose change makes the `Stop` hook run `validate.mjs`; the `docs.roots` entries are watched too, without being repeated here. Without a usable list, every stop validates, and a green tree still stops once to say the key needs fixing |
| `docs.roots` | the `docs-links` check | The Markdown files and directories whose links are checked; the packs' READMEs are added without being listed |

A missing or malformed config, or a key of the wrong type, is a finding in each check that
reads it, never a silent pass. The `Stop` hook, which reads `stopHook.watch` itself, falls
back to validating on every stop and says why.

## What `claude plugin validate --strict` does and does not check

**`--strict` does not read component frontmatter.** It flags an unknown field in
`plugin.json` and a missing `description` in a `SKILL.md`, but a *misspelled* frontmatter
key passes clean — checked against 2.1.250, 2.1.276, 2.1.278 and 2.1.283. That failure is
silent and expensive in both directions: misspell `disable-model-invocation` and a typed
skill starts auto-triggering in every repository, misspell `disallowed-tools` and a
guardrail stops being enforced with
the prose still claiming it is. What the validator will not check is owned by
`scripts/validate.mjs`, which runs in a terminal in well under a second — there is no
reason to reach for `act` or to keep those rules true by hand.

`--strict` turns an unrecognised field into an error, which is the only way to catch a typo
such as `mcpServer` for `mcpServers` — Claude Code ignores unknown fields at load time, so
without it the component silently never loads. Every manifest carries `version`, so it is
expected to exit clean here; CI fails a target on any finding or a non-zero exit.
