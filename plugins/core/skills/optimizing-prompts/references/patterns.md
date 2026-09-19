# Prompt patterns: templates, worked rewrites, and the padding to leave out

Read this at steps 3 to 5 of `SKILL.md`. The body has the rules; this file has the
shapes. Every template below is a starting point to **delete from** — a section the
prompt has no real content for is removed, never filled in to complete the set.

## The agentic template, filled in

```
<instructions>
Add a per-carrier delivery-estimate field to the shipment detail view.

1. Read app/services/rates.ts first — it already does the carrier lookup and
   caching this needs. Follow its error handling and its cache-key shape.
2. Add the estimate to the shipment serializer and the detail template.
3. Run the project's typecheck and unit tests. Both must pass before you
   report done.

Propose the approach before editing if the carrier lookup needs a new
network call; otherwise go ahead and implement.
</instructions>

<context>
app/services/rates.ts        the pattern to follow — lookup, cache, errors
app/serializers/shipment.ts  where the field is exposed
app/views/shipment/detail    where it renders

Carriers with no estimate available must render as "Not available",
not as an empty string. That decision was made last quarter; do not revisit it.
</context>

<constraints>
Do not change the public shape of the shipment API — other clients read it.
Do not add a new caching library; app/services/rates.ts already has one.
If the carrier API has no estimate endpoint, stop and say so rather than
inventing a heuristic.
Say so plainly if you are unsure whether a carrier is covered.
</constraints>
```

Note what is doing the work: a **real path** in the first instruction, a definition of
done that names the gates, a boundary on the public API, and an explicit stop condition.
No role preamble, and no `<examples>` — the output shape here is code, which is obvious.

## The general template, filled in

```
<instructions>
Write release notes for the changes listed in <context>.

Audience: customers on the self-serve plan, non-technical.
Format: one short paragraph of summary, then bullets grouped as
New / Improved / Fixed. Omit a group with nothing in it.
Length: under 200 words.
Tone: plain and factual. No superlatives, no "we're excited to".

Say so rather than guessing if a change's user-visible effect is unclear
from the description.
</instructions>

<context>
[the changelog entries]
</context>
```

Role, audience, format, length and tone all live in `<instructions>`. `<examples>` earns
its place here only if the bullet style is unusual enough that describing it fails.

## Worked rewrite: a vague feature request

**Before**

> make the export faster, it times out on big accounts. probably needs a queue or
> something. also clean up that old csv helper while you're in there

**After**

```
<instructions>
Diagnose why the account export times out on large accounts, then propose
a fix before implementing it. Do not start changing the export path until
the cause is confirmed.

Report: the measured cause, the options you considered, and your
recommendation with its trade-off.
</instructions>

<context>
app/jobs/export.ts is the current synchronous path.
<TODO: the largest account size that currently succeeds, and the one that fails>
<TODO: whether a job queue already exists in this codebase>
</context>

<constraints>
Leave app/lib/csv_helper.ts alone in this change. It was mentioned as an
aside and cleaning it up is a separate piece of work — raise it separately
if the diagnosis turns out to depend on it.
The exported file's columns and ordering must not change; downstream
consumers parse it positionally.
Say you are unsure rather than guessing at a cause you could not measure.
</constraints>
```

Four things changed. The "probably needs a queue" guess became a **diagnosis first**
instruction, because a guessed solution in a prompt gets implemented as a requirement.
The drive-by cleanup was **moved out of scope** rather than silently dropped or silently
kept. Two unknowns that only the author can answer became `<TODO>` rather than plausible
numbers. And a boundary nobody stated — the column order — was surfaced by asking what
must not break.

## Choosing the examples

Examples are for a shape that prose describes badly — an unusual bullet convention, a
classification with contested boundaries, a specific tone. Three to five is the useful
band.

- **Cover the boundary, not the centre.** The easy case teaches nothing; the ambiguous
  one is where the model would otherwise guess. One example of a genuinely hard call is
  worth four obvious ones.
- **Keep them consistent with each other.** Two examples that disagree about format cost
  more than either would gain alone.
- **Never invent an example's contents.** A fabricated example silently becomes the spec:
  the model copies its facts, not just its form. If you have no real one, ask for it or
  mark it `<TODO>`.
- **Delete the prose the examples replaced.** Keeping both is the most common way a
  rewrite ends up padded.

## Harness clauses worth pasting

Include these only when the target runs in an agentic harness with tools. They are
written as behaviours rather than tool names so they survive a harness that is not
Claude Code.

> Make independent tool calls in parallel rather than one at a time. Never
> call a tool with a placeholder argument you intend to fill in later.

> For a task with more moving parts than one reply can hold, keep working
> notes in a scratch file rather than in your reply.

> If you are running short of room, hand off in writing — what is done, what
> is left, what you learned — rather than declaring the work finished.

> Do not write code yet. Propose the approach and wait for it to be approved.

The last one changes the deliverable rather than the method, so it goes in only when the
user has actually asked for it.

## Reasoning scaffolds, and when not to add one

| Extended thinking on the target | What to add |
| --- | --- |
| Known **off** | A reasoning scaffold is fine — ask for the reasoning before the answer |
| Known **on** | **Nothing.** A manual `<thinking>` block fights the real one, and the degradation is silent |
| **Unknown** | A sequencing constraint — "read X before proposing Y" — which is safe either way |

The unknown row is the common one, and the sequencing constraint is the better
instruction regardless: it names the order the work has to happen in, which a scaffold
only implies.

## Padding that reads as rigour

Length is not quality, and an over-instructed prompt causes over-verification and
hedging. The four that show up most:

- **Role preambles.** "You are a world-class senior engineer" adds no constraint. A real
  role assignment — audience, expertise to assume, register — is different and belongs in
  `<instructions>`.
- **Restated best practices.** "Write clean, maintainable code" is not an instruction; it
  is a mood. Name the actual standard, or the file that already meets it.
- **Prohibitions that repeat each other.** Three sentences forbidding the same thing read
  as three separate rules and dilute the one that mattered.
- **Empty tags.** Four sections around one sentence of content is padding with better
  formatting. Delete the tag.
