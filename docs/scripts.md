# Scripts

The `core` pack's shared scripts, in `plugins/core/scripts/`. Skills and hooks call them;
you can run them by hand to see what the devkit sees. Every fact is read at the moment of
use from a file the project already maintains, and nothing is cached:
[ADR 0003](adr/0003-facts-read-at-moment-of-use.md).

## `project-facts.mjs`

**`project-facts.mjs`** describes a project from its own files: package manager (the
Corepack field, else the lockfile), gates (`package.json` scripts, with aliases resolved —
`typecheck`, `type-check` and `test:unit` all occur in the wild), base branch
(`origin/HEAD`), git host (the remote plus `.gitlab/` markers, so a self-hosted GitLab is
recognised), commit convention (points at the commitlint config rather than paraphrasing
it) and merge-request templates.

Gates are reported as `declared`. A script name existing says nothing about whether its
binary resolves, so `available` stays `null` until something runs it.

`projectRoot` says whether the directory is a project root: it has a `package.json` or a
`.claude/project.json`, or it is the git top level. Anywhere else — below the top level
with neither file, or outside any git work tree — every gate, dev server and Storybook
script it did not find carries that reason instead of "no script", so a wrong working
directory never reads as a project without gates. The directory is reported, never
resolved to the top level, which would describe a wrong directory inside another
repository as that repository.

`devServer` and `browserTools` draw the same line. `devServer.declaredPort` is the port
the script *names*, and Vite, Nuxt and Next all walk to the next free one when it is
taken — so the URL to open is the one the server printed, and a caller that trusts the
declared number verifies a page nothing is serving. `browserTools` lists the browser MCP
servers this repository declares in `.mcp.json` and whether its settings approve them;
`available` stays `null` there too, because a server installed at user scope serves every
project without appearing in any file here. Only the caller's own tool list settles that
one.

`stack` names the stack, not the pack: `vue-spa`, `nuxt`, `react-spa`, `next`, or `null`.
A meta-framework is checked before the view library it builds on, so a Nuxt app never
reports as plain Vue. `stack.packs` maps that to the packs which serve it — `nuxt`
resolves to `['vue', 'nuxt']`, general first — so no component has to restate the
mapping in prose and drift from it.

## `run-gates.mjs`

**`run-gates.mjs`** runs those gates and separates three outcomes:

| Status | Means |
| --- | --- |
| `pass` | ran, clean |
| `fail` | ran, found a defect **in the code** |
| `not-run` + `blocking: true` | could not run — a defect **in the setup** |

In a directory that is not a project root, every gate is `not-run` with the `projectRoot`
reason and `blocking: false`, `passed` is false and the exit code is 1: nothing there can
pass, and the Stop hook, which acts only on a `fail` or a blocking `not-run`, stays silent
in a session started outside a project.

Classification reads the exit code and the captured output, not `proc.error`: under
`shell: true` a missing binary returns `{ status: 127, error: null }`, because the shell
itself started fine. On every OS exit 127 marks a missing binary; output such as
`command not found` or `No such file or directory` under any other exit code is a `fail`.
On Windows, where cmd.exe exits 1, a stderr line that starts with `'<x>' is not recognized
as an internal or external command` marks it too (observed on Windows 10 Pro 10.0.19045,
Node 22.23.3, npm); the same text in the middle of a line, or on stdout, is a `fail`.
PowerShell's wording, `The term '<x>' is not recognized` after an optional `<x> :` prefix,
is matched on stderr as well, but neither it nor the exit code Yarn Berry gives on Windows
has been observed yet. Probing `node_modules/.bin` is not a workaround — in a pnpm workspace
a binary such as `vue-tsc` lives in the workspace package and never at the root, so a root
probe reports every workspace binary missing.

Under `--json` every gate that ran and did not pass — a `fail`, or a `not-run` that timed
out, whose command is not installed or whose script does not exist — carries an `output`
field: the end of its stdout and stderr, merged in the order they arrived, cut to the last
60 lines and then to at most 4000 characters. A `pass`, and a `not-run` that never started
— its shell could not be spawned included — carry none. Without `--json` the whole output
of each gate is printed, in the same arrival order.

Stages: `fast` (typecheck, lint) · `full` (+ test) · `release` (+ build). Stages are picked
by risk and by what the user has released: `build` is the slowest gate and guards the
release, so it runs in the `release` stage only, when that stage is asked for. Every gate
has a timeout, and a script that starts a watcher is refused rather than left to hang.
A gate whose script rewrites files — `--fix`, `--write` or `--apply` (not `--fix-dry-run`),
in the script itself or one level down in a script it runs through `run-s`, `run-p`,
`npm-run-all`, `npm run`, `pnpm [run]` or `yarn [run]` — is never executed, `--gate format`
included: it is `not-run` with `blocking: false`, and its reason asks for the package.json
script to check only, with the fix moved into a separate script such as `lint:fix`.

Exit codes: `0` every gate the project has that may run ran and passed (a refused fixer is
`not-run` and does not fail the run) · `1` a gate failed, a gate the project declares
could not run, or the directory is not a project root · `2` a usage error · `128 + n`
stopped by signal `n` (SIGINT, SIGTERM or SIGHUP). A usage error runs no gate: an unknown
`--stage`, a `--gate` that is not one of the canonical names `typecheck`, `lint`, `test`,
`build`, `format` (an alias such as `test:unit` is refused), a flag with no value or
another flag in its place (`--stage --json`), a flag given twice, an unknown flag (`--stag
full`, `--jsn`) or an argument that belongs to no flag, or a bad `--timeout` or
`--budget`. stderr says `run-gates: <message>`, and under `--json` stdout is `{"passed":
false, "usageError": "<message>"}` with no `results`. The Stop hook hands that message
back as a non-blocking notice and does not remember the tree as green.

## `snapshot.mjs`

**`snapshot.mjs`** captures the working state as a git tree without committing or staging
anything. `take` prints a tree id covering tracked, staged and untracked non-ignored files;
`diff <base>` writes a header line, `--stat` and a `-U10` diff from `<base>` — a tree id, a
commit, or any rev such as a merge-base — to that state into a file under the repository
root's `temp/` (or `--out`, a relative path resolved from the root whatever the current
directory), and prints its path. The tree is built in a throwaway copy of the index, so the
index stays byte-identical and no ref or `HEAD` moves; only unreachable, gc-able objects
are written. The root's `temp/` and every path `block-secrets` treats as credential
material are left out of both, whether or not `temp/` is gitignored; a second header line
names each credential path that differs from the base, since the diff cannot show it.
Submodule working-tree changes are not captured.

## Per-project override

`.claude/project.json` is honoured when a project has one, purely to correct what detection
gets wrong. It is never required.

```json
{
  "gates": { "test": "pnpm test:ci" },
  "baseBranch": "develop",
  "verifyOnStop": false,
  "stages": { "fast": ["typecheck"] },
  "timeoutMs": 300000
}
```

That is the whole set. `gates` and `baseBranch` replace what detection found;
`verifyOnStop: false` silences the Stop hook; `stages` is merged over the built-in stages
by name, so the entry above *replaces* `fast` rather than adding to it; `timeoutMs` sets
the per-gate timeout, though a `--timeout` flag still wins over it, and a `--budget` flag
caps each gate at what is left of the whole run. A timeout of `0` sets none; the budget
still applies. A gate that times out is stopped with every process still reachable through
it; on Windows a process whose parent shell has already exited is not. On macOS and Linux
each gate runs in a process group of its own, which `run-gates.mjs` stops when it is
interrupted or terminated; a `SIGKILL` to it, or to the process group it was started in,
ends it without that cleanup, and the gate's processes run on.

`gates.format` accepts only known formatters. The value is a string from a checked-out file
handed to a subprocess, and the allowlist is what keeps it a convenience rather than an
execution primitive.
