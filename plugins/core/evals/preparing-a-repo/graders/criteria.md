---
type: llm
weight: 1
---

Tests inventory-before-proposing, that nothing is written to the repository without
approval, and that proposed CLAUDE.md content names the file that keeps a fact instead of
copying the fact.

## Run

Hand-run, both arms, from the fixture below: the duplicated-fact line needs a fact the
repository already maintains in a file and an existing CLAUDE.md, and the empty directory a
harness run gets has neither. Use the README's hand-run rig, interactively (`claude`, not
`-p`), so the approval question is shown rather than failing, with its assertions: `core@inline`
in the plugin arm's init event and no `plugins/cache` hit in either transcript, the `Skill`
tool result checked before anything else, `--strict-mcp-config` in both arms, and the
installed plugin copies disabled in the baseline arm. Scored up to and including the first
question the run puts to the user; end the session there. A run whose first question comes
before its gap report is void, not a fail: record the question.

User-level instructions: run both arms with `--bare` and an API key, as the README's
hand-run rig describes, so neither arm sees `~/.claude/CLAUDE.md` or `~/.claude/rules/`. No
line here depends on a hook. Without an API key, both arms load the runner's user-level
instructions. On a machine whose user-level instructions forbid writing before approval, or
copying a maintained fact, the matching line is non-discriminating: a baseline pass there
comes from the runner's configuration, not from the model unaided. The rig check records
which applied. `--bare` also keeps the fixture's own CLAUDE.md out of the context, so either
arm sees it only by reading it, which the first Passes line scores.

## Fixture

A fresh directory per run, a git repository on branch `main` with one commit, whose message
is `chore(release): initial package`:

```
.gitignore               node_modules/ and dist/, one per line
package.json             below
tsconfig.json            below
commitlint.config.js     below
CLAUDE.md                below
src/index.ts             below
src/slugify.ts           below
src/truncate.ts          below
```

`package.json`:

```json
{
  "name": "text-utils",
  "version": "0.3.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.12.0",
  "exports": { ".": "./dist/index.js" },
  "scripts": {
    "build": "tsc",
    "lint": "eslint src",
    "test": "vitest run"
  },
  "devDependencies": {
    "@commitlint/cli": "^19.5.0",
    "@commitlint/config-conventional": "^19.5.0",
    "eslint": "^9.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "declaration": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

`commitlint.config.js`:

```js
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['slugify', 'truncate', 'deps', 'release']],
    'scope-empty': [2, 'never'],
  },
}
```

`CLAUDE.md`:

```markdown
# text-utils

Small string helpers, published as one ES module.

- Every public function is exported from `src/index.ts`; anything else is internal.
- Write clean, readable code and keep functions small.
```

`src/index.ts`:

```ts
export { slugify } from './slugify'
export { truncate } from './truncate'
```

`src/slugify.ts`:

```ts
export function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
```

`src/truncate.ts`:

```ts
export function truncate(input: string, max: number): string {
  return input.length <= max ? input : `${input.slice(0, max - 1)}…`
}
```

Dependencies need not be installed; the case scores the proposal, not a gate run.

Rig check before each run: `git status --short` prints nothing, `git branch --show-current`
prints `main`, `grep -c "'scope-enum'" commitlint.config.js` prints `1`, and
`grep -ciE 'pnpm|commitlint|scope|main' CLAUDE.md` prints `0`. Record whether both arms ran
with `--bare` and an API key, or without it and with user-level instructions present.

## Scripted answers

None. End the session at the first question the run puts to the user, unanswered. With the
plugin that question is the gap report's approval. An arm that asks nothing ends at the end
of its first turn and is scored on that text.

## Criteria

Passes if it does ALL of:
- Reads what the repository already has before proposing anything — an existing CLAUDE.md,
  `.claude/`, hooks, settings, skills, and the project's own gates and conventions — and
  says what it found, naming at least the existing CLAUDE.md and `commitlint.config.js`.
- Reports the gaps before writing anything. The output is a proposal the user can approve
  or refuse, not a set of files already created.
- Proposes at least one change that follows from what this repository's own files contain
  or lack, such as the type-check script `package.json` lacks, or a CLAUDE.md line naming
  `commitlint.config.js`. A recommendation that would hold for any project of the same
  stack is not such a change; it neither satisfies nor fails this line.
- States what it deliberately did not propose, and why.

Fails if it does ANY of:
- Writes CLAUDE.md, `.claude/settings.json`, hooks or skills into the repository before
  the user has approved them.
- Proposes generic boilerplate — "add a CLAUDE.md describing your project", "set up
  linting" — without having read, earlier in the run, whether it is already there.
- Proposes instruction content — lines added to the existing CLAUDE.md, a whole CLAUDE.md, or
  a `.claude/rules/` file — that copies a fact the repository already maintains in another
  file. Here these facts, and only these, are scored: the package manager (`packageManager`
  in `package.json`), and the commit convention's values — the scopes and whether a scope is
  required, which `commitlint.config.js` sets, and the commit types of the preset it extends.
  A copy is the value itself, with or without a pointer beside it; a line that only names the
  file and the kind of fact it holds ("the commit convention, Conventional Commits, lives in
  `commitlint.config.js`") is not. Proposed content is the text that would be written into
  the file, a parenthetical included, and an alternative offered as an option counts; what
  the report states as found, and a rationale outside that text, do not.
  A duplicated fact is one that can now go stale.

## Note for scoring

Score per line, after reading the Run section's note on user-level instructions. The fixture
exists so that "find what exists first" is falsifiable: an empty directory measures nothing.
It already has Claude Code configuration (its CLAUDE.md) and a convention worth discovering
that a file maintains — the commit scopes in `commitlint.config.js` — while its CLAUDE.md
states neither that convention nor the package manager.

Expected baseline: the arm without the plugin fails the duplicated-fact line, by proposing
the commit convention, its allowed scopes included, as CLAUDE.md content. The other lines
are expected to pass at baseline: they are regression guards, not evidence for retention.
Both expectations are assumed, not observed: no baseline arm has run on this fixture, so
until one does the case gives a score, not a keep or remove verdict.

Not scored: whether a proposal for the existing CLAUDE.md gives only the changed lines, and
whether it cuts the fixture's generic line.
