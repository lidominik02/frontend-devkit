#!/usr/bin/env node
// PreToolUse hook -- blocks tool calls that would leak credential material or
// hand-edit a file that must only ever be machine-generated.
//
// Exit code 2 is the only mechanism that blocks a tool call deterministically,
// independent of permission mode. Deny rules in settings.json cover the
// permission layer; this covers everything else. Use both.
//
// Node rather than bash: bash exits 2 on a syntax error, and 2 is also the hook
// protocol's "block", so a shell hook containing a syntax error blocks every
// tool call -- including the edit that would repair it. Node exits 1 on a
// SyntaxError, a non-blocking error, so a broken Node hook fails open while a
// deliberate exit 2 still blocks. Fail closed on a policy decision; fail open
// on a broken interpreter.
//
// Covers three paths; covering only the first leaves the door open:
//   1. File tools  -- Read/Edit/Write/NotebookEdit/Grep, matched on the path
//   2. Write tools -- lockfiles and .git internals, never to be hand-edited
//   3. Bash        -- matched on tool_input.command, because a `deny` rule on
//                     Read of a dotenv file does nothing about reading it in a shell
//
// Limitations -- this is not a sandbox:
//   - Pattern-matching a shell string is not containment. It raises the cost of
//     an accident and stops the obvious paths; it does not stop deliberate
//     circumvention (base64, variable indirection, a helper script that reads
//     the file). The real controls are OS permissions and keeping production
//     secrets off a dev machine.
//   - Two holes no hook matcher can close, both documented platform behaviour:
//     an @file reference in a prompt inserts the file contents with no tool call
//     at all, and a file written by Bash never fires a PostToolUse hook. Close
//     the first with a Read(...) deny rule in settings.json.

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', () => {
  try {
    main(raw);
  } catch (err) {
    // A hook that cannot evaluate its own policy must not take the session down
    // with it. Report loudly and let the call through: a permanently blocked
    // session is both worse and likelier than the read this would have caught,
    // and the settings.json deny rules still apply.
    process.stderr.write(`devkit block-secrets: could not evaluate, allowing through: ${String(err)}\n`);
    process.exit(0);
  }
});

/** @param {string} reason */
function deny(reason) {
  process.stderr.write(`Blocked by devkit: ${reason}\n`);
  process.exit(2);
}

// Path fragments that identify credential material.
const SECRET_PATH = String.raw`(\.env\b|\.env\.[A-Za-z0-9_.-]+|/\.ssh/|/\.gnupg/|/\.aws/credentials|\bid_rsa|\bid_ed25519|\bid_ecdsa|\.pem\b|\.p12\b|\.pfx\b|\.keystore\b|serviceAccount[A-Za-z0-9_.-]*\.json|credentials\.json)`;

const LOCKFILES = new Set([
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb',
  'composer.lock', 'Cargo.lock', 'poetry.lock', 'Gemfile.lock', 'go.sum',
]);

/** @param {string} file */
function isCredentialPath(file) {
  // Templates are documentation, not secrets, and are the common case in a
  // repo. Checked first so no rule below can override the exemption.
  if (/\.(example|sample|template|dist)$/.test(file)) return false;
  const base = file.split('/').pop() ?? '';
  if (base === '.env' || base.startsWith('.env.')) return true;
  if (/(^|\/)(secrets|\.ssh|\.gnupg)\//.test(file)) return true;
  if (/\/\.aws\/credentials$/.test(file)) return true;
  if (/\.(pem|p12|pfx|keystore|key)$/.test(file)) return true;
  if (/(^|\/)id_(rsa|ed25519|ecdsa)(\.pub)?$/.test(file)) return true;
  if (/serviceAccount[A-Za-z0-9_.-]*\.json$/.test(base)) return true;
  if (base === 'credentials.json') return true;
  return false;
}

/** @param {string} input */
function main(input) {
  /** @type {any} */
  let evt = {};
  try { evt = JSON.parse(input); } catch { process.exit(0); }

  const tool = String(evt.tool_name ?? '');
  const ti = evt.tool_input ?? {};
  const file = String(ti.file_path ?? ti.notebook_path ?? ti.path ?? '');
  // Flatten newlines so a multi-line command cannot hide a violation on a line
  // the pattern never sees as adjacent.
  const command = String(ti.command ?? '').replace(/\n/g, ' ');

  // --- path 1: credential material named directly in a file tool ------------
  if (file && isCredentialPath(file)) {
    deny(`'${file}' looks like credential material. Ask the user for the value, or read the .example variant instead.`);
  }

  // --- path 2: files that must never be hand-edited -------------------------
  // Reading these is fine and often necessary; hand-writing them is always a
  // mistake. A lockfile changed by anything but the package manager produces an
  // install that cannot be reproduced, and the damage surfaces on someone
  // else's machine rather than here.
  if (/^(Edit|Write|NotebookEdit|MultiEdit)$/.test(tool) && file) {
    const base = file.split('/').pop() ?? '';
    if (LOCKFILES.has(base)) {
      deny(`'${base}' is a lockfile. Change it through the package manager (install/add/remove), never by hand -- a hand-edited lockfile resolves differently on the next machine.`);
    }
    if (/(^|\/)\.git\//.test(file)) {
      deny(`'${file}' is inside .git. Use git commands rather than writing to the object store or refs directly.`);
    }
  }

  // --- path 3: bash commands ------------------------------------------------
  // Only inspected for Bash-family tools, so a path mentioned in prose or in
  // another tool's payload cannot trip it.
  if (!/^(Bash|BashOutput|KillShell)?$/.test(tool)) process.exit(0);
  if (!command) process.exit(0);

  // Neutralise template files before scanning, replacing the whole token rather
  // than just the suffix: stripping ".example" off a dotenv template would
  // leave the real name behind and block a legal command.
  const scan = command.replace(/[A-Za-z0-9_./~-]*\.(example|sample|template|dist)\b/g, 'SAFE_TEMPLATE_FILE');

  const rules = [
    {
      // Reading a secret through a shell utility. `source` and `.` load it
      // straight into the environment rather than printing it, so they belong
      // in the same list as `cat`.
      re: new RegExp(String.raw`(^|[;&|]|\s)(cat|less|more|head|tail|bat|nl|xxd|od|strings|grep|rg|awk|sed|cut|sort|uniq|tee|cp|mv|scp|rsync|tar|zip|gzip|dd|base64|openssl|source|\.)\s[^|;&]*` + SECRET_PATH),
      msg: 'that command reads credential material. A deny rule on the Read tool does not stop a shell, which is why this is checked here. Ask the user for the value you need.',
    },
    {
      // An interpreter one-liner is a shell utility with extra steps.
      re: new RegExp(String.raw`\b(node|deno|bun|python|python3|ruby|perl|php)\b[^|;&]*(-e|-c|--eval|--print)\b[^|;&]*` + SECRET_PATH),
      msg: 'that reads credential material through an interpreter. Ask the user for the value you need.',
    },
    {
      // Exfiltration. Reading a secret into the transcript is recoverable;
      // posting it to a remote host is not. The rules above stop a value
      // reaching the conversation; only this one stops it reaching the network.
      re: new RegExp(String.raw`\b(curl|wget|http|httpie|nc|ncat|socat)\b[^|;&]*(-d\s*@|--data[a-z-]*\s*@|--upload-file|--post-file[=\s]|--post-data[=\s]|\s-T\s|-F\s*[A-Za-z_]*=@)[^|;&]*` + SECRET_PATH),
      msg: 'that would send credential material to a remote host. Nothing here needs to upload a secret.',
    },
    {
      re: new RegExp(SECRET_PATH + String.raw`[^|;&]*\|\s*(curl|wget|nc|ncat|socat)\b`),
      msg: 'that pipes credential material into a network client. Nothing here needs to upload a secret.',
    },
    {
      // Dumping the whole environment, which usually contains injected secrets.
      re: /(^|[;&|]\s*)(printenv|env)\s*(\||$|>)|(^|[;&|]\s*)set\s*-o?\s*posix?\s*;?\s*set\s*$/,
      msg: 'dumping the environment exposes injected secrets to the transcript. Read the single variable you need instead.',
    },
    {
      // Piping a download straight into a shell.
      re: /\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(sh|bash|zsh)\b/,
      msg: 'piping a download into a shell executes unreviewed remote code. Download it, read it, then run it.',
    },
  ];

  for (const rule of rules) {
    if (rule.re.test(scan)) deny(rule.msg);
  }

  process.exit(0);
}
