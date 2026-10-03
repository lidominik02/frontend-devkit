---
name: cli-upgrade-check
description: >-
  Revalidate this marketplace's platform claims against the installed Claude Code
  release and record the version they were verified on. CI installs the latest release
  unpinned, so use this when CI turns red on a commit that changed nothing, when a new
  Claude Code version ships, when a validator finding appears that no commit explains,
  when a frontmatter field may have been added or removed upstream, or when the
  verified-on versions in comments and README.md have fallen behind the installed CLI.
  Diffs the strict findings against what CI allows, probes the frontmatter claim on a
  scratch copy, reconciles the field allowlists, and updates the verified-on notes in
  the same pass.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Edit, Bash(node scripts/validate.mjs:*), Bash(claude --version), Bash(claude plugin validate:*), Bash(npm view *), Bash(git log *), Bash(git diff *)
---

# Check this marketplace against the installed CLI

There is no version pin. `.github/workflows/validate.yml` installs the latest
`@anthropic-ai/claude-code` and prints `claude --version`, so the repo is always checked
against the latest release. The cost is that validator behaviour moves between releases —
flags appear, warnings become errors, messages get reworded — and CI can turn red on a
commit that changed nothing. That red build is the signal to run this skill: find the
upstream change, re-verify the claims that depend on it, and record the version.

The comments recording *which version a behaviour was verified against* drift
independently of any build, so check them even when CI is green.

## What is actually load-bearing

Three things in this repo depend on CLI behaviour that is not contractual:

1. **The clean strict exit.** CI runs `claude plugin validate --strict` and expects a
   clean exit: every manifest carries `version`, so no finding is allowed. A release
   that adds a new finding turns CI red on a commit that changed nothing.

2. **The claim that `--strict` does not read component frontmatter.** This is why
   `scripts/validate.mjs` owns the frontmatter allowlist at all. If a release starts
   validating frontmatter, part of that script becomes redundant — and more
   importantly, the comments asserting it does not are now false.

3. **The frontmatter field allowlists** in `scripts/validate.mjs`. A field added
   upstream is reported by this repo as an unknown field that "will be ignored at
   load time", which is now wrong and blocks a legitimate edit. A field removed
   upstream is silently accepted and does nothing.

## Method

1. **Establish the versions.** `claude --version` for what is installed,
   `npm view @anthropic-ai/claude-code version` for what CI installs now, the version a
   failing CI run printed, and the verified-on versions the repo records. Name the gaps
   before doing anything — the difference may be the whole finding.

2. **Diff the strict findings against what CI allows.** Run
   `claude plugin validate . --strict` and the same on every plugin directory
   `marketplace.json` lists, and read the output text as well as the exit code: the
   workflow's validate step allows no finding, so any `❯` line is new. Record the
   actual strings. If CI failed, the step printed the output; reproduce it locally
   before explaining it.

3. **Probe the frontmatter claim directly.** Add a misspelled field to a scratch
   copy of a `SKILL.md` — never to a real one — run `claude plugin validate --strict`
   against it, and observe. Do not infer this from release notes; the comments in
   this repo assert an observed behaviour and must be replaced by another observed
   behaviour, not by a reading of a changelog.

4. **Reconcile the allowlists.** Compare `KNOWN_SKILL` and `KNOWN_AGENT` in
   `scripts/validate.mjs` against the fields the installed version documents. Report
   additions and removals separately: an addition blocks legitimate work, a removal
   silently accepts dead config.

5. **Record the verified-on version.** Grep for every version number in comments and
   `README.md` — several record "verified against" and are the thing most likely to be
   left behind. Change a number only for a claim re-observed in this pass, and name the
   version just observed, not the one meant to be tested. Where the finding text
   changed, update the workflow's pattern and the comment above it together.

## Before you finish

- `node scripts/validate.mjs` and `bash scripts/test-hooks.sh` both clean.
- Explain a CI failure by its upstream cause: which release, which finding or field
  changed, and what in the repo changed in response.
- Say which claims you **observed** and which you only read. A comment asserting a
  behaviour was verified is worth nothing if it was not.
- If the new version changes nothing, say so and still update the verified-on
  notes for the claims re-checked. "Checked and unchanged at 2.1.x" is the useful
  record; leaving the old number means the next person repeats the whole exercise.
