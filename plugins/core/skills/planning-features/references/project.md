# Reading the project

The facts every lifecycle skill needs, read from files the project already keeps, at the
moment a step needs them. Nothing is cached between steps.

## Package manager
The lockfile names it: pnpm-lock.yaml → pnpm · yarn.lock → yarn · bun.lock or bun.lockb → bun ·
otherwise npm. A `packageManager` field in package.json wins. It applies only where package.json
is the source: run its scripts as `<pm> run <script>`, and no other source's command through it.

## Framework packs
Read the workspace's package.json — the root, or the workspace the task names in a monorepo
(`workspaces` in package.json, or pnpm-workspace.yaml). dependencies + devDependencies:
`nuxt` present → call the Skill tool with "vue:vue-engineering", then "nuxt:nuxt-engineering";
else `vue` present → "vue:vue-engineering"; else none — say so, follow the codebase's conventions.
A pack whose skill this session does not list is not installed: say so once and go on without it.
A later pack wins every conflict. Each dispatch to a worker names the packs it found.

## Gates
A gate is only a command the project declares in a file it maintains, and every gate line
names that file. Gates run per workspace: a touched file's workspace is the nearest directory
above it, up to the repository root, where `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, or a
manifest or task runner's file — package.json, a `Makefile`, a `justfile` — names a check or a
command. Work that touches one workspace runs
only that workspace's gates.

1. **Source.** The first of `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md` that names the
   workspace's checks is the whole list, merged with nothing, and narrowed by its own words
   ("the first two are the gate"). Otherwise the targets of its manifest or task runner —
   package.json `scripts`, a `Makefile`, a `justfile` — are the declaration, with no
   documenting line needed. A CI file is evidence, never a source. Nothing declared:
   `NOT RUN (no declared command)`, never a guess.
2. **Read before running.** Read each command's recipe and every prerequisite it runs. One
   that changes the working tree — a fixer, a formatter that writes, a generator, or a
   prerequisite that does any of these — is never a gate, whatever its name; nor is one that
   watches and never exits. In doubt, `NOT RUN (<command>: <why>)`, the command named.
3. **Classify.** The source's own words decide whether a check is a test, a build or a quick
   check; without them, the recipe does: a test runner or a build is held (`## Held checks`),
   a check that only reads is a fast gate. In doubt, NOT RUN with the command named.
4. **Run** each fast gate from its workspace's directory: a documented command exactly as
   written · a package.json script as `<pm> run <script>` · a `Makefile` target as
   `make <target>` · another manifest's target with no documented invocation is
   `NOT RUN (no documented invocation)`. Read the command's own exit code — never a pipe's,
   which is the last command's: in Bash, `${PIPESTATUS[0]}` after `| tail -40` — writing no
   file.
5. **Report** one line per gate, `<workspace> · <command> · <source> · <result>`, the result
   exactly one of: `pass` (exit 0) · `FAIL` (non-zero, the error lines quoted) ·
   `NOT RUN (<reason>)` — no declared command, held, writes, in doubt, watches and never exits,
   a manifest that does not parse, a tool the shell reports not found or not recognized. A
   workspace that declares nothing gets one line, `<workspace> · — · — · NOT RUN (no declared
   command)`. NOT RUN is never a pass, and a gate that did not run is never implied passed.

## Own code
A directory the repository's `CLAUDE.md`, `AGENTS.md` or `CONTRIBUTING.md` names as vendored
or generated is consumed; otherwise git decides: a tracked file, or an untracked one git does
not ignore, is this repository's own, and a gitignored file, a git submodule or code outside
the repository is consumed. Own code, in
any layer, may be fixed once the user decides; consumed code is reported to its owner, never
edited.

## Held checks
The heavier checks the user did not release: every declared test and build, which cost time
and quota. They wait until the user releases them, and are reported `NOT RUN (held)` until
then. A command that runs a test or a build among other checks is held whole. A test or
build the project does not declare gets no line.

## Formatter
One tool per workspace (`## Gates` finds the workspace), by the project's own invocation, on
the touched files only.

1. **The project's hook.** When the repository's `.claude/settings.json` or
   `.claude/settings.local.json` runs a formatter in a `PostToolUse` hook on `Edit` or
   `Write`, that hook formats; nothing formats a second time. `~/.claude/settings.json` is
   not read.
2. **Otherwise, the first that names one:** the formatter the workspace's `CLAUDE.md`,
   `AGENTS.md` or `CONTRIBUTING.md` names → the verbatim command of a per-file hook config
   (lint-staged, lefthook, a local pre-commit `entry`) → a formatting target of its manifest
   or task runner, invoked as `## Gates` step 4 invokes one.
3. **Narrowed** to the touched files: the command's tool and flags with the touched paths in
   place of its glob or directory — the tool called directly, or through the launcher the
   project's own files use for a tool it installs for itself, never the script or target
   itself. A command that cannot be narrowed — it formats the whole
   tree (`cargo fmt`, `dotnet format`) or takes no paths — does not run, and is reported.
4. **Evidence, never a reason to write:** a formatter's config file, its dev dependency,
   `.editorconfig`, editor settings and CI. Name the candidate and write nothing.

Report one line per touched workspace: `<workspace> · <command> on <touched paths>` ·
`<workspace> · none (<reason>)` · `<workspace> · the project's hook (<settings file>)`.

## Base branch
`git symbolic-ref --quiet --short refs/remotes/origin/HEAD` → `origin/<base>`. Without a
remote HEAD, `main` or `master` if it exists locally; otherwise ask. The diff base of a branch
is `git merge-base HEAD origin/<base>` (or the local base).
