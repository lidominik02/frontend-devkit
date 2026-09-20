---
max_turns: 20
allowed_tools: [Read, Write, Glob, Grep, Skill, Bash]
---

/core:testing-changes run price-tag-redesign

Here's the approved test list at `temp/price-tag-redesign/qa/TEST-LIST.md`:

```markdown
## Test list: price-tag-redesign

### The discounted price shows a strikethrough on the original price
- Positive: a discounted item shows both prices, original struck through — verified by: design intent
- Negative: a non-discounted item shows only one price, no strikethrough — verified by: design intent

### The sale badge matches the design system's badge component
- Positive: badge renders with the design's spacing and color token — verified by: design intent
```

This repo has no design-tool MCP server attached in this session, and no project-local
design skill either — nothing here can reach a design frame at all. Go ahead and run the
approved list now; I've released verification for this one.
