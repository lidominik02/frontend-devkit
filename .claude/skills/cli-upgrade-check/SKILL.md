---
name: cli-upgrade-check
description: >-
  Revalidate this marketplace against a newer Claude Code release and move the
  pinned CLAUDE_CODE_VERSION in the workflow. Use when a new Claude Code version
  ships, when a validator finding appears that no commit explains, when a
  frontmatter field may have been added or removed upstream, or when the comments
  recording which version a behaviour was verified against have fallen behind the
  pin. Diffs the findings between the old and new version before changing the pin,
  and updates the verified-against comments in the same pass.
disable-model-invocation: true
argument-hint: "[target-version]"
allowed-tools: Read, Grep, Glob, Edit, Bash(node scripts/validate.mjs:*), Bash(claude --version), Bash(claude plugin validate:*), Bash(npm view *), Bash(git log *), Bash(git diff *)
---

# Check this marketplace against a new CLI version

`.github/workflows/validate.yml` pins `CLAUDE_CODE_VERSION` deliberately: validator
behaviour moves between patch releases, flags appear and warnings become errors, so
an unpinned global install turns an unrelated upstream change into a red build on a
commit that touched nothing.

The cost of that pin is that it goes stale silently, and the comments recording
*which version a behaviour was verified against* drift away from it independently.
Check both.

## What is actually load-bearing

Three things in this repo depend on CLI behaviour that is not contractual:

1. **The expected-findings allowance.** CI runs `claude plugin validate --strict`
   and allows exactly one finding — the missing `version`, omitted deliberately so
   installs track the commit SHA. If a new version reworded that message, the grep
   stops matching and every target reports a spurious failure. If it added a new
   finding, the build goes red on a commit that changed nothing.

2. **The claim that `--strict` does not read component frontmatter.** This is why
   `scripts/validate.mjs` owns the frontmatter allowlist at all. If a release starts
   validating frontmatter, part of that script becomes redundant — and more
   importantly, the comments in two files asserting it does not are now false.

3. **The frontmatter field allowlists** in `scripts/validate.mjs`. A field added
   upstream is reported by this repo as an unknown field that "will be ignored at
   load time", which is now wrong and blocks a legitimate edit. A field removed
   upstream is silently accepted and does nothing.

## Method

1. **Establish both versions.** `claude --version` for what is installed, the `env`
   block for what is pinned. Name the gap before doing anything — they are often
   already different, and that difference may be the whole finding.

2. **Run the strict validation at both versions** and diff the output, not the exit
   code. What matters is whether the finding text still matches the grep in CI, and
   whether any new finding appeared. Record the actual strings.

3. **Probe the frontmatter claim directly.** Add a misspelled field to a scratch
   copy of a `SKILL.md` — never to a real one — run `claude plugin validate --strict`
   against it, and observe. Do not infer this from release notes; the comments in
   this repo assert an observed behaviour and must be replaced by another observed
   behaviour, not by a reading of a changelog.

4. **Reconcile the allowlists.** Compare `KNOWN_SKILL` and `KNOWN_AGENT` in
   `scripts/validate.mjs` against the fields the new version documents. Report
   additions and removals separately: an addition blocks legitimate work, a removal
   silently accepts dead config.

5. **Move the pin, and the comments with it.** Grep for every version number in
   comments — several record "verified against" and are the thing most likely to be
   left behind. They must name the version you just observed, not the one you meant
   to test.

## Before you finish

- `node scripts/validate.mjs` and `bash scripts/test-hooks.sh` both clean.
- Say which claims you **observed** and which you only read. A comment asserting a
  behaviour was verified is worth nothing if it was not.
- If the new version changes nothing, say so and still update the verified-against
  comments. "Checked and unchanged at 2.1.x" is the useful record; leaving the old
  number means the next person repeats the whole exercise.
