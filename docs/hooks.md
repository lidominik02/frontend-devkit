# Hooks

The `core` pack ships two hooks, declared in
[`hooks.json`](../plugins/core/hooks/hooks.json). Each one starts through `run.mjs`, which
checks the Node version first ([Installation](installation.md#node)). Both are Node,
not bash: [ADR 0001](adr/0001-node-hooks-with-version-gate.md).

Each hook acts only on the tool calls its matcher selects; what falls outside every
matcher is listed under [What no hook covers](#what-no-hook-covers).

| Hook | Event | What it does |
| --- | --- | --- |
| `block-secrets.mjs` | PreToolUse | Blocks reading or sending credential material through file tools, `Bash` and `PowerShell` |
| `commit-hygiene.mjs` | PreToolUse | Blocks a commit message with an attribution trailer or a private reference, and the `git` push and merge forms it can parse |

## Hook input on Windows

Observed on Windows 10 Pro 10.0.19045 with Claude Code 2.1.292, through a PreToolUse hook
that logged its stdin:

- A PowerShell tool call arrives with `tool_name` `PowerShell` and the script in
  `tool_input.command`, exactly as written, backslashes and quotes untouched — the field
  the `Bash` tool uses.
- The path of a `Read`, `Write` and `Edit` call (`tool_input.file_path`) and of a `Grep`
  call (`tool_input.path`) arrives as a backslash Windows path. A `Read` given forward
  slashes (`C:/Users/…`) arrived with backslashes; one given a lowercase drive letter
  (`c:\Users\…`) arrived lowercase, so the drive letter's case is the caller's.
  `NotebookEdit` and `MultiEdit` were not observed.
- The event's `cwd` is a backslash Windows path whose drive letter's case varies between
  calls in one session: `c:\…` on the one PowerShell call logged, `C:\…` on every other.

`block-secrets` and `commit-hygiene` both judge a PowerShell call on that field.

## Observed in a Windows session

Observed on 2026-10-10 on Windows 10 Pro 10.0.19045 with Claude Code 2.1.292 and Node
22.23.3, in `claude -p` sessions (model `sonnet`) in a scratch repository, with the
working tree's `core` loaded through `--plugin-dir`:

- `cat .env` from the `Bash` tool and `Get-Content .env.local` from the `PowerShell` tool
  were both denied by `block-secrets` with the dotenv message, which named the file and
  the absolute, quoted `env-names.mjs` command.
- That command, run from the `Bash` tool, was not denied, and printed the file's variable
  names only, no value.
- A `Read` of `.env` given as a backslash absolute path (`C:\…\.env`) was denied with the
  file-tool dotenv message.
- `git push origin main` from the `Bash` tool and from the `PowerShell` tool were both
  denied by `commit-hygiene`, with the message to hand the step back to the user.
- In the `stream-json` output, a PreToolUse denial appeared as a `hook_response` with
  `hook_name` `PreToolUse:<Tool>`, `exit_code` 2 and the reason in `stderr`.

macOS is not observed in a Claude Code session.

## `block-secrets.mjs`

Exits 2 on credential material, regardless of permission mode.

- Covers **file tools, `Bash` and `PowerShell`** — a `deny` rule does nothing about reading
  a dotenv file in a shell.
- Blocks exfiltration (upload flags, piping into a network client), interpreter one-liners,
  `source`, environment dumps and a download piped into a shell. An environment dump is
  a command, judged on the parsed command words, so a word inside quotes, a message or a
  URL is not one (`git commit -m "read it from the environment (env)"`,
  `echo "(set)"` pass); only a command that does not parse is matched as text. It is
  `env` or `printenv` alone, or a bare `set`, on any line, after a
  reserved word or in a group too (`then set`, `{ env; }`, `! printenv` block; `set -e`,
  `set -euo pipefail`, `env FOO=1 node x.js` and `printenv HOME` pass), behind a wrapper
  (`sudo`, `doas`, `command`, `builtin`, `exec`, `nohup`, `nice`, `timeout`, `time`) and
  with options or assignments but no command (`sudo -E env`, `timeout 5 env`,
  `nice -n 5 env`, `builtin set`, `env -0`, `env -u FOO`, `printenv -0` block;
  `env -i node x.js`, `sudo -E npm i` and `printenv -0 HOME` pass), and in `cmd` a
  `set` alone or with a name, which lists every variable the name prefixes, after an
  `if` condition, an `else`, a `for`'s `do` or a `call` (`cmd /c "if 1==1 set"`,
  `cmd /c "call set"` and `cmd /c "set AWS"` block, `cmd /c "if 1==1 set X=1"` and
  `cmd /c "set /a X=1"` pass); it blocks inside a substitution (`e=$(env)`), an `eval` and a
  nested shell's script too, judged by that shell's language (`bash -c 'set'`,
  `pwsh -c 'gci env:'`, and `cmd /c set` from either tool, while `cmd /c set X=1`
  passes). An upload or interpreter option keeps its letter case (`curl -T` uploads,
  `curl -t` does not); a command name and a path match in any case.
- A shell word is judged by the same credential names as a file path, with
  credential-paths.mjs as the one source: a dotenv file, a file under a `.env` or `.env.*`
  directory (`.env.d/secret`, for a file tool as for a shell), a file under `secrets/`, `.ssh`
  or `.gnupg` (the last two also named bare, as in `tar czf x ~/.ssh`), `.aws/credentials`,
  a `.pem`, `.p12`, `.pfx`, `.keystore` or `.key` file, an `id_rsa`-style key, a
  service-account or `credentials.json` file.
- Refuses hand-edits to lockfiles and `.git/`.
- Matches paths with backslashes as well as forward slashes, and ignores letter case on
  every platform: Windows sends backslash paths, and a case-insensitive filesystem opens
  `.env` for `.ENV`.
- Blocks a `Grep` whose `glob` targets a credential file by name or directory (`.env*`,
  `**/.env`, `*.pem`, `secrets/*`, `a/b/.ssh/*`), even when its `path` is a directory.
  Each `{a,b}` alternative, with `*`, `?` and `[...]` removed, is judged as a path by the
  same rules as a file path, so `*`, `**/*`, `src/*`, `*.json` and `*.ts` pass. A last
  segment that starts with a dot is also matched against `.env` itself, so `.*`, `**/.*`
  and `.e*` block. A glob starting with `!` excludes and passes. Known limit: a
  deliberately shortened glob that does not start with a dot (`*.p*`) gets through; the
  hook is not a sandbox.
- Exempts `.example` / `.sample` / `.template`.
- Judges a `Bash` read by operand position. The command is parsed into simple commands,
  and a credential path blocks as a file operand of a reading command (`cat`, `grep`,
  `cp`, `source`, `.`, …), and as the target of an input redirect (`<`, `<>`, `N<`) of any
  command. Commands inside `$(…)`, backticks, an `eval`, a `bash -c` / `sh -c` script and
  a script fed to a shell on stdin (a here-string or heredoc) are judged the same way,
  down to two levels of nesting; a script piped into a shell is judged by its text, quotes
  included (`echo 'cat .env' | sh` blocks). A file handed to a reader counts as its operand:
  `xargs` hands its command each item of a here-string or heredoc, of a pipe from `echo`,
  `printf`, `ls` or `find`, and the file its `-a` / `--arg-file` names is itself read
  (`xargs cat <<< .env`, `echo .env | xargs cat`, `xargs -a .env cat` block); `find`'s
  `-exec`, `-execdir`, `-ok` and `-okdir` get its `-name` / `-path` value at `{}`
  (`find . -name .env -exec cat {} \;` blocks, `-exec rm {} \;` passes); and a
  `sh -c` script's `$0`, `$1`, …, `$@` are the words after it
  (`sh -c 'cat "$1"' _ .env` blocks), unless single-quoted or escaped in the script, where
  the shell leaves them literal. The one string a command runner hands a shell is
  judged as a nested script too: what follows `ssh`'s host, the `-c` / `--command` value of
  `su`, `runuser`, `script` and `flock`, and `watch`'s command (`ssh host 'cat .env'`,
  `su -c 'cat .env'`, `script -qc 'cat .env' /dev/null`, `flock /tmp/l -c 'cat .env'`,
  `watch 'cat .env'` block). Any other command that runs its arguments is judged by the
  reader among them (`sudo`, `doas`, `nohup`, `env -i`, `timeout`, `stdbuf`, `chroot`,
  `busybox`, `parallel cat ::: .env` block). GNU `parallel` also reads the files it takes
  its arguments from itself, whatever command it runs: an `-a` / `--arg-file` value and
  each word after `::::` (`parallel -a .env echo`, `parallel echo :::: .env` block). A shell that echoes the lines of a script file
  it runs (`-x`, `-v`, `-o xtrace`, `-o verbose`) reads that file, so `bash -x .env`
  blocks. An excluding pattern always passes: the value
  of `--exclude` and `--exclude-dir` (`grep`, `rg`, and `--exclude` for `rsync` and
  `tar`), an `rg` `-g` / `--glob` / `--iglob` value starting with `!`, the pattern operand
  of `grep` and `rg` when no `-e` or `-f` is given (an abbreviated `--regexp`, such as
  `--rege=x`, counts as `-e`), and an excluding pathspec (`:!…`,
  `:^…`, `:(exclude)…`). A selecting pattern — the value of `--include`, and of `rg`'s
  `-g` / `--glob` / `--iglob` without `!` — opens the files it names, so it is judged by
  the same rule as a `Grep` glob: `--include='*.md'` passes, `--include=.env` and
  `rg -g .env` block. A reading command word counts only as a command, so
  `find . -name ".env*"` and `ls . .env` pass; `grep -c FOO .env` and `sort -g .env`
  still block.
- Falls back to matching the command text for a reading command followed by a credential
  path when the command cannot be parsed (an unbalanced quote, or any parser error) or
  nests deeper than two levels, and the environment-dump rule then matches the text too.
  The upload, interpreter and download rules always match the text.
- Judges a `PowerShell` command the same way, with the same tokeniser, in any letter case.
  Its readers are `Get-Content`, `gc`, `cat`, `type`, `Select-String`, `sls`,
  `Copy-Item`, `copy`, `cp` and `Import-Csv`, besides the `Bash` ones: a parameter value
  (`-Path .env`, `-Path:.env`) is judged as a file, a `-Pattern` value and
  `Select-String`'s positional pattern are not (`Select-String 'process\.env' src` passes),
  and an `-Include` or `-Filter` value is judged as a glob. `Invoke-Expression` (`iex`) is
  judged like `eval`. A backslash is read literally, as PowerShell does
  (`gc app\.env` blocks). A backtick escape is rewritten into the tokeniser's own escape
  for the character it stands for, so a command holding one is parsed like any other
  (`gc .`e`n`v` blocks, `Select-String -Pattern 'process\.env' src; "a`tb"` passes), and a
  `<#…#>` block comment is dropped. A parenthesised argument or an array expression stays
  one of the command's words, its text also judged as a command
  (`Get-Content (Join-Path $PSScriptRoot '.env')`, `gc ('.env')` and
  `Get-Content @('.env')` block, `Get-Content (Get-Date)` passes). A group whose text is a literal
  path or a `Join-Path` of literal paths names its file in the dotenv message
  (`gc (Join-Path . .env)` names `./.env`); one holding a variable gets the generic
  message. An assignment or a script
  block glued to the command does not hide it (`$c=Get-Content .env`, `$a=$b=gc .env`,
  `& {gc .env}`, `1 | % {gc .env}` block). A piped reader reads what the nearest command hands it, past
  the cmdlets that hand on what they get — `Select-Object`, `Where-Object`, `Sort-Object`,
  `Tee-Object` and their aliases, not `Out-Null` (`gci .env* | select -First 1 | gc`
  blocks), and a `ForEach-Object` (`%`, `foreach`) whose `-Process` block, named
  (`-Process { $_ }`, `-Process:{ $_ }`) or positional — the only block, the second of
  two, a middle one of three or more — emits the item or a property of it, whatever its
  `-Begin` and `-End` blocks (`gci .env* | % { $_ } | gc`, `gci .env* | % FullName | gc`,
  `gci .env* | % { $_ } -End { 1 } | gc` and `gci .env* | % {1} {$_} {2} | gc` block,
  `gci .env* | % { 'x' } | gc` passes): the
  paths and filters of a `Get-ChildItem` or `Get-Item` (`gci`, `dir`, `ls`, `gi`,
  `Resolve-Path`) are judged as its own (`Get-ChildItem .env* | Get-Content` and
  `gci -Filter .env | gc` block), and so is a lone path string, except for
  `Select-String`, which searches a piped string as text (`'.env' | Get-Content` blocks,
  `'.env' | Select-String KEY` passes). A directory walk names no file, so
  `Get-ChildItem . -Recurse | Get-Content` passes. Also blocked: an `[IO.File]` read on a credential
  path — `ReadAllText`, `ReadAllLines`, `ReadAllBytes`, `ReadLines`, each also as
  `…Async`, `OpenText`, `OpenRead`, with or without `System.` — and an
  `[IO.StreamReader]::new` on one; `Get-ChildItem env:` (`gci`, `dir`, `ls`) and
  `Get-Item env:` (`gi`) whatever follows it, a switch or a wildcard (`env:*KEY*`)
  included, on any line and when assigned (`$e = gci env:`), while a plain `env:NAME`
  passes; `Invoke-WebRequest` / `Invoke-RestMethod` (`iwr`, `irm`) with a credential path
  after `-InFile` or `-Body`; and a download run by `Invoke-Expression` (`iex`), piped into
  it or given as its argument (`iex (iwr …)`), whether it comes from a downloader cmdlet,
  `curl` and `wget` included, being aliases of `Invoke-WebRequest` in Windows PowerShell
  5.1, or from a .NET `DownloadString(…)`.
- A nested shell's script is judged in that shell's language, whichever tool started it:
  a `pwsh` / `powershell` script with the PowerShell rules (`pwsh -c "gc .env"` blocks from
  the `Bash` tool), a `cmd` script with cmd's readers — `type`, `copy`, `more`, `findstr`
  and `find` (whose first word is the search string unless `/c:` or `/g:` gives it),
  besides the `Bash` ones, a backslash read literally and `^` as cmd's escape
  (`cmd /c type .env` blocks) — and a POSIX shell's script with the `Bash` readers
  (`bash -c 'type .env'` passes from the `PowerShell` tool). The dotenv message quotes the
  file for the shell of the tool that made the call.
- The dotenv block message names the file and the names helper, as an absolute, quoted
  path: `node "<plugin>/scripts/env-names.mjs" '<file>'` prints the variable names a
  dotenv file defines, never their values; `test -n "$NAME"`, or `[bool]$env:NAME` in
  PowerShell, checks the environment. The file is single-quoted for the shell of the tool
  that triggered the block, so a `$` in its name stays literal: a `'` in it is doubled for
  `PowerShell` and written `'\''` for `Bash` and the file tools. When a glob matched, the
  message says to list the files it selects first and run the helper on each.
  The helper call — `node` with the helper beside the hook as its first argument, by
  resolved path, and only `.env` or `.env.*` files after it — is exempt from the reader
  judging; every other command on the line is judged as usual. A `node` script in general
  is not judged, as the hook's limitations say. The helper itself refuses any other file,
  so the message names it only for a file named `.env` or `.env.*` — one rule,
  `isDotenvFile` in `lib/credential-paths.mjs`, decides for the message, the exemption
  and the helper alike; a file under such a directory (`.env.d/secret`) gets the generic
  credential message.
- A dotenv match requires a path context before it (start, whitespace, a quote, `=`, `/`,
  `\`, `~`), so it does not match inside `process.env` or `import.meta.env`.
- A heredoc body is stripped from the scan by locating its real closing line, not by
  truncating everything after the opening marker — truncating there would let anything
  typed after the heredoc closes through unscanned. A heredoc whose delimiter is unquoted
  runs the `$(…)` and backtick substitutions in its body, so those are judged as commands
  (`cat <<EOF⏎$(cat .env)⏎EOF` blocks); a quoted delimiter (`<<'EOF'`, `<<"EOF"`,
  `<<\EOF`) keeps the body literal.
- Known limits, beyond the hook not being a sandbox:
  - `xargs` items are known only from a here-string, a heredoc, an `-a` file and a pipe
    from `echo`, `printf`, `ls` or `find`; what any other producer prints is unknown, so
    `cat list.txt | xargs cat` and `git ls-files | xargs cat` pass. Likewise the items
    `parallel` reads from a file (`parallel cat :::: list.txt` passes, `list.txt` itself
    not being a credential); and an `-a` before parallel's first `:::` is read as its
    own, so a command's own `-a` there is judged as parallel's file.
  - A `cmd` script is read with the POSIX tokeniser after `^` is resolved; cmd's own
    `%VAR%` expansion is not modelled, so a file named through a variable
    (`cmd /c "set F=.env&& type %F%"`) passes.
  - A PowerShell group turned into `$(…)` that holds a `#` line comment with a `'` in it
    reads as an unclosed quote, so the command falls back to the text rule; that can
    only block something harmless, never let a read through.

## `commit-hygiene.mjs`

Exits 2 on a `git commit` whose message carries an attribution trailer (`Co-Authored-By:`,
`Generated with`) or names something only Claude and the user can see: a Claude/chat
session, a handoff, a planning-artifact filename this pack's own skills write
(`HANDOFF.md`, `PROGRESS.md`, …), or a roadmap phase/artifact. A bare "session",
"roadmap", "phase N" or a decision/ADR id is deliberately not banned — each collides with
ordinary engineering vocabulary (a login session, a product's own roadmap page, a numbered
ADR a repository cites correctly). The file's own comments list exactly which forms are
matched and why.

What counts as the message:

- Every `-m`/`--message` and `--trailer` value (`key=value` read as the `key: value` git
  writes, observed on git 2.43.0) and every `-F`/`--file` text, bundled (`-am`, `-aF`) and
  abbreviated (`--mess`) spellings included.
- The commit's options and paths and the other commands on the line
  (`git add HANDOFF.md && git commit …`) are not its message.
- When the message comes from stdin, a process substitution, a `/dev/` or `/proc/` path, a
  file this hook cannot read, or a file the same command also names, the whole command is
  scanned instead, since the message may be written anywhere in it. Every shell word that
  names a `-F`/`--file` path is left out of that scan — the `-F` value, the `>` or `>>`
  target that writes the file, any other word naming the same file — so a message file
  kept under `temp/<feature>/planning/` is not itself a leak. Two spellings name the same
  file when they resolve to one path (`> ./m.txt` and `-F m.txt`), in any case on Windows.
  The path's text inside another word (`printf 'Generated with Claude' > with`), a heredoc
  body or a `-m` value stays in. A command that does not tokenise is read roughly: every
  `-F` path of each `git commit` in it is read, and only those `-F` values and the `>` or
  `>>` targets naming the same files are left out.
- A relative `-F` path resolves against the event's `cwd`, else `CLAUDE_PROJECT_DIR`, else
  the hook's own working directory, so a commit run from a subdirectory reads the file it
  names there. A `cd`, `chdir` or `pushd` earlier in the command, or PowerShell's
  `Set-Location` (`sl`, `cd`) or `Push-Location`, moves that base for the commands after
  it, except inside `( )` or before a `|`, where it runs in a subshell
  (`cd sub && git commit -F ../msg.txt` reads `msg.txt`), and git's own `-C` options move
  it again, each relative to the one before (`git -C sub commit -F m.txt` reads
  `sub/m.txt`, observed on git 2.47.0.windows.1). A `cd` that runs only on a condition —
  after `&&`, `||`, `then`, `else`, `elif` or `do` — may leave the base where it was, so the
  commands after it are judged in both directories, up to three such `cd`s; one chained to
  the commit by `&&` alone runs before it (`true && cd sub && git commit -F m.txt` reads
  only `sub/m.txt`). When the target cannot be known
  without running the command — no operand, `-`, `~`, a variable, a glob, `popd` — a
  relative `-F` path names an unknown file: it counts as unreadable and stays in the
  whole-command scan. A command that does not tokenise and contains such a command is
  treated the same way. On
  Windows a Git Bash drive path (`/c/…`) is read as `C:/…`, and any other POSIX-absolute
  path counts as unreadable.
- A `-F` file the hook cannot read is named in the decision: in the reason when the
  command is denied, and in a stderr line when it passes, both saying its content was not
  judged.

`git commit-tree` is denied outright, since a plumbing commit bypasses both the
repository's own hooks and these checks.

The user pushes and merges, so these are denied too, with a message telling Claude to hand
the step back:

- every `git push`, `send-pack` and `http-push`;
- a `git merge` other than a bare `git merge --abort`;
- a `git pull` without `--rebase` or `-r`, which merges (`pull.rebase` config is not read);
- `git subtree push|pull|merge|add`, `git svn dcommit|set-tree|commit-diff` and
  `git p4 submit`;
- a git subcommand given as an expansion (`git $X push`, `git "$@"`), which may be any of
  them — at the cost of denying a harmless one such as `git $X status`; a PowerShell
  `Start-Process git` whose argument list is held in a variable or a group
  (`-ArgumentList $a`, `Start-Process git $a`, `-ArgumentList @('status')`) is that case
  too, and is denied whatever the list holds.

`git fetch`, `git rebase`, `git pull --rebase`, `git merge-base` and the other `merge-*`
subcommands pass.

The matching is deliberately strict, and a false alarm is the price:

- `git pull -qr` (a bundled `-r`), `git pull --reb` (too short to read as a rebase) and
  `git merge --abo` (only a bare `--abort` passes) are denied.
- `git push -h` and `git push --help` are denied; `git help push` passes.
- A command that does not tokenise gets a plain-text scan, so `echo don't git push` is
  denied.
- A command outside the list that never runs its arguments has its arguments examined: in
  `ls git merge`, the `git merge` counts.

The command is read the way a shell reads it, so quoting, a leading assignment, a wrapper
(`sudo`, `xargs`, `timeout`, …), an `env -S` string, a global option that takes a value
(`-C <path>`, `-c <k=v>`, `--git-dir`, `--config-env`, …), a `bash -c` string, a heredoc,
here-string or pipe into a shell, and a `$(…)`, backtick or `<(…)` substitution, two levels
deep, do not hide the subcommand. A script piped into a shell is both read in that shell's
language, as what the commands before it in the pipeline print and the heredocs fed to
them (`echo "& {git push}" | pwsh -Command -`, `echo git pu^sh | cmd`), and scanned as
plain text across the whole command. A message that merely names one, or a command that never
runs its arguments (`echo`, `grep`, …), is not a call to it.

The Windows spellings are the same call. A command word is compared by its basename at `/`
or `\`, without a trailing `.exe`, `.cmd` or `.bat`, in any case, so `git.exe push`,
`GIT.EXE push`, `/c/Program\ Files/Git/cmd/git.exe push` and
`C:\Progra~1\Git\cmd\git push` are judged as `git push`; an unquoted word that starts with
a drive path keeps its backslashes. The shells followed are `sh`, `bash`, `zsh`, `dash`,
`ksh`, `pwsh`, `powershell` and `cmd`: the script of `bash.exe -c`, of `pwsh` or
`powershell -Command` (`-c`, the script glued on with a colon or not:
`pwsh -Command:"git push"`), the base64 UTF-16LE script of `-EncodedCommand` (`-e`,
`-ec`) decoded, their words from the first one that is not an option
(`powershell git push`), and of `cmd /c` or `/k` (`//c` as Git Bash spells it, other
switches run together before it as in `cmd /d/c`), the command glued to the switch or not
(`cmd /cgit push`), is judged like a `bash -c` string, read with the same tokeniser in the
language of the shell that runs it, whichever tool started that shell: a `pwsh` or
`powershell` script as a `PowerShell` tool command is read (below), so
`pwsh -c '& {git push}'` is denied, and a `cmd` script with its `^` escapes resolved
(`cmd /c "git pu^sh"`).
`env` is recognised in any spelling too (`env.exe -S "git push"`).

A command from the `PowerShell` tool is judged the same way, with the same tokeniser and
its backslashes read literally, as PowerShell does. PowerShell's call operator `&`
separates like a POSIX `&`, so the word after it is the command name: `& git push`,
`& 'C:\Program Files\Git\cmd\git.exe' push` and `& "C:\p\git.exe" merge main` are denied
like `git push` and `git merge main`, and so are `git.exe push` and `cmd /c git push`. A
backtick escape is rewritten into the tokeniser's own escape for the character it stands
for (`` `n `` a newline inside double quotes), so `git pu`sh` is `git push`, and a
`<#…#>` block comment is dropped. An assignment or a script block glued to the command
does not hide it: `$r=git push origin main`, `& {git push}` and `if ($true) {git push}`
are denied. A `Start-Process` (`saps`) is judged as the command its
`-FilePath` and `-ArgumentList` name, the list split at commas and blanks, so
`Start-Process git -ArgumentList 'push origin main'` is denied. A command that does not
tokenise gets the plain-text scan, its escapes resolved; that scan reads `git` and
`git.exe` in any case, a path ending in either included.

Some forms stay out of reach, and the file's header lists every one: a git alias, a quoted
`eval` or `Invoke-Expression` (`iex`) string, deeper nesting, a git command name produced by an expansion (`$g`,
`$(command -v git)`), a command another interpreter or task runner runs (`python3 -c`,
`node -e`, `make`, `npm run`), a git subcommand that runs another command
(`git submodule foreach`, `git rebase --exec`), a host CLI (`gh pr merge`).

## What no hook covers

Two coverage holes no matcher can close:

- An `@file` reference in a prompt inserts file contents with no tool call at all. Close it
  with a `Read(...)` deny rule in project settings.
- `block-secrets` matches file tools, `Bash` and `PowerShell`, so **no MCP tool is covered
  by it**.

The third one matters as soon as a browser MCP is attached. A file input reached through
`upload_file` (`browser_file_upload` on Playwright) sends a local file to a page, and from
there to the network, with no hook firing anywhere on the path. `verifying-ui` therefore
grants the tools that look at a page and deliberately withholds the upload and
`evaluate_script` tools, so both still prompt — the same shape as `describing-changes`
withholding `git commit`.

There is no SessionStart hook: [ADR 0003](adr/0003-facts-read-at-moment-of-use.md).
