# protocol-check

The smallest run that exercises the driver's protocol: the `initialize` control request, a
form arriving as a `can_use_tool` request, and the answer going back in
`updatedInput.answers`. The answer reaches the file only when all three still work.
`/cli-upgrade-check` runs it after a Claude Code upgrade.

## Prompt
Use the AskUserQuestion tool to ask me exactly one question, "Which letter?", with the options A and B. Then write the letter I picked, and nothing else, into answer.txt.

## Answers
- Which letter → B

## Expect
- form-asked /Which letter/
- file-matches answer.txt /^B\s*$/

## Options
- model: haiku
- budget: 0.5
