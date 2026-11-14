# 0019. `frontend` splits into one listed skill per framework

Status: Proposed 2026-11-14. Amends 0016.

## Context

[0016](0016-framework-rules-chosen-per-workspace.md) shipped one listed router skill,
`frontend-engineering`, as a trial, and named the evidence that ends it: the trial fails if
the per-framework trigger cases show the router not firing on Vue, Nuxt, React or Next.js
wording, or if the selected rules are not re-read after compaction.

On 0.9.6 (Claude Code 2.1.319, `claude-opus-5-5`), run from a working directory whose path
names neither the devkit nor "frontend", the trigger cases fired the router in five runs per
language arm as follows: Vue 3/5 in English and 5/5 in Hungarian, Nuxt 4/5 and 5/5, Next.js
3/5 and 5/5, React 0/5 and 0/5. In every React run the model answered without calling the
skill, although the listing named it. An earlier run of the same cases from a path containing
"frontend" fired 50 of 50; whether the path or run-to-run drift explains the gap was not
measured.

The compaction re-read case did not run: on two rigs most runs either never reached
compaction or were stopped by the CLI for autocompact thrashing, so it has no verdict either
way (NOT RUN, not a pass). Seven real sessions of one Next.js repository on 0.9.0–0.9.4, read
with `/diagnosing-sessions`, showed a correct selection on every invocation, but the selected
rules files often went unread, and in one session on 0.9.2 the main session edited frontend
code after compaction without re-reading them.

## Decision

- 0016's trial fails on its trigger condition: the router does not fire on React wording.
- Only the entry point changes: one listed skill per framework replaces the one listed
  router skill. Each skill checks its identity in its first line: it reads the workspace's
  `package.json`, and continues only if the selection table gives that workspace its
  framework's row.
- The rest of 0016 stands: selection once per workspace from its `package.json`, the
  router's selection table as the source of selection and the only place a base–delta pair
  is written, and the base and delta sets.
- The split is built by a later change, following a split plan. Until that change ships,
  `frontend-engineering` keeps shipping as 0016 describes, including its exception to
  [0007](0007-context-cost-tiers-and-listing-ceiling.md) and the name `core` calls.
- With the release that ships the split, this record becomes Accepted and 0016 becomes
  "Accepted, amended by 0019".

## Consequences

- The always-on listing grows by one description per framework, against the ceiling of
  [0007](0007-context-cost-tiers-and-listing-ceiling.md); `node scripts/validate.mjs
  --checks=budget` shows the current total. Raising the ceiling for the split is a deliberate
  decision, made with the change that builds it.
- Until the split ships, a React request that does not name the skill can go without the
  React rules. The lifecycle skills still call the router by name.
- The split changes the name or names `core` calls through the Skill tool
  ([0015](0015-one-frontend-plugin.md)) only if the change that builds it says so; if it
  does, that change amends 0015.
- The compaction re-read stays unmeasured until a rig reaches compaction reliably. The split
  does not settle it on its own.
- The real sessions' most frequent gap, rules files left unread after a correct selection,
  does not depend on how many skills are listed; the split is not expected to close it.
- A per-framework skill set that, measured as below, fires no better than the router reopens
  this record.

## Validation requirements

Before the release that ships the split:

- Each framework's trigger case (`trigger-vue`, `trigger-nuxt`, `trigger-nuxt-repo`,
  `trigger-next`, `trigger-react`) fires that framework's own skill in at least three runs of
  five, in every language arm, from a working directory whose path names neither the devkit
  nor "frontend", with the version, the CLI and the model recorded.
- The isolation cases (`isolation-vue-spa`, `isolation-nuxt`, `isolation-react`,
  `isolation-next`) read only the selected set's files, and both module-scope matched pairs
  still call the same code fine in the SPA and Critical under SSR.
- The `compaction-reread` case has a recorded verdict, pass or FAIL; NOT RUN does not count
  as either.
- `node scripts/validate.mjs`, including the `budget` check, and
  `node --test "scripts/test/*.test.mjs"` pass, and `claude plugin validate --strict` exits
  clean on the pinned and the local CLI, with the versions recorded.

## References

[0007](0007-context-cost-tiers-and-listing-ceiling.md),
[0015](0015-one-frontend-plugin.md),
[0016](0016-framework-rules-chosen-per-workspace.md),
[0017](0017-hard-gates-only-where-failure-does-harm.md),
[Authoring](../contributing/authoring.md#adding-a-framework).
