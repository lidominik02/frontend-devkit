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
there rather than a per-call argument, so the techniques in `references/runtime-checks.md`
that reach for one are Chrome DevTools MCP's.

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
`references/runtime-checks.md` costs a prompt, and a loop that prompts six times to look
at one panel is a loop people switch off. It also carries `extraHttpHeaders`, `userAgent`
and `geolocation`, so it is not purely an observation tool: it can put a header on every
request the page makes. That is the trade being made, not an oversight.

Withheld on purpose:

- **`evaluate_script` / `browser_evaluate`** run arbitrary JavaScript in the page. Used
  to read a value they are a debugging tool; they are also the shortest path from a
  page to anywhere else.
- **`upload_file` / `browser_file_upload`** push a local file into a page, which then
  sends it. `block-secrets` matches file tools and `Bash`, not MCP tools, so a credential
  file taking that route fires no hook at all. Never upload a real file to verify an
  upload control; make a throwaway.
- **The interaction tools** — `click`, `fill`, `fill_form`, `hover`, `press_key`,
  `type_text` and their Playwright counterparts. Driving a page to a state needs them, so
  they prompt when a check calls for one; that is the point at which a human sees what is
  about to be typed into what.
- **Extension and PWA installs** change the machine, not the page.

A server under a different key than the recommended one simply prompts for everything.
That is the status quo, not a failure.

## Caveats worth knowing before trusting a result

- **The profile persists.** By default Chrome DevTools MCP keeps a profile under
  `$HOME/.cache/chrome-devtools-mcp/`, so a login in one session is still there in the
  next — convenient, and a way to be looking at authenticated state you forgot you
  established. `--isolated` gives a temporary profile discarded on close; the config
  above uses it.
- **It drives a real browser**, so page content reaches the transcript. Do not point it
  at production with real customer data to check a layout.
- **`--headless` is faster and hides the failure mode where the window never got focus.**
  Headed is the honest default while iterating.
- **`lighthouse_audit` is a score, not a review.** It catches contrast and missing
  labels; it cannot tell you the focus order is nonsense.

## Why this is not bundled

`core` installs in every repository, including ones with no user interface at all. A
plugin-declared MCP server would start a browser subprocess in all of them, and pull a
package over the network on first use, to serve the minority that need it.

There is a second reason that matters for the guidance above: a plugin-bundled server's
tools are named `mcp__plugin_<plugin>_<server>__<tool>`, not `mcp__<server>__<tool>`.
Bundling it would make every tool name in this file wrong for exactly the installation
path being forced on everyone.
