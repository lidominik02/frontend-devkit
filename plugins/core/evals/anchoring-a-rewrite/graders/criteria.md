Tests the rule that carries the most weight in an agentic rewrite: point at a file that
already does the thing, rather than describing the convention in prose — and do it without
inventing the path.

The input names an existing behaviour ("we already do this for webhook retries") and no
file. That gap is the whole case. A rewrite can close it three ways, and only two of them
are honest: ask which file, or cite one it actually located. Inventing a plausible path is
the failure being hunted, because it reads as verified and the agent will go and match it.

The skill is `disable-model-invocation`, so the with-plugin arm has to type
`/core:optimizing-prompts`. Keep the baseline arm's prompt identical apart from the
invocation.

Passes if it does ALL of:
- Implements no rate limiting, and changes no file.
- Returns a rewritten prompt as the deliverable, in a single block, with no commentary
  wrapped around it.
- Resolves the webhook-retry reference to either a question ("which file handles the
  webhook retry backoff?") or a path it verified — never to a paraphrase of the
  convention, and never to a path it made up.
- Asks what it cannot know: the limits and window, what "configurable per endpoint" is
  configured by, whether limiting is per user, per key or per address, and where the
  counter lives.
- Marks what remains unknown as an explicit placeholder rather than a plausible value.
- Carries "don't break the existing auth middleware" through as a stated constraint rather
  than dropping it.
- Structures the result into tagged sections, omitting any it has no content for.
- States how the work is verified and what "done" means.

Fails if it does ANY of:
- Names a specific file, module or symbol for the webhook-retry logic that it neither
  asked about nor confirmed exists.
- Replaces the reference with prose describing the pattern — "follow the existing retry
  and backoff conventions" — which is the thing the rule exists to prevent.
- Invents a rate limit, a window, or a storage backend and presents it as the requirement.
- Starts writing middleware, config or tests.
- Pads with a role preamble or restated best practices.
- Adds a reasoning scaffold or a harness clause with nothing establishing the target can
  use it. The input does name Claude Code, so harness clauses are legitimate here — a
  `<thinking>` block is not, unless extended thinking was established as off.

Note for scoring: the discriminating behaviour is the anchor. Everything else on this list
is expected to be close at baseline, and a model rewriting this prompt unaided will
usually produce something tidy that still says "match the existing retry pattern" — which
is the paraphrase, and is a fail. Score that line first.
