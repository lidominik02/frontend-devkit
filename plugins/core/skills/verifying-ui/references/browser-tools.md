# Browser tools: which one, how it is installed, what it is named

Neither server ships with this devkit, and that is deliberate — see "Why this is not
bundled" at the end.

## Which one

| | **Chrome DevTools MCP** | **Playwright MCP** |
| --- | --- | --- |
| Package | `chrome-devtools-mcp` | `@playwright/mcp` |
| For | Day-to-day: is this change right? | Pre-release: is it right in every engine? |
| Engines | Chrome / Chrome for Testing only | Chromium, Firefox, WebKit, Edge |
| Distinctive | Real performance traces, heap snapshots, `lighthouse_audit`, CDP-level network and console | Cross-browser, device emulation, storage and route interception |

Install **one**. Both attached at once gives every observation two tool names that
answer slightly differently, and a loop that mixes them reports on two browser states.
Chrome DevTools MCP is the default choice for this loop; reach for Playwright when the
question is specifically "does this work outside Chromium".

## Installing

**User scope is the normal install, and the one to reach for first.** A browser is a
property of how you work, not of one repository, and installing it once serves every
project you open:

```bash
claude mcp add --scope user chrome-devtools -- npx -y chrome-devtools-mcp@1.9.0 --isolated
claude mcp add --scope user playwright      -- npx -y @playwright/mcp@0.0.80 --isolated
```

**Pass the scope explicitly.** `claude mcp add` with no `--scope` defaults to *local*,
which records the server against whichever directory you happened to be standing in. It
then works in that one project and appears nowhere else, which reads exactly like a global
install that mysteriously stops working — and the config lives in `~/.claude.json` under
that project path, not in the repository, so nothing in the repo explains it.

Nothing about a user-scope install appears in the repository, so `project-facts.mjs`
reports `browserTools.declared: false` for it. That is correct and expected: the field
describes the repository, and the caller's own tool list is what settles whether a browser
is actually there.

A checked-in `.mcp.json` is for a **different** goal — handing the same server to everyone
who clones the repo. Use it when that is the point, not to equip yourself:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@1.9.0", "--isolated"]
    }
  }
}
```

**Pin the version, do not track `@latest`.** This repo already pins the Claude CLI in CI
for the same reason — flags appear and names change between releases, so an unpinned
install turns an unrelated upstream change into a failure on a commit that touched
nothing. It is a stronger argument here: this is a package fetched from the network and
executed on every teammate's machine at session start, `@latest` re-resolves every time,
and every tool name below is version-specific. Nothing errors when one is renamed — the
pre-approval simply matches nothing and quietly degrades to a prompt, and the table below
quietly goes stale. Bump it deliberately, and re-check the names when you do.

A `.mcp.json` in a repository **cannot approve itself in an interactive session** —
otherwise cloning a repository would run its author's chosen command on your machine.
Claude Code prompts once per server, or the project settles it in `.claude/settings.json`:

```json
{ "enabledMcpjsonServers": ["chrome-devtools"] }
```

Only for a server the project actually intends. `enableAllProjectMcpServers: true`
pre-approves whatever a future commit adds to that file, which is the property that
made the prompt exist.

**The prompt is the interactive path only.** A `claude -p` run, an Agent SDK session and a
cloud session cannot show it, and load project-scoped servers without asking. So a
checked-in `.mcp.json` is gated by a human in exactly the case where a human is present;
in the headless ones the file is trusted on sight. Weigh that before committing one to a
repository other people clone and run unattended.

None of that applies to a user-scope install: it is already yours, it needs no approval
from the repository, and it is unaffected by what any `.mcp.json` says.

## Launching a browser, or attaching to one

The configurations above **launch** a browser and, with `--isolated`, throw its profile
away afterwards. There is a second mode: `--browserUrl http://127.0.0.1:9222` (or
`--wsEndpoint`) **attaches** to a Chrome you started yourself with remote debugging on.

Attaching is convenient — the page is already logged in, and you watch the automation
happen in a window you can see. It also changes what you are pointing the tool at. That is
your real profile, with your real sessions, and page content reaches the transcript, so
anything the browser can already see is in scope for whatever is driving it. Keep a
launched, isolated browser for ordinary work, and attach deliberately when being signed in
is the point.

## Tool names

Claude Code names an MCP tool `mcp__<server-key>__<tool>`, and **the key is whatever
the `.mcp.json` calls it.** Keyed `browser`, the snapshot tool is
`mcp__browser__take_snapshot`, and a permission rule written against
`mcp__chrome-devtools__*` matches nothing. The key is also **sanitised**: every character
outside `A-Za-z0-9_-` becomes an underscore, so a server keyed `chrome.devtools` exposes
`mcp__chrome_devtools__take_snapshot`. `project-facts.mjs` applies the same rule and
reports the result as `browserTools.servers[].toolPrefix`.

The names below were checked against **chrome-devtools-mcp 1.9.0** and **@playwright/mcp
0.0.80**, the versions pinned above. Check what your server actually exposes before
treating a missing tool as a bug.

**Every page-scoped tool takes a `pageId`, and it is required.** Chrome DevTools MCP runs
with `--pageIdRouting` on by default, so a call without one is rejected outright —
`Invalid arguments for tool take_snapshot: Required at pageId` — rather than falling back
to the selected page. Get the id from `new_page` or `list_pages`, which print it beside
the URL:

```
## Pages
1: about:blank
2: Saved searches (http://localhost:5175/) [selected]
```

so that page is `pageId: 2`. `--no-page-id-routing` turns the requirement off; the default
is left alone here because routing by id is what keeps two agents sharing one browser from
observing each other's tabs.

**Chrome DevTools MCP** (bare names; prefix each with the server key):

| Purpose | Tool |
| --- | --- |
| Accessibility tree | `take_snapshot` |
| Picture | `take_screenshot` (`fullPage`, `uid` for one element) |
| Console | `list_console_messages` · `get_console_message` |
| Network | `list_network_requests` · `get_network_request` |
| Navigate | `navigate_page` · `new_page` · `list_pages` · `select_page` · `close_page` · `wait_for` (waits for **text**, not a selector) |
| Viewport / theme / network | `resize_page` · `emulate` (`colorScheme`, `networkConditions: Offline \| Slow 3G \| …`, `cpuThrottlingRate`) |
| Interact | `click` · `fill` · `fill_form` · `hover` · `press_key` · `type_text` |
| Performance | `performance_start_trace` · `performance_stop_trace` · `performance_analyze_insight` |
| Audit | `lighthouse_audit` |

**Playwright MCP**: `browser_snapshot`, `browser_take_screenshot`,
`browser_console_messages`, `browser_network_requests`, `browser_navigate`,
`browser_wait_for`, `browser_resize`, `browser_click`, `browser_type`,
`browser_fill_form`, `browser_press_key`, `browser_evaluate`, `browser_file_upload`.
It has no equivalent of `emulate`: colour scheme and throttling are launch configuration
there rather than a per-call argument, so the techniques in `runtime-checks.md` that
reach for one are Chrome DevTools MCP's.

`--slim` on Chrome DevTools MCP exposes three tools — navigate, evaluate, screenshot —
and none of the snapshot, console or network tools this loop is built on. Do not use it
here.

## What is granted, and what deliberately is not

`verifying-ui` pre-approves what it takes to **look at a page**: the snapshot, the
screenshot, the console, the network, navigation and page selection, plus the two tools
that change how the page is *rendered to you* rather than what it is — `resize_page` and
`emulate`. Everything that acts on the page, the file system or the machine still prompts.

`emulate` is the awkward one and is granted deliberately. It carries `colorScheme`,
`networkConditions` and `cpuThrottlingRate`, which are the whole of the dark-mode,
error-state and loading-state techniques — without it every state check in
`runtime-checks.md` costs a prompt, and a loop that prompts six times to look at one
panel is a loop people switch off. It also carries `extraHttpHeaders`, `userAgent`
and `geolocation`, so it is not purely an observation tool: it can put a header on every
request the page makes. That is the trade being made, not an oversight.

**Removed from the pool outright**, via `disallowed-tools`, because for these two a
prompt is not a good enough boundary. The removal is real and it is the strong kind:
checked against Claude Code 2.1.278 under both recommended keys, the two names are already
absent from the session's tool set before the first model call, `ToolSearch` reports them
unavailable and there is no schema left to call — while `take_snapshot` (or
`browser_snapshot`) from the same server in the same turn answers normally. Exactly two
tools are withdrawn and the rest of the server is untouched.

- **`evaluate_script` / `browser_evaluate`** run arbitrary JavaScript in the page. Used
  to read a value they are a debugging tool; they are also the shortest path from a
  page to anywhere else.
- **`upload_file` / `browser_file_upload`** push a local file into a page, which then
  sends it. `block-secrets` matches file tools and `Bash`, not MCP tools, so a credential
  file taking that route fires no hook at all — removing the tool is what closes that
  path, because nothing else here can. Never upload a real file to verify an upload
  control; make a throwaway.

**Left to prompt** — available, but never pre-approved, so a human sees each one:

- **The interaction tools** — `click`, `fill`, `fill_form`, `hover`, `press_key`,
  `type_text` and their Playwright counterparts. Driving a page to a state needs them, so
  they prompt when a check calls for one; that is the point at which a human sees what is
  about to be typed into what.
- **Extension and PWA installs** change the machine, not the page.

The grants are keyed to the two recommended server keys; the removals are not. **Under any
other key every grant misses**, and the tool prompts instead, which is the harmless
direction. The removals put a wildcard in the server segment, `mcp__*__evaluate_script`,
so they hold under any key: on Claude Code 2.1.283, under the key a plugin-provided server
gets (`plugin_chrome-devtools-mcp_chrome-devtools`), `mcp__*__evaluate_script` withdrew
`evaluate_script` although `--allowedTools` granted it, and left `take_snapshot` callable.
The wildcard withdraws each of the four names from every server, which is right only
because none of them is a tool this loop may call on any server. The withdrawal is scoped to
the invocation of this skill: on 2.1.283 a blocked tool was absent from the session's tool
list with the skill invoked as a slash command, and listed with the plugin loaded but the
skill not invoked; a model-fired invocation is unobserved.

A key is also sanitised before the prefix is built, so a grant can miss while the config
looks right: `chrome.devtools` resolves to `mcp__chrome_devtools__*`, matching none of the
hyphenated grants above although the server connects and every tool works. If you are
attaching a server under a key that is not `chrome-devtools` or `playwright`, expect every
observation to prompt; the removals still hold.

**Never put the wildcard in the tool segment.** `mcp__chrome-devtools__*` in
`disallowed-tools` withdraws the whole server — including every tool this loop needs — and
a tool named in both lists is withdrawn, so the wildcard silently wins over the grants.

## Caveats worth knowing before trusting a result

- **The profile persists.** By default Chrome DevTools MCP keeps a profile in the
  server's default profile directory under the user's home (on POSIX, observed as
  `$HOME/.cache/chrome-devtools-mcp/`), so a login in one session is still there in the
  next — convenient, and a way to be looking at authenticated state you forgot you
  established. `--isolated` gives a temporary profile discarded on close; the config
  above uses it.
- **It drives a real browser**, so page content reaches the transcript. Do not point it
  at production with real customer data to check a layout.
- **`--headless` is faster and hides the failure mode where the window never got focus.**
  Headed is the honest default while iterating.
- **`lighthouse_audit` is a score, not a review.** It catches contrast and missing
  labels; it cannot tell you the focus order is nonsense.

## Manual contrast, when the audit tool cannot run

`lighthouse_audit` is Chrome DevTools MCP only, needs a page it can navigate, and is one
more round trip. When it is unavailable — no browser attached at all, or the audit itself
times out — contrast is still checkable from two hex values and arithmetic, without
rendering anything.

WCAG's contrast ratio is `(L1 + 0.05) / (L2 + 0.05)`, where `L1` is the lighter colour's
relative luminance and `L2` the darker one's, and relative luminance is:

```
for each of R, G, B (0-255, scaled to 0-1):
  c = channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ^ 2.4
L = 0.2126 * R + 0.7152 * G + 0.0722 * B
```

Normal text needs a ratio of at least 4.5:1; large text (18pt, or 14pt bold) and UI
component boundaries need 3:1. Read the two colours from the snapshot or the source
rather than guessing them off the screenshot — a screenshot is a JPEG or PNG render, and
compression artifacts and anti-aliased edges make an eyedropper read on it unreliable
right where the answer matters most, at the boundary between passing and failing.

This is the one check in this skill that a browser cannot do better than arithmetic: two
literal colours and a fixed formula have one right answer, and rendering them changes
nothing about it.

## Why this is not bundled

`core` installs in every repository, including ones with no user interface at all. A
plugin-declared MCP server would start a browser subprocess in all of them, and pull a
package over the network on first use, to serve the minority that need it.

There is a second reason that matters for the guidance above: a plugin-bundled server's
tools are named `mcp__plugin_<plugin>_<server>__<tool>`, not `mcp__<server>__<tool>`.
Bundling it would make every tool name in this file wrong for exactly the installation
path being forced on everyone.
