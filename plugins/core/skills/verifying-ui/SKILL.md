---
name: verifying-ui
description: >-
  Verifies a UI change by observing it in a real browser through a browser MCP server,
  instead of asserting that it works. Use when the user says "check how this looks",
  "verify the UI", "does this render correctly", "take a screenshot of the page", "open
  it in the browser", "check the empty state", "check dark mode", "why does it look
  wrong", or asks whether a visual change actually works. For a QA list or a run against
  acceptance criteria, use testing-changes.
disallowed-tools: mcp__*__evaluate_script, mcp__*__upload_file, mcp__*__browser_evaluate, mcp__*__browser_file_upload
allowed-tools: Bash(git diff *) mcp__chrome-devtools__take_snapshot mcp__chrome-devtools__take_screenshot mcp__chrome-devtools__list_console_messages mcp__chrome-devtools__get_console_message mcp__chrome-devtools__list_network_requests mcp__chrome-devtools__get_network_request mcp__chrome-devtools__navigate_page mcp__chrome-devtools__new_page mcp__chrome-devtools__list_pages mcp__chrome-devtools__select_page mcp__chrome-devtools__resize_page mcp__chrome-devtools__emulate mcp__chrome-devtools__wait_for mcp__chrome-devtools__close_page mcp__playwright__browser_snapshot mcp__playwright__browser_take_screenshot mcp__playwright__browser_console_messages mcp__playwright__browser_network_requests mcp__playwright__browser_navigate mcp__playwright__browser_resize mcp__playwright__browser_wait_for mcp__playwright__browser_close Read Grep Glob
---

**The hold comes first.** Verification does not run until it is released. If the turn
does not carry an explicit release — the user saying to check, test, or look at
something now — stop before opening a browser and say what you would verify and how
long it would likely take, then wait. Reading this file, or being asked something
adjacent, is not a release.

You verify a change by looking at the running application. Everything else in this
devkit is static: the type-checker, the linter, the tests and the reviewer all read
code. The defects this skill exists for leave no trace in any of them — a skeleton
that is a different height from the content it stands in for, an error branch that
renders the empty state, focus lost after a client-side navigation, a component
that is correct and throws on every render anyway.

The rule the whole loop rests on: **an observation you did not make is not a pass.**
"It looks right" without a snapshot is the visual-layer version of claiming a gate
passed that never ran — it manufactures confidence that nothing downstream will check.

That rule cuts both ways. **A browser is not the cheapest way to answer most questions
about a page.** A person looks at a rendered page in about a second and notices anything
out of place. This loop is slower, sees less — a snapshot is a tree, and it flattens the
spacing, alignment and overlap defects an eye catches instantly — and costs a round trip
per state. So spend it where a glance cannot reach: a console error behind a page that
looks fine, the same request firing twice, a hydration mismatch, focus after a client-side
navigation, a state that has to be forced to exist at all. For "does this look right", say
what you changed and let the person look — that is the faster instrument, not a gap.

## Step 1 — Establish that you can see anything at all

**Your own tool list is the authority.** Look for tools named `mcp__*__take_snapshot`
or `mcp__*__browser_snapshot`. If they are there, a browser is drivable; if they are
not, it is not, and nothing else can tell you otherwise.

**If no browser tool is available, stop and say so in one line**, name what would
install one (`references/browser-tools.md`), and offer the static review instead. Do
not narrate what the page probably looks like. An honest "not verified" costs the user
one decision; a confident guess costs them the bug.

## Step 2 — Serve the change, and find the URL it is really on

`package.json`'s `dev` (or `serve`, `start`) script, run as `<pm> run <script>`; in a
monorepo the workspace's (`<pm>` per `../planning-features/references/project.md`). Two
failure modes, both ending with you looking at the wrong page and believing it:

1. **Never assume the port.** The script may name a port; the URL is the one the server
   printed. Vite, Nuxt and Next all walk to the next free port when theirs is taken —
   read the URL out of the startup output, every time.
2. **Check whether it is already running before starting one.** A second dev server
   binds a different port and serves the same code, so nothing looks wrong; but if the
   first one is on an older branch you are verifying code that is not in your diff. A
   dev server on a taken port also commonly prompts ("Port 5173 is in use, try another
   one? (Y/n)") rather than exiting, which hangs a background shell with no visible error.

Start it in the background, wait for the ready line, and take the URL from there. When
you are done, stop the server you started — and only that one — then load its URL once
more. A page that still answers means the server outlived its shell (observed on Windows):
never claim it stopped — tell the user the port still answers, for them to end.

**Hot reload is not a guarantee that what you see is what you wrote.** Edits to the
build config, plugins, route definitions, environment files or anything read at server
start leave a stale module graph behind while the page still looks alive. After any of
those, reload the page hard, and restart the server if the change was to its own
config. Verifying against a stale bundle is the most common false pass of this loop.

## Step 3 — Observe, snapshot before screenshot

**Open the URL you just read, explicitly, before observing anything.** `new_page` or
`navigate_page` loads it and reports the id; `list_pages` lists what is already open. A
persistent profile can hand you a tab from a previous session, and a second dev server
serves the same code, so establish the page deliberately.

**Check the URL in the snapshot against the one the server printed.** The snapshot names
it on its root node — `RootWebArea "…" url="http://localhost:5175/"` — and the network
list carries full URLs too. The console read names no page at all, so a console finding
means nothing unless you say which page it came from.

Take the accessibility snapshot **first**, then the screenshot. The snapshot is text:
roles, names, structure, and the element handles you need to interact. The screenshot
tells you what it *looks like* and nothing else — it cannot distinguish a loading
skeleton from an empty state, or an invisible element from an absent one.

**Look at the screenshot before writing anything about it** — one nobody looked at proves
nothing. Then read the console and the network before drawing a conclusion. **A page that looks
correct and logs an error is a bug you have already found** — hydration mismatches,
failed prop validation, unhandled rejections and 404s on real assets surface there and
nowhere in the picture. A request that fires twice, or with the wrong key, is visible
only in the network list. `references/browser-tools.md` has the exact tool names.

## Step 4 — Drive it to the states that only exist at runtime

One screenshot verifies one state, and the happy path is the state least likely to be
broken. Work through `references/runtime-checks.md` — loading, empty, error, overflow,
dark mode, narrow viewport, keyboard focus — and check the ones this change can reach.
Pick them from the diff: a list component owes you the empty and many-items cases; a
fetch owes you the pending and failed ones.

## Step 5 — Fix, then observe again

After every fix, re-observe — and **re-establish the condition under test before you
look.** `emulate` is absolute, not incremental: a later call that omits
`networkConditions` restores the network, so the "after" snapshot is of a working page
and the pass is clean, confident and wrong. A combined state is a single call naming
every parameter, never two calls.

Not "the change should handle it" — take the snapshot again and confirm. The model that
just wrote the fix is the worst available judge of whether it worked. Loop until the
observation matches the intent, or until you can say precisely what still does not and why.

## Step 6 — Report what you saw, and what you did not

```
## UI verification: <what changed>

Verified at: <the URL actually loaded>

### Observed
- <state>: <what the snapshot/screenshot actually showed>

### Not observed
- <state>: <why — unreachable without fixture data, needs auth, no browser tool>

### Findings
- <path:line or component> — what renders wrong, and the evidence you saw

### Console / network
- <errors and warnings, verbatim, with the page they came from>  |  clean
```

Every observation and finding carries the URL it came from; a console line names no
page, so write the page next to it. **Not observed** is a required section, not an
apology: a report that silently omits the states it could not reach reads as complete
coverage, which is worse than a short honest list.

## What this must NOT do

- **Describe a page it did not load.** No browser tool, no verification — say so and
  stop. This is the rule the skill exists to hold.
- **Report a screenshot as proof of a state it did not drive to.** The empty state is
  verified when the list is empty on screen, not when the code that handles it reads
  correctly.
- **Trust a port the script names, or any remembered default, over the URL the server printed.**
- **Re-observe without re-establishing the state under test**, or **call it fixed
  without re-observing.** See step 5 and `references/runtime-checks.md`.
- **Leave a dev server or a browser running** that it started, or kill one it did not.
- **Type credentials into a page.** No deny rule covers an MCP upload tool, so the upload
  tools are removed from this skill's pool outright — see `references/browser-tools.md`.
- **Substitute for an accessibility review.** A snapshot shows the tree; it does not
  tell you the tree is right.
- **Run the whole state checklist** on a change that cannot reach most of it.
