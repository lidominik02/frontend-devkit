#!/usr/bin/env node
// A stand-in for `claude -p` speaking the stream-json control protocol, scripted by the
// FAKE_CLAUDE environment variable:
//
//   { "extraPlugins": [{ "source": "vue@frontend-devkit" }],   added to the init event
//     "noInit": true,                                           no init event at all
//     "initAck": "error" | "none",                              refuse, or never answer, the initialize request
//     "steps": [
//       { "emit": { … } },                                       one stdout line
//       { "request": { "tool_name": "Write", "input": { … } } }, a can_use_tool request, awaiting its response
//       { "result": { "subtype": "success" } },                  the result event; exits once stdin closes
//         with "noNewline": true, written without a newline and exits at once; with "thenHang": true, never exits
//       { "hang": true },                                         never ends
//       { "exit": 3 }                                             exits without a result
//     ] }
//
// It waits for the initialize request and the user message, answers the first and emits an init
// event whose plugins are its --plugin-dir arguments as <name>@inline. FAKE_CLAUDE_LOG names a
// file that receives one JSON line per thing it saw: its pid and arguments, then every stdin message.

import fs from 'node:fs';
import path from 'node:path';

const script = JSON.parse(process.env.FAKE_CLAUDE ?? '{"steps":[]}');
const log = (entry) => process.env.FAKE_CLAUDE_LOG && fs.appendFileSync(process.env.FAKE_CLAUDE_LOG, JSON.stringify(entry) + '\n');
const out = (event) => process.stdout.write(JSON.stringify(event) + '\n');

log({ pid: process.pid, args: process.argv.slice(2) });

const inbox = [];
let waiter = null;
let closed = false;
let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const msg = JSON.parse(buf.slice(0, i));
    buf = buf.slice(i + 1);
    log({ received: msg });
    inbox.push(msg);
    waiter?.();
  }
});
process.stdin.on('end', () => { closed = true; waiter?.(); });

async function next(match) {
  for (;;) {
    const at = inbox.findIndex(match);
    if (at >= 0) return inbox.splice(at, 1)[0];
    if (closed) return null;
    await new Promise((resolve) => { waiter = resolve; });
    waiter = null;
  }
}

const args = process.argv.slice(2);
const plugins = args
  .flatMap((a, i) => (a === '--plugin-dir' ? [args[i + 1]] : []))
  .map((dir) => ({ name: path.basename(dir), path: dir, source: `${path.basename(dir)}@inline` }));

const init = await next((m) => m.type === 'control_request' && m.request?.subtype === 'initialize');
if (script.initAck === 'error') out({ type: 'control_response', response: { subtype: 'error', request_id: init.request_id, error: 'unknown request' } });
else if (script.initAck !== 'none') out({ type: 'control_response', response: { subtype: 'success', request_id: init.request_id, response: {} } });
await next((m) => m.type === 'user');
if (!script.noInit) out({ type: 'system', subtype: 'init', claude_code_version: '0.0.0-fake', plugins: [...plugins, ...(script.extraPlugins ?? [])] });

let n = 0;
for (const step of script.steps) {
  if (step.emit) out(step.emit);
  if (step.request) {
    const id = `req-${++n}`;
    out({ type: 'control_request', request_id: id, request: { subtype: 'can_use_tool', ...step.request } });
    await next((m) => m.type === 'control_response' && m.response?.request_id === id);
  }
  if (step.hang) {
    setInterval(() => {}, 60_000);
    await new Promise(() => {});
  }
  if (step.exit !== undefined) process.exit(step.exit);
  if (step.result) {
    const { noNewline, thenHang, ...fields } = step.result;
    const event = JSON.stringify({ type: 'result', total_cost_usd: 0.01, is_error: false, ...fields });
    if (noNewline) {
      process.stdout.write(event, () => process.exit(0));
      await new Promise(() => {});
    }
    process.stdout.write(event + '\n');
    if (thenHang) {
      setInterval(() => {}, 60_000);
      await new Promise(() => {});
    }
    await next(() => false);
    process.exit(0);
  }
}
