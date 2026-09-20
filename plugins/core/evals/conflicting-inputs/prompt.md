---
max_turns: 30
allowed_tools: [Read, Write, Glob, Grep, Skill, Bash]
---

/core:planning-features new bulk-archive

<user_story>
Users should be able to select multiple items in the inbox and archive them all in one
action, with a confirmation step before anything is archived.
</user_story>

Here's a screenshot description of the Figma frame for this (I can't attach the real
image, but this is what it shows): a toolbar checkbox appears when 2+ items are
selected, labelled "Archive selected", with NO confirmation dialog in the mockup at
all — clicking it just archives immediately and shows an undo toast for 5 seconds.

Also, I confirmed with the product owner this morning in Slack that the confirmation
step is required — legal flagged that silent bulk-archiving of inbox items (which can
include time-sensitive notices) needs an explicit confirm step, undo toast or not. That
Slack conversation is the most recent and most authoritative source on this, and it is
the same requirement the user story already stated — only the Figma frame disagrees
with both of them.
