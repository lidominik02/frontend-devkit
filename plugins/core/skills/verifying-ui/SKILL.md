---
name: verifying-ui
description: >-
  Verify a UI change by looking at it in a real browser instead of asserting that
  it works. Drives a browser MCP server — Chrome DevTools MCP or Playwright MCP —
  through an observe-fix-observe loop: serves the app, reads the URL the dev server
  actually printed, takes an accessibility snapshot and a screenshot, reads the
  console and the network, and drives the page to the states that only exist at
  runtime. Use when the user says "check how this looks", "verify the UI", "does
  this render correctly", "take a screenshot of the page", "open it in the browser",
  "check the empty state", "check dark mode", "why does it look wrong", or asks
  whether a visual change actually works. Reports what it could not observe rather
  than calling it fine, and says plainly when no browser tool is configured.
disallowed-tools: mcp__chrome-devtools__evaluate_script, mcp__chrome-devtools__upload_file, mcp__playwright__browser_evaluate, mcp__playwright__browser_file_upload
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/project-facts.mjs) Bash(git diff *) mcp__chrome-devtools__take_snapshot mcp__chrome-devtools__take_screenshot mcp__chrome-devtools__list_console_messages mcp__chrome-devtools__get_console_message mcp__chrome-devtools__list_network_requests mcp__chrome-devtools__get_network_request mcp__chrome-devtools__navigate_page mcp__chrome-devtools__new_page mcp__chrome-devtools__list_pages mcp__chrome-devtools__select_page mcp__chrome-devtools__resize_page mcp__chrome-devtools__emulate mcp__chrome-devtools__wait_for mcp__playwright__browser_snapshot mcp__playwright__browser_take_screenshot mcp__playwright__browser_console_messages mcp__playwright__browser_network_requests mcp__playwright__browser_navigate mcp__playwright__browser_resize mcp__playwright__browser_wait_for Read Grep Glob
---

**The hold comes first.** Verification does not run until it is released. If the turn
does not carry an explicit release — the owner saying to check, test, or look at
something now — stop before opening a browser and say what you would verify and how
long it would likely take, then wait. This used to be enforced by hiding this skill
from the model entirely; now that it can fire on its own, the hold has to be held here,
in prose, instead. Reading this file, or being asked something adjacent, is not a
release.

You verify a change by looking at the running application. Everything else in this
devkit is static: the type-checker, the linter, the tests and the reviewer all read
code. The defects this skill exists for leave no trace in any of them — a skeleton
that is a different height from the content it stands in for, an error branch that
renders the empty state, focus lost after a client-side navigation, a component
that is correct and throws on every render anyway.

The rule the whole loop rests on: **an observation you did not make is not a pass.**
"It looks right" without a snapshot is the visual-layer version of claiming a gate
passed that never ran, and it fails the same way — it manufactures confidence that
nothing downstream will check.

That rule cuts both ways, and the second edge is the one that gets this loop switched off.
**A browser is not the cheapest way to answer most questions about a page.** A person looks
at a rendered page in about a second and notices anything out of place, including the thing
nobody thought to check. This loop is slower than that, sees less of it — a snapshot is a
tree, and it flattens the spacing, alignment and overlap defects an eye catches instantly —
and it costs a round trip per state.

So spend it where a glance cannot reach: a console error behind a page that looks fine, the
same request firing twice, a hydration mismatch, focus after a client-side navigation, a
state that has to be forced to exist at all. For "does this look right", say what you
changed and let the person look — that is not a gap in the verification, it is the faster
instrument.

## Step 1 — Establish that you can see anything at all

**Your own tool list is the authority.** Look for tools named `mcp__*__take_snapshot`
or `mcp__*__browser_snapshot`. If they are there, a browser is drivable; if they are
not, it is not, and nothing else can tell you otherwise.

!`node ${CLAUDE_PLUGIN_ROOT}/scripts/project-facts.mjs`

That is this repository, read from its own files — do not run it again. Step 2 needs
`devServer` from it. **Ignore `browserTools` unless your tool list came up empty**: it
reports what this repository declares in its own `.mcp.json`, and the ordinary install is
user scope, which appears in no file here — so `declared: false` is the expected reading
even with a browser attached. It earns a sentence in only one case: it names a server whose
tools you cannot see, and `approved: false` or `parsed: false` says why.

**If no browser tool is available, stop and say so in one line**, name what would
install one (`references/browser-tools.md`), and offer the static review instead. Do
not narrate what the page probably looks like. An honest "not verified" costs the user
one decision; a confident guess costs them the bug.

## Step 2 — Serve the change, and find the URL it is really on

`devServer` names the script. Two failure modes, both of which end with you looking at
the wrong page and believing it:

1. **Never assume the port.** `declaredPort` is what the script *names*, and Vite,
   Nuxt and Next all walk to the next free port when theirs is taken. The URL is the
   one the server **printed on startup** — read it out of the output, every time.
2. **Check whether it is already running before starting one.** A second dev server
   binds a different port and serves the same code, so nothing looks wrong; but if the
   first one is on an older branch you are verifying code that is not in your diff.
   Starting a second one is also not a safe fallback if you skip this check: a dev
   server bound to a port already in use commonly prompts interactively ("Port 5173 is
   in use, try another one? (Y/n)") rather than exiting, which hangs a background shell
   with no visible error — the run looks like it is still starting when it is actually
   stuck waiting for a keypress nobody will give it.

Start it in the background, wait for the ready line, and take the URL from there. When
you are done, stop the server you started — and only that one.

**Hot reload is not a guarantee that what you see is what you wrote.** Edits to the
build config, plugins, route definitions, environment files or anything read at server
start leave a stale module graph behind while the page still looks alive. After any of
those, reload the page hard, and restart the server if the change was to its own
config. Verifying against a stale bundle is the most common way this loop produces a
false pass.

## Step 3 — Observe, snapshot before screenshot

**Open the URL you just read, explicitly, before observing anything.** Every observation
tool acts on a page you name, so the page has to be established first: `new_page` or
`navigate_page` loads it and reports the id, and `list_pages` lists what is already open.
Two of this skill's own hazards make that worth doing deliberately — a persistent browser
profile can hand you a tab from a previous session, and a second dev server on another
port serves the same code, so nothing looks wrong.

**Check the URL in the snapshot against the one the server printed.** The snapshot names
it on its root node — `RootWebArea "…" url="http://localhost:5175/"` — and the network
list carries full URLs too, so the page is identifiable and a mismatch is visible for
free. The console read is the exception: it names no page at all, so a console finding
means nothing unless you say which page it came from.

Take the accessibility snapshot **first**, then the screenshot. The snapshot is text:
roles, names, structure, and the element handles you need to interact. It tells you
*what* is on the page. The screenshot tells you what it *looks like* and nothing else —
it cannot distinguish a loading skeleton from an empty state, or an element that is
invisible from one that is absent.

**Look at the screenshot before writing anything about it.** Capturing one and moving
on without reading it is the visual-layer version of claiming a gate passed that never
ran — a screenshot nobody looked at proves exactly as much as no screenshot at all.

Then read the console and the network before drawing a conclusion. **A page that looks
correct and logs an error is a bug you have already found** — hydration mismatches,
failed prop validation, unhandled rejections and 404s on real assets surface there and
nowhere in the picture. A request that fires twice, or fires with the wrong key, is
visible only in the network list.

`references/browser-tools.md` has the exact tool names for both servers.

## Step 4 — Drive it to the states that only exist at runtime

One screenshot verifies one state, and the happy path is the state least likely to be
broken. Work through `references/runtime-checks.md` — loading, empty, error, overflow,
dark mode, narrow viewport, keyboard focus — and check the ones this change can reach.

Pick them from the diff. A change to a list component owes you the empty and the
many-items cases; a change to a fetch owes you the pending and failed ones. Do not run
the whole checklist on a change that cannot reach most of it.

## Step 5 — Fix, then observe again

After every fix, re-observe — and **re-establish the condition under test before you
look.** `emulate` is absolute, not incremental: a later call that omits
`networkConditions` restores the network, so the "after" snapshot is of a working page
and the pass is clean, confident and wrong. A combined state is a single call naming
every parameter, never two calls.

Not "the change should handle it" — take the snapshot again and confirm. This is the
entire point of having a browser attached, and it is the step that gets skipped: the
model that just wrote the fix is the worst available judge of whether it worked.

Loop until the observation matches the intent, or until you can say precisely what
still does not and why.

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
- <errors and warnings, verbatim>  |  clean
```

**Not observed** is a required section, not an apology. A verification that lists three
states and silently omits the four it could not reach reads as complete coverage, which
is worse than a short honest list.

## What this must NOT do

- **Describe a page it did not load.** No browser tool, no verification — say so and
  stop. This is the rule the skill exists to hold.
- **Report a screenshot as proof of a state it did not drive to.** The empty state is
  verified when the list is empty on screen, not when the code that handles it reads
  correctly.
- **Trust `declaredPort`, or any remembered default, over the URL the server printed.**
- **Report an observation without the URL it came from.** The snapshot tells you the URL,
  so there is no excuse for an unlabelled finding — and the console does not, so that one
  has to be tied to the page by hand.
- **Re-observe without re-establishing the state under test.** See step 5, and
  `references/runtime-checks.md` for the full mechanics.
- **Call it fixed without re-observing.** See step 5.
- **Leave a dev server or a browser running** that it started, or kill one it did not.
- **Type credentials into a page.** A file input is a network path that no hook here can
  see, so the upload tools are removed from this skill's pool outright rather than left
  to prompt — see `references/browser-tools.md`.
- **Substitute for an accessibility review.** A snapshot shows the tree; it does not
  tell you the tree is right.
- **Run the whole state checklist** on a change that cannot reach most of it.
