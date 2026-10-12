# Reading the project

The facts every lifecycle skill needs, read from files the project already keeps, at the
moment a step needs them. Nothing is cached between steps.

## Package manager
The lockfile names it: pnpm-lock.yaml → pnpm · yarn.lock → yarn · bun.lock or bun.lockb → bun ·
otherwise npm. A `packageManager` field in package.json wins. Run scripts as `<pm> run <script>`.

## Framework packs
Read the workspace's package.json — the root, or the workspace the task names in a monorepo
(`workspaces` in package.json, or pnpm-workspace.yaml). dependencies + devDependencies:
`nuxt` present → call the Skill tool with "vue:vue-engineering", then "nuxt:nuxt-engineering";
else `vue` present → "vue:vue-engineering"; else none — say so, follow the codebase's conventions.
A pack whose skill this session does not list is not installed: say so once and go on without it.
A later pack wins every conflict. Each dispatch to a worker names the packs it found.

## Gates
Read package.json `scripts`. The fast gates are typecheck (`typecheck`, `type-check` or `tsc`)
and lint (`lint`); test (`test`) and build (`build`) are held until the user releases them.
Run each as `<pm> run <script>` from the workspace's directory, read its own exit code — never
a pipe's, which is the last command's: in Bash, `${PIPESTATUS[0]}` after `| tail -40` — writing
no file. Report each gate as exactly one of: `pass` (exit 0) · `FAIL` (non-zero, the error
lines quoted) · `NOT RUN (<reason>)` — no such script, held, a script that watches, a
package.json that is not valid JSON, a tool the shell reports not found or not recognized. NOT RUN is never a pass, and a gate that did not run is
never implied passed. Never run a script whose body contains --watch, --fix, --write or --apply.

## Formatter
The one the project configures — Prettier, Biome, or the tool its `format` script runs — on
the touched files only: the script's tool and flags with the touched paths in place of its
glob (`<pm> exec prettier --write <paths>`), never the whole tree, never the `format` script
itself. None configured: say so once.

## Base branch
`git symbolic-ref --quiet --short refs/remotes/origin/HEAD` → `origin/<base>`. Without a
remote HEAD, `main` or `master` if it exists locally; otherwise ask. The diff base of a branch
is `git merge-base HEAD origin/<base>` (or the local base).
