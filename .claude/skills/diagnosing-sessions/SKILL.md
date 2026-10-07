---
name: diagnosing-sessions
description: >-
  Diagnose what went wrong, or what cost too much, in past Claude Code sessions
  from their transcripts, and whether the devkit was involved. Verifies the
  transcript paths, builds a case file in the session scratchpad, runs five
  parallel analysts — skill timeline with plan adherence, repeated work with
  stumbles, quality evidence, request conflicts, cost — and writes an anonymised,
  cited report with a devkit-involvement verdict naming the devkit version the
  session ran, ending with proposed entries for the ideas backlog.
disable-model-invocation: true
argument-hint: "<symptom> [session] [time window]"
allowed-tools: Read, Grep, Glob, Write, Edit, Agent, AskUserQuestion, Bash(node scripts/validate.mjs:*), PowerShell(node scripts/validate.mjs:*)
---

# Diagnose past sessions

The input is a symptom, optionally a session id and a time window. The output is
`temp/diagnoses/<slug>/REPORT.md` in this repository (gitignored) and, after the user
picks, new entries in `temp/ideas/IDEAS.md`. Nothing else is written outside the
session scratchpad.

## Anonymity, before any read

Everything found outside this repository is confidential. Hold this from the first
transcript read to the last line written, in chat as much as in files:

- No project, repository, client, product, entity or person name from a session
  reaches any output. Repositories are labelled **repo A**, **repo B**, … in the
  order they are first met; the label-to-path mapping lives only in the case file.
- Content is paraphrased, never quoted — the user's messages included.
- No transcript path is written outside the scratchpad: the path encodes the
  project's directory. Cite a session by its id and a line number only.
- A skill, agent, slash command or tool that is not the devkit's is named by its kind
  and repo label — "a repo A skill" — never by its own name.
- A file outside the devkit is described by its role — "the route config", "a test
  file" — never by its name or path.
- Version evidence is stated as its source type and version segment only — "plugin
  cache path, version segment 0.1.0" — never as the line it was read from.
- The slug and every file name are built from the paraphrased symptom, never from a
  name the user or a session supplied.
- No list of protected terms exists and none is asked for. Treat everything outside
  the devkit as protected; the devkit's own components, files and versions may be
  named.

## Flow

1. **Intake.** Restate the symptom in one paraphrased line, the session if given and
   the time window. Without a window or a session, ask for one; do not scan every
   transcript on the machine.

2. **Verify the transcript paths.** Follow `references/transcripts.md` for the layout:
   Glob the candidate `<sessionId>.jsonl` files under `~/.claude/projects/`, keep those
   whose entries fall in the window or match the given id, and confirm each exists and
   parses. Present the candidates by label, date and a paraphrased first request, and
   let the user confirm the set. **No matching transcript: say so and stop** — no case
   file, no report.

3. **Build the case file** at `<scratchpad>/diagnosis-<slug>/case.md` — the session
   scratchpad the system prompt names, or else a directory made under the system
   temp directory. It holds the symptom, the window, each session with its label,
   path, subagent files and their metadata, the devkit version it ran with the
   evidence for it, the absolute path of `references/transcripts.md`, and per-session
   extracts made under its rules. Raw extracts go only here.

4. **Run the analysts.** Dispatch the five analysts in `references/analysts.md` in
   parallel, in one message, each with the case file path, its dimension and the
   anonymity rule above. Four is allowed when the symptom makes one dimension
   empty; say which was dropped and why.

5. **Synthesise and write the report** to `temp/diagnoses/<slug>/REPORT.md` in the
   shape `references/analysts.md` gives. Before writing, check every finding against
   the anonymity rule and rewrite any that names or quotes something from outside
   the devkit.

6. **Propose ideas.** The report ends with proposed `I<n>` entries, numbered on from
   the highest id in `temp/ideas/IDEAS.md`. Ask the user which to write (a
   multi-select form). Append each picked entry in that file's entry shape, its
   `Source:` naming this report and the finding it came from.

7. **Delete the scratch extracts.** Remove `<scratchpad>/diagnosis-<slug>/` and say
   that it was removed. Do this at the end of every run that created it, including a
   run stopped after step 3.

## Verdict

The report's verdict is one line, then its evidence:

`Devkit involvement: <caused | contributed | not involved | cannot tell> — devkit <version>`

- **caused** — a devkit component's instruction or hook produced the symptom.
- **contributed** — a devkit component made it worse or failed to prevent what it
  claims to prevent.
- **not involved** — the symptom arises with no devkit component on the path.
- **cannot tell** — the transcripts do not show enough; name what would settle it.

The version is the one the session loaded, read as `references/transcripts.md`
describes, with its evidence given as a source type and version segment, never the
line it came from. When the session ran an unreleased
working tree, say so rather than naming the nearest release.

## Before you finish

- Every finding in the report cites `session <id>, line <n>`, and every citation was
  read, not inferred.
- No name, path or quote from outside the devkit is in the report, the ideas entries
  or the chat summary.
- The scratch directory is gone.
