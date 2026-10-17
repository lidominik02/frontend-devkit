---
name: executing-plans
description: >-
  Implements an approved PLAN.md task by task, in subagent-per-task or inline mode, and
  fixes the findings of its review. Use when the user says "implement the plan", "execute
  task X", "start implementing" or "fix the findings". For "write the plan", "break it
  into tasks" or "resume", use planning-features; for "review this", reviewing-changes.
argument-hint: "[subagent|inline|fix-findings] [feature] [task]"
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs *) Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs" *) Bash(git check-ignore *) Bash(git cat-file -e *) Bash(git rev-parse *) Bash(npm run *) Bash(pnpm run *) Bash(yarn run *) Bash(bun run *) Read Grep Glob Agent Skill AskUserQuestion SendMessage
---

You carry out an approved plan, one task at a time. In subagent mode `core:implementer`
workers write the code and a `core:reviewer` reviews each task; in inline mode this session
writes it. In both, the plan, the gates and STATUS.md decide when a task is done. Every file
you write follows `../planning-features/references/artifacts.md`. Read
`../planning-features/references/project.md` first: the package manager, the framework
packs, the gates and the base branch come from there.

In the lifecycle this runs after `planning-features`, which takes the user's approval and
the mode. When every task is done this skill calls `reviewing-changes` for the whole
feature, unless the rules hold the review. Once the user has read the code and the report,
`fix-findings` fixes what the user wants fixed.

## 1. Pre-flight

Once per run. `fix-findings` needs only steps 1, 2, 3 and, inline, 6.

1. **Feature.** The caller or the user names it; with several feature folders (a folder
   under `temp/` holding STATUS.md) and none named, ask with one form. Every `temp/` path is under the repository root
   `git rev-parse --show-toplevel` prints, written there and handed on as an absolute path.
2. **Read the state.** STATUS.md and PLAN.md whole. A restarted run continues at the first
   task not done. From DECISIONS.md read only the `OQ<n>` lines the tasks' `Blocked by` name
   (grep): an OQ without `answered: D<n>` blocks its task this run, and so does every task
   whose Blocked by names a blocked task — each gets its row `blocked (OQ<n>)` and a Log
   line, and the run continues with the rest. A task the user names starts the run once
   nothing blocks it; otherwise name what blocks it and ask.
3. **Mode.** A mode named in the arguments is the user's choice. With none there and none
   recorded (or `not chosen`), ask: one form, the recommended mode first, with the reason taken from the
   plan — how tightly its tasks couple, how many there are, what a shipped mistake would
   cost. Record it as STATUS.md's `Mode:`.
4. **Baseline.** Run the fast gates once for each workspace the plan's Files touch, as
   `project.md` describes, and write each gate line to STATUS.md's `Verified` as `baseline:`, so a failure that predates the run is never blamed on
   a task. Then `node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs" take` and write the tree
   it prints to `Verified` as `pre-execution tree:`, the base the final review diffs from.
   A restarted run keeps the recorded tree once `git cat-file -e <tree>^{tree}` confirms it.
5. **Untracked `temp/`.** When `git check-ignore -q temp/` exits 1, say once that the briefs
   and diffs land in an untracked `temp/`.
6. **Inline only: framework rules.** Call the Skill tool with each pack `project.md` finds,
   in its order. A later pack wins every conflict.

A task that names a rebase or another history operation goes to `core:syncing-branches`
before anything else runs; this skill never runs one.

## 2. Subagent per task

For each task neither done nor blocked, in plan order:

1. **Base.** `snapshot.mjs take` prints the task's base tree. STATUS.md: the Stage
   `execute (task N/M, subagent per task) — owner: executing-plans`, and the row
   `in progress`.
2. **Brief.** Write `temp/<feature>/tasks/<NN>-<task-slug>-brief.md`, `<NN>` the task's
   position in the plan, from the template in `references/dispatch.md`, every field filled.
3. **Dispatch** `core:implementer` by that name, in the foreground, with the prompt in
   `references/dispatch.md`, on the model and effort its line names for the task's Tier.
4. **Status.** Act on the implementer's returned status:

   | Status | Action |
   | --- | --- |
   | `DONE` | Diff the task, then the gates and the task review |
   | `DONE_WITH_CONCERNS` | Weigh each concern. One that changes the scope or the product is the user's: stop and ask. Otherwise as `DONE`, the concerns in the pause brief |
   | `NEEDS_CONTEXT` | Answer from PLAN.md or the DECISIONS.md entry by id, citing the line, and send it to the same implementer. When neither answers: one form to the user, the answer a DECISIONS.md entry, then continue the implementer |
   | `BLOCKED` | Stop, report what blocks it, and ask |

5. **Diff.**
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs" diff <task base> --out temp/<feature>/tasks/<NN>-<task-slug>.diff`.
   A name already taken — a restarted run, a retried round — gets the next free `-2`, `-3`
   before `.diff`, the fix-round diffs of step 8 included; the path the script prints is the
   one every dispatch carries. Compare the stat lines with the brief's Files: a changed file outside them that the
   implementer's message does not name with a reason is raised to the reviewer and to the
   user — never silently accepted.
6. **Gates.** Run the fast gates of each workspace the task touched, as `project.md`
   describes, and judge each failure against that workspace's baseline in `Verified`:
   - **the task's** — the gate passed in the baseline, or the baseline lacks this error:
     fixed, in an untouched file too;
   - **pre-existing** — the baseline holds the same error: reported, not fixed;
   - **undecided** — the gate has no comparable baseline result (NOT RUN there, or released
     after it): reported with its location; the user rules on it, it never enters a fix
     round on its own, and it stops the run after this task even without pausing.
7. **Task review.** Dispatch one `core:reviewer`, foreground, `Role: two-axis`, in the
   dispatch shape and on the model and effort of
   `../reviewing-changes/references/formats.md`, as `references/dispatch.md`
   fills it: the diff from step 5, the intent sources, the `Packs:` line and the step 6
   gate block.
8. **Fix rounds**, for critical and important findings and the task's own gate failures: at
   most three. Rounds 1 and 2 go to the same implementer with SendMessage; round 3 to a fresh
   `core:implementer` with the brief and the findings, on the model `references/dispatch.md`
   names for round 3. After every round: a new diff from the
   tree the previous review saw, the gates, and one `core:reviewer` with `Role: re-review`.
   A finding that contradicts a recorded decision goes to no implementer: ask Keep D<n>
   (recommended) or Change it. A critical or important finding still open after round 3
   stops the run for the user. A minor finding stays in the review's verdict line.
9. **Close the task.** The row is `done` only when every step ran and every gate in its Done
   when passed; otherwise it stays `in progress` and the Log line names what was skipped.
   The row gets its gates and the review verdict; one Log line records the task.
10. **Pause** after every task, unless the user chose "Continue without pausing" in this run:
    a short brief — what was built, the review result, the rounds, each undecided gate
    failure, anything the user must weigh — then one form: Continue (recommended), Continue
    without pausing, Stop. The next task's base is taken at its step 1, after the answer, so
    an edit the user makes during the pause is not counted as that task's. Stop leaves
    STATUS.md with the next task as the Next action and the kickoff prompt rewritten to match.

## 3. Inline

For each task neither done nor blocked, in plan order:

1. **Open** the task by reading it in PLAN.md, not from memory, quoting its heading as read.
   STATUS.md: the Stage `execute (task N/M, inline)` and the row `in progress`.
2. **Implement** with Edit and Write — a scripted shell edit only for conflict hunks or a
   mechanical rename — then format the touched files as `## Formatter` in `project.md` says, and
   report its line for each touched workspace.
3. **Gates** of each workspace the task touched, as `project.md` describes, each failure
   judged as section 2 step 6 says. With
   no pause between inline tasks, an undecided failure stops the run before the task closes.
4. **Close** in one write: the row, its gates, a Log line, and the Next action moved on.
   Continue with the next task without pausing.

**Deviations.** A change to what a plan step or a DECISIONS.md entry says is asked with one
form: Keep it as planned (recommended), or Change it, which writes a DECISIONS.md entry
(`supersedes D<n>` when it replaces one). Only a reversible plan defect — a wrong path, a
mismatched interface name, an order that cannot work — is ruled on without a form, with its
own DECISIONS.md entry. Stop and ask on an ambiguity PLAN.md and DECISIONS.md do not answer,
on a product question, on a gate failure the task caused and cannot fix, and on a
structural decision the task did not plan — a new module, a new shared abstraction.

## 4. End of the run

The run's work stays uncommitted until the user commits it. However the run ends, run
`snapshot.mjs take` once more and write the tree to `Verified` as `end-of-run tree:`.

- **Every task done:** call the Skill tool with "core:reviewing-changes", naming the
  feature and the `pre-execution tree:` as the base. It writes the report and the Stage, and
  hands a review with nothing open to finishing-features. Then stop.
- **The rules hold the review until the user asks:** do not call it. Stage
  `user reads code + findings`, "no review ran" in a Log line, and the base named in the
  Next action. Then stop.
- **Only blocked tasks remain:** name each with the question that blocks it, and ask with one
  form: Review what is built now, or Wait. Recommend Review when no blocked task touches a
  file a built one changed. Any other open task stops the run: name it and what it lacks.

## 5. Mode: `fix-findings`

The user has read the code and the review report and says what to do with each finding.

1. The open findings are as `../planning-features/references/artifacts.md` defines them. Ask about each one the user has not decided, in forms
   of at most four findings: Fix, Defer, Keep as designed — Fix recommended for a
   CONFIRMED finding, Defer for a PLAUSIBLE one, Keep for one that conflicts with a
   decision.
2. Defer and Keep each write a `Closed findings` line. A finding whose cause is not the
   frontend's closes as `not ours (<owner>)`; the user calls
   `investigating-bugs` if they want it diagnosed. An answer that changes a decision is a new
   DECISIONS.md entry with `supersedes D<n>`.
3. Verify each finding to fix: open the cited `file:line` and confirm the failure scenario
   holds. One that does not is reported back with the evidence, not fixed.
4. STATUS.md: Stage `fix findings — owner: executing-plans`. Fix in the recorded mode —
   subagent: one fresh `core:implementer` with the fix brief from `references/dispatch.md`,
   on the model and effort its line names for the fix brief, its status handled as in
   section 2 step 4; inline: this session fixes.
5. When something was fixed, call the Skill tool with "core:reviewing-changes" in
   `re-review` mode for the feature. When nothing is left open and every task is done or
   blocked, call the Skill tool with "core:finishing-features"; otherwise name what stays
   open, and stop.

## What this must NOT do

- Commit or push, or stage or touch the index or refs — plumbing included. `snapshot.mjs`
  builds its tree in a private temporary index and is the exception.
- Edit code on the main thread in subagent mode.
- Run heavier checks the user did not release (`../planning-features/references/project.md`, `## Held checks`), or Storybook or a browser
  before the user releases them, or a command that writes as a gate (`## Gates` there).
- Decide a product question, or rule on anything but a reversible plan defect.
- Mark a task done with a step skipped or a gate unrun.
- Run two implementers at once.
- Carry a fact about an individual repository. A repo's conventions live in its own files,
  read at the moment of use.
