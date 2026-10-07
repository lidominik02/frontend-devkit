# bounded-change

A one-line change in a tiny repository goes the clarifying-features bounded route end to end:
the in-chat design, its approval form, the change, the fast gates and the review.

The prompt names the skill in words rather than as a slash command: a slash command on the
first line of a `-p` prompt is expanded by the CLI itself (observed on Claude Code 2.1.278),
with no Skill tool call for `skill-called` to see.

## Fixture

### .gitignore
```
temp/
```

### package.json
```json
{
  "name": "bounded-fixture",
  "private": true,
  "type": "module",
  "scripts": {
    "lint": "node -e \"console.log('lint: ok')\""
  }
}
```

### src/format.js
```js
export function formatPrice(cents) {
  return (cents / 100).toFixed(2);
}
```

## Prompt
Use the core:clarifying-features skill for this change: formatPrice in src/format.js should put a dollar sign in front of the amount, so formatPrice(1999) returns "$19.99". Nothing else changes.

## Answers
- Build it → Build it

## Expect
- skill-called clarifying-features
- tool-called AskUserQuestion
- file-matches src/format.js /[`'"]\$/
- skill-called reviewing-changes

## Options
- budget: 3
