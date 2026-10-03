# Reading session transcripts

How a transcript is laid out, the six rules that keep counts and attributions honest,
and how to tell which devkit version a session ran. Rules 1–3 and rule 4's fallback
restate those of the `session-report` plugin's `analyze-sessions.mjs` (Anthropic,
Apache-2.0) in this skill's words; rule 4's `origin.kind` test is not in that script and
comes from the observed transcripts. The script is not called, because its install path carries a hash that
changes on every update. The field names below were observed in local transcripts, the
newest written by Claude Code 2.1.288 (its `version` field); a field that is absent in an older transcript is a gap to state, not a
value to guess.

## Layout

Transcripts live under `~/.claude/projects/<encoded project path>/`. The directory name
is the project's absolute path with separators replaced — it names the project, so it
stays in the case file and never reaches the report.

| Path | What it holds |
| --- | --- |
| `<sessionId>.jsonl` | The main session, one JSON entry per line |
| `<sessionId>/subagents/agent-<id>.jsonl` | One dispatched agent's transcript |
| `<sessionId>/subagents/agent-<id>.meta.json` | That agent's `agentType`, `description`, `toolUseId`, `spawnDepth`, `model` |
| `<sessionId>/subagents/workflows/wf_<id>/` | A workflow's agents, same shape |
| `<sessionId>/tool-results/<id>.txt` | A tool result too large to keep inline |

Entry `type` values that matter: `user`, `assistant`, `attachment`, `system` (subtypes
include `compact_boundary` and `stop_hook_summary`), `cost-state`, `ai-title`,
`last-prompt`, `bridge-session`. Every entry has a 1-based line number in its file;
that line number is the citation.

Where to look for the timeline:

- A skill run: an `assistant` entry with a `tool_use` block named `Skill` (its
  `input.skill`), or a `user` entry whose text carries a `<command-name>` tag for a
  typed slash command.
- A dispatched agent: a `tool_use` block named `Agent` — its `id` is the `toolUseId`
  in the subagent's `.meta.json`.
- A context compaction: a `system` entry with subtype `compact_boundary`.

## The six rules

1. **Dedupe by `requestId`, keeping the highest output tokens.** One API response is
   written as several `assistant` entries, one per content block, sharing a
   `requestId`; only the last carries the final `message.usage.output_tokens`. Count
   each `requestId` once, with the entry whose output tokens are highest. Summing every
   entry overcounts several times over.

2. **Skip resume replays by `uuid`.** A resumed session can rewrite earlier entries
   into a new file. Walk the files in chronological order and keep a set of seen
   `uuid`s across all of them; an entry whose `uuid` was already seen is a replay and is
   skipped.

3. **Read `subagents/*.jsonl` with their `.meta.json`.** An agent's work is in its own
   file, not in the main transcript. Attribute it by the sibling `.meta.json`; link it
   to the dispatching call through `toolUseId`. A file with no `.meta.json` is
   reported as an unattributed agent, not dropped.

4. **Tell a human message apart by `origin.kind`.** A `user` entry with
   `origin.kind: "human"` is the person typing; `task-notification` and `peer` are not.
   Tool results, `isMeta` and `isCompactSummary` entries are never human. In a
   transcript that has no `origin` field, fall back to: not `isSidechain`, `isMeta` or
   `isCompactSummary`, content a plain string or a leading text block, not a
   `tool_result`, and not starting with `<task-notification`, `<scheduled-wakeup`,
   `<background-task` or `[Request interrupted`.

5. **Skip `bridge-session` entries.** They hold account and organisation identifiers
   and nothing a diagnosis needs. Never copy one into the case file. The same holds for
   any attachment that carries credentials or an organisation.

6. **Take cost from `cost-state`.** A `cost-state` entry carries `totalCostUSD`,
   `modelUsage` per model, `totalAPIDuration`, `totalToolDuration`, `totalDuration`,
   `totalLinesAdded`, `totalLinesRemoved` and `hasUnknownModelCost`. Read every
   `cost-state` in the file: if `totalCostUSD` only grows, the last one is the
   session's total; otherwise say what the sequence shows instead of choosing one.
   Whether a subagent's spend is included is stated only where the transcript shows
   it. When `hasUnknownModelCost` is true, the dollar figure is a lower bound. Token
   counts per phase come from the deduped `usage` of rule 1, never from dollars.

## The devkit version a session ran

Read it from the session, not from today's install:

- **The plugin path the session loaded.** Grep the session's files for the devkit's
  plugin directory — it appears in the base directory a loaded skill reports, in hook
  commands and in permission entries.
  - Under `~/.claude/plugins/cache/frontend-devkit/<plugin>/<version>/` the last path
    segment is the version: a semver once manifests carry one, a commit SHA prefix
    before that.
  - Under a git worktree or a `--plugin-dir` working tree, the version is the commit
    that tree had checked out at the session's time. Find it in that tree's
    `git reflog --date=iso` by the session's timestamps, and add whether the tree had
    uncommitted changes if anything records it; otherwise say the working-tree state
    is unknown.
- **`~/.claude/plugins/installed_plugins.json`.** Its entry for
  `core@frontend-devkit` (and `vue@`, `nuxt@`) gives `installPath`, `version`,
  `gitCommitSha` and `lastUpdated`. It describes the install now, so it confirms a
  session's version only when `lastUpdated` precedes the session and the path matches
  the one the session loaded.

The report states only the source type and the version segment. The matched line
stays in the case file: a hook command or permission entry can carry a project path.

When neither source shows it, the verdict names the version as unknown and says
which source was missing.
