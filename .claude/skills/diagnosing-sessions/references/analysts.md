# Analysts, synthesis and the report

Five analysts run in parallel, one dimension each, from the same case file. Each reads
the case file and the transcripts it lists, writes no file, and returns findings. The
synthesis merges them into the report.

## The dispatch

Dispatch each analyst with the Agent tool, all five in one message. Each prompt is the
shared preamble below, followed by its dimension block.

### Shared preamble

> You are diagnosing past Claude Code sessions for one dimension only. Read the case
> file at `<case file path>` first: it states the symptom, the time window, the
> sessions with their labels and transcript paths, the devkit version each ran, and
> the extracts already made. Read transcripts only through the paths it lists, under
> the rules in the transcripts reference it points to.
>
> Anonymity, holding for every word you return: everything outside the devkit
> repository is confidential. Name no project, repository, client, product, entity or
> person from a session; use the case file's labels (repo A, repo B). Paraphrase,
> never quote, the user's messages included. Write no transcript path. A skill,
> agent, slash command or tool that is not the devkit's is named by its kind and
> repo label ("a repo A skill"). A file outside the devkit is described by its role
> ("the route config"), never by its name or path. Version evidence is a source type
> and a version segment ("plugin cache path, version segment 0.1.0"), never the line
> itself. Devkit component names, files and versions may be named.
>
> Write no file and change nothing. Return at most eight findings, strongest first,
> each as:
>
> `- <one-line finding> — session <id>, line <n>[, line <m>] — <why it bears on the symptom>`
>
> Cite only lines you read. A finding without a line is not returned. End with one
> line, `Not seen:`, naming what the dimension looked for and did not find.
>
> Dimension: <dimension block>

### Dimension blocks

1. **Skill timeline and plan adherence.** Build the ordered list of skill runs, agent
   dispatches, typed slash commands and compactions, with line numbers. Compare it with
   what the devkit's skills prescribe at the version the session ran, and with the
   feature's plan or brief where the session followed one: steps skipped, reordered or
   run twice, a skill that should have triggered and did not, a stop the skill requires
   that did not happen.

2. **Repeated work and stumbles.** Find work done more than once — the same file read
   or edited repeatedly, the same command retried, an agent re-dispatched for the same
   task, a fix undone and redone — and the stumbles behind it: tool errors, permission
   denials, failed commands, a wrong path or assumption corrected later, a loop that
   ended only when the user intervened.

3. **Quality evidence.** What was verified and what was only claimed: gates and checks
   run and their observed results, a "passes" or "done" stated without a run behind
   it, review findings and how they were resolved, the user correcting an outcome,
   edits outside the stated scope.

4. **Request conflicts.** Where what the user asked and what happened diverge: a
   request dropped, narrowed or widened; a devkit rule, a project instruction or a
   hook overriding the user, or the user overriding one; two instructions that
   contradict each other and which one won; a question the session should have asked
   and decided instead.

5. **Cost.** From `cost-state` and the deduped token usage: the session's total and
   per-model spend, the share spent by subagents where the transcript shows it, the
   most expensive stretches by skill or phase, cache reads against fresh input, and
   spend on work the other dimensions mark as repeated or discarded. State whether the
   figure is a total or a lower bound.

Four analysts are allowed when the symptom leaves one dimension with nothing to look
at; the report names the dropped dimension and why.

## Synthesis

Run by the session that dispatched the analysts, not by another agent.

1. Re-read the cited line of every finding that the verdict or an idea will rest on.
   A finding whose line does not show what it claims is dropped and counted as dropped.
2. Merge findings that describe the same event from two dimensions; keep both
   citations.
3. Decide the verdict from the merged findings and the devkit version in the case
   file.
4. Check every line of the draft against the anonymity rule before writing it.

## The report

`temp/diagnoses/<slug>/REPORT.md`:

```markdown
# Diagnosis — <paraphrased symptom>

Date: <date> · Sessions: <n>, in repo A[, repo B] · Window: <window>
Devkit: <version per session, with its source type — e.g. plugin cache path, version segment 0.1.0>

## Symptom
<the symptom as the user put it, paraphrased; what was observed of it>

## Timeline
- <time> — <event> — session <id>, line <n>

## Findings
### Skill timeline and plan adherence
- <finding> — session <id>, line <n>
### Repeated work and stumbles
### Quality evidence
### Request conflicts
### Cost

## Verdict
Devkit involvement: <caused | contributed | not involved | cannot tell> — devkit <version>
<the findings it rests on, by citation; what would change it>

## Proposed ideas
- **I<n>** · <date> · <one-line idea>
  - Source: diagnosing-sessions, temp/diagnoses/<slug>/REPORT.md, <finding it came from>
  - Notes: <what is known, which devkit component it touches>
```

A dimension with no findings keeps its heading and says so, with the analyst's
`Not seen:` line. Dropped findings are counted under the verdict. Proposed ideas
follow the entry shape of `temp/ideas/IDEAS.md`; none is written there until the user
picks it.
