# Browser tools: which one, how it is installed, what it is named

## Which one

| | **Chrome DevTools MCP** | **Playwright MCP** |
| --- | --- | --- |
| Package | `chrome-devtools-mcp` | `@playwright/mcp` |
| For | Day-to-day: is this change right? | Pre-release: is it right in every engine? |
| Engines | Chrome / Chrome for Testing only | Chromium, Firefox, WebKit, Edge |
| Distinctive | Real performance traces, heap snapshots, `lighthouse_audit`, CDP-level network and console | Cross-browser, device emulation, storage and route interception |

Install **one** — two attached give every observation two tool names and two browser
states. Chrome DevTools MCP is the default; Playwright when the question is "outside Chromium?".

## Installing

**User scope is the normal install.** A browser is a property of how you work, not of
one repository, and installing it once serves every project you open:

```bash
claude mcp add --scope user chrome-devtools -- npx -y chrome-devtools-mcp@1.9.0 --isolated
claude mcp add --scope user playwright      -- npx -y @playwright/mcp@0.0.80 --isolated
```

**Pass the scope explicitly.** With no `--scope` the default is *local*: recorded in
`~/.claude.json` against the directory you stood in, working in that one project only. A
user-scope install appears in no repository file; the session's tool list settles it.

A checked-in `.mcp.json` is for a **different** goal — the same server for everyone who clones:
```json
{ "mcpServers": { "chrome-devtools": { "command": "npx", "args": ["-y", "chrome-devtools-mcp@1.9.0", "--isolated"] } } }
```

**Pin the version, do not track `@latest`** — pin for the same reason CI pins its CLI:
names change between releases, and this package is fetched and executed on every
teammate's machine at session start. A renamed tool errors nowhere — the pre-approval
matches nothing and degrades to a prompt. Bump deliberately, and re-check the names.

A `.mcp.json` **cannot approve itself in an interactive session**: Claude Code prompts once
per server, or the project settles it with `{ "enabledMcpjsonServers": ["chrome-devtools"] }`
in `.claude/settings.json`. `enableAllProjectMcpServers: true` pre-approves whatever a future
commit adds, which is the property that made the prompt exist. **The prompt is the
interactive path only**: `claude -p`, an Agent SDK session and a cloud session load
project-scoped servers without asking, so in the headless cases the file is trusted on
sight. A user-scope install needs no approval from any repository.

**Launch, or attach.** The configurations above launch a browser and, with `--isolated`,
discard its profile. `--browserUrl http://127.0.0.1:9222` (or `--wsEndpoint`) attaches to
your own Chrome — your real profile and sessions, reaching the transcript. Attach only
when being signed in is the point.

## Tool names

Claude Code names an MCP tool `mcp__<server-key>__<tool>`, and **the key is whatever the
config calls it.** Keyed `browser`, the snapshot tool is `mcp__browser__take_snapshot`, and
a rule written against `mcp__chrome-devtools__*` matches nothing. The key is also
**sanitised**: every character outside `A-Za-z0-9_-` becomes an underscore, so
`chrome.devtools` exposes `mcp__chrome_devtools__take_snapshot`.

Checked against **chrome-devtools-mcp 1.9.0** and **@playwright/mcp 0.0.80**; check your
server before treating a missing tool as a bug.

**Every page-scoped tool requires a `pageId`** (`--pageIdRouting` is on by default; leave
it, it keeps two agents out of each other's tabs). `new_page` and `list_pages` print it:
`2: Saved searches (http://localhost:5175/) [selected]` is `pageId: 2`.

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

**Playwright MCP**: `browser_snapshot`, `browser_take_screenshot`, `browser_console_messages`,
`browser_network_requests`, `browser_navigate`, `browser_wait_for`, `browser_resize`,
`browser_click`, `browser_type`, `browser_fill_form`, `browser_press_key`, `browser_evaluate`,
`browser_file_upload`. No `emulate`: colour scheme and throttling are launch configuration.

Do not use `--slim`: it exposes no snapshot, console or network tool.

## What is granted, and what deliberately is not

`verifying-ui` pre-approves what it takes to **look at a page**: snapshot, screenshot,
console, network, navigation, page selection, `resize_page` and `emulate`. Everything that
acts on the page or the machine prompts. `emulate` carries the dark-mode, error and loading
techniques, and also `extraHttpHeaders`, `userAgent` and `geolocation` — a deliberate trade.

**Removed from the pool outright**, via `disallowed-tools`, because a prompt is not a good
enough boundary. Under any server key they are absent and `ToolSearch` reports them
unavailable, while `take_snapshot` from the same server answers normally.

- **`evaluate_script` / `browser_evaluate`** run arbitrary JavaScript in the page — a
  debugging tool, and the shortest path from a page to anywhere else.
- **`upload_file` / `browser_file_upload`** push a local file into a page, which then sends
  it. No deny rule covers an MCP upload tool, so the tool is removed. Never upload a real
  file to verify an upload control; make a throwaway.

**Left to prompt**, never pre-approved: the interaction tools (`click`, `fill`, `fill_form`,
`hover`, `press_key`, `type_text` and their Playwright counterparts) — the prompt is where a
human sees what is about to be typed into what — and extension or PWA installs, which change
the machine, not the page.

The grants are keyed to the two recommended server keys; **under any other key every grant
misses** and the tool prompts instead, the harmless direction. The removals hold under any key, even against an `--allowedTools`
grant.

## Caveats worth knowing before trusting a result

- **The profile persists.** Without `--isolated`, Chrome DevTools MCP keeps a profile under
  the user's home, `.cache/chrome-devtools-mcp/` on every OS, so a login survives into the
  next session.
- **Page content reaches the transcript.** Never point it at production customer data.
- **`--headless` hides the window that never got focus.** Headed is the honest default.
- **`lighthouse_audit` is a score, not a review** — contrast and labels, not focus order.

## Manual contrast, when the audit tool cannot run

Contrast is checkable from two hex values without rendering anything. WCAG's ratio is
`(L1 + 0.05) / (L2 + 0.05)`, `L1` the lighter colour's relative luminance:

```
for each of R, G, B (0-255, scaled to 0-1):
  c = channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ^ 2.4
L = 0.2126 * R + 0.7152 * G + 0.0722 * B
```

Normal text needs at least 4.5:1; large text (18pt, or 14pt bold) and UI component
boundaries 3:1. Read the colours from the snapshot or the source, never an eyedropper on
the screenshot — compression and anti-aliasing make it unreliable right at the boundary.

## Why this is not bundled

A bundled server would start a browser in every repository `core` installs in, and its
tools would be named `mcp__plugin_<plugin>_<server>__<tool>`, making every name above wrong.
