---
name: try-unreleased
description: >-
  Run the working tree's unreleased plugins through a scripted, non-interactive Claude
  Code session in a scratch repository, answering its forms from a scenario file, and
  report each expectation as met, not met or unverifiable.
disable-model-invocation: true
argument-hint: "[scenario name | for this change]"
allowed-tools: Read, Write, Glob, AskUserQuestion, Bash(node .claude/skills/try-unreleased/scripts/driver.mjs *), PowerShell(node .claude/skills/try-unreleased/scripts/driver.mjs *), Bash(node --version), PowerShell(node --version), Bash(git status *), PowerShell(git status *), Bash(git diff *), PowerShell(git diff *), Bash(git log *), PowerShell(git log *), Bash(git describe *), PowerShell(git describe *)
---

# Try the unreleased plugins

A session installs `main`, so a change on `dev` is never exercised by a real lifecycle run
before it ships. This skill runs one: a `claude -p` session in a fresh scratch repository
under the OS temp directory, with this working tree's packs loaded through `--plugin-dir`
and the installed devkit kept out, its forms answered from a scenario, and its outcome
checked against the scenario's expectations.

The driver is `node .claude/skills/try-unreleased/scripts/driver.mjs`. The scenario format
is documented at the top of `.claude/skills/try-unreleased/scripts/scenario.mjs`; the
scenarios kept for re-running before every release are in
`.claude/skills/try-unreleased/scenarios/`.

## 1. Choose the scenario

- **A name** (`$ARGUMENTS`): `scenarios/<name>.md`. When no such file exists, or no argument
  was given, list the scenario names with a one-line summary of each, read from the text
  under its `#` heading, and ask which to run, or whether to write one for the current
  change.
- **For this change**: read the change (`git status`, `git diff`, `git log` since the
  latest `v*` tag) and write a scenario that exercises it into the session's scratchpad
  directory, or the OS temp directory when there is none, never into the repository yet. Its
  expectations are observable facts the change should cause: a file written, a skill or
  tool called, a hook blocking, a form asked. A scenario with an expectation the driver
  cannot check from the stream or the scratch repository reports it unverifiable, so prefer
  one it can. When it expects `skill-called`, its prompt names the skill in words ("Use the
  core:<skill> skill to …"): a slash command on the first line of a `-p` prompt is expanded
  by the CLI itself (observed on 2.1.278), with no Skill tool call to see. An answer applies only to a question that offers its
  label, so script the label as the form words it.

A scenario that does not parse is a usage error (exit 2) naming the line; fix it before
showing it.

## 2. Show it and ask

Show, before anything runs:

- the scenario's prompt, its fixture files by path, its scripted answers and its
  expectations;
- the packs it loads (dependencies are added: a framework pack brings `core`);
- the model (default `sonnet`) and the cost ceiling (default 2 USD, `--max-budget-usd`),
  with any override from the scenario or the user;
- that the run is billed to the user's Claude subscription quota, and that it may take up
  to the timeout (default 1800 s).

Then ask with one AskUserQuestion form: Run it (recommended), Change something, Cancel.
Nothing runs without that answer. A run already approved in this session does not approve
the next one.

## 3. Run the driver

```
node .claude/skills/try-unreleased/scripts/driver.mjs <scenario.md> --json [--model <m>] [--budget <usd>] [--timeout <s>]
```

Run it with the Bash tool's `run_in_background`, since a lifecycle run outlasts the
foreground timeout, and wait for its completion notice; say what started and its ceiling
first. Never pipe its output: the exit code is part of the result.

| Exit | Meaning |
| --- | --- |
| 0 | The session completed and every expectation was met |
| 1 | An expectation was not met or unverifiable, or the run was invalid, interrupted or never started |
| 2 | Usage: a bad argument, an unreadable or unparsable scenario, an unknown pack |

What the driver does, so its report reads correctly:

- It starts with an `initialize` control request, then the prompt; on 2.1.283 the CLI
  answers it with a success `control_response`. A CLI that refuses the request, or exits
  with no answer, no init event and no result, makes the run `error` with a `NOT RUN` reason
  naming the protocol: the protocol is undocumented and may have changed. A session that ran
  without acknowledging the request is judged as usual, and `notes` says so.
- A form arrives as a `can_use_tool` request (observed on 2.1.283), and is answered from the
  scenario's Answers, matched on the question text, header or an option label, when the
  question offers the scripted label. A question the scenario does not answer gets its
  first, recommended option and is listed under `unscriptedQuestions`, with `notOffered`
  when a scripted label matched but was not on offer.
- Other permission prompts are assumed to arrive the same way. Write, Edit, MultiEdit and
  NotebookEdit are allowed only inside the scratch repository, every symlink resolved;
  others are denied and listed under `deniedRequests`. Every other tool is allowed.
- What never prompts is out of the driver's reach: Bash cannot be confined to a path, and a
  write a skill's `allowed-tools` or the fixture's settings pre-approve is never asked
  about. After the run, each write tool call in the stream that targeted a path outside the
  scratch repository without being asked about is listed under `unconfirmedWrites`.
- It checks the init event: each loaded pack must report `<pack>@inline`, and no plugin may
  come from `@frontend-devkit`. Otherwise the run is `invalid` and stopped at once, because
  it would have measured the installed copy.
- A result other than `success` — the cost ceiling among them — and the timeout make the
  run `interrupted`; its expectations are then checked anyway but reported apart, under
  `observedBeforeInterruption`, never as results. A missing `claude`, or on Windows a
  `claude.cmd` shim that only a shell can start, makes it `error` with a `NOT RUN` reason.

## 4. Report in the chat

From the JSON, with no report file:

- **Status**, and its reason when it is not `completed`. Only `completed` with every
  expectation met is a pass. An `invalid`, `interrupted` or `error` run is never reported as
  a pass, whatever its expectations say, and an `unverifiable` expectation is not met.
- **Expectations**, one line each: met, not met or unverifiable, with the driver's detail.
  For an `interrupted` run, `observedBeforeInterruption` instead, titled as observations of
  an unfinished run, not results.
- **Questions outside the scenario**, each with the option picked for it, and the scripted
  label that was not offered where there was one.
- **Denied requests** and **unconfirmed writes**, each with its tool and target. An
  unconfirmed write left the scratch repository: name it first, before the expectations.
- **Notes**, each verbatim, when there are any.
- **Versions and cost**: `Claude Code <cliVersion>`, `Node <node>`, the OS build `<os>`, the
  model, the ceiling and `costUsd`.
- **The run directory** (`runDir`), which stays until the user deletes it: the scratch
  repository in `repo/`, the stream log `stream.jsonl`, the session's `stderr.log`, and the
  transcript's expected path (`transcript`).

When an expectation is not met, read `stream.jsonl` and the scratch repository for the
cause before suggesting one, and say which of the three it is: the plugins behaved wrongly,
the scenario expected the wrong thing, or the CLI protocol changed — then `/cli-upgrade-check`
re-observes it.

## 5. Keep an ad hoc scenario

After a run of a scenario written for this change, ask with one AskUserQuestion form
whether to keep it as `scenarios/<name>.md`, for re-running before every release: Keep it
(recommended when it ran `completed`), Discard it.

## What this must not do

- Run the session in this repository, or point `--tree` at anything but a devkit working
  tree. The scratch repository is the only place a run is allowed to write.
- Run without the user's answer to the form in step 2.
- Report a run as passing unless it is `completed` with every expectation met.
- Delete the run directory, or write a report file into the repository.
- Edit a scenario after a run so that it passes, without saying which expectation changed
  and why.
- Put a client name, a secret or data from another project into a scenario or its fixture.
