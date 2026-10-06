// `node run.mjs <hook>.mjs`: a hook for Node 22 may not even parse on older Node, so this
// file checks first and must itself parse there — no static import, nothing past top-level await.

const MIN_MAJOR = 22;
// Failing open here would let credential material through; every other hook exits 1, non-blocking.
const FAIL_CLOSED = ['block-secrets.mjs'];

const version = process.versions.node;
const major = Number(version.split('.')[0]);
const hook = process.argv[2];

if (major >= MIN_MAJOR) {
  const { pathToFileURL } = await import('node:url');
  const path = await import('node:path');
  const file = path.resolve(hook);
  process.argv.splice(1, 2, file);
  await import(pathToFileURL(file).href);
} else {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');

  const message =
    'frontend-devkit core: Node ' + MIN_MAJOR + '+ is required, this is Node ' + version +
    '. Upgrade to Node ' + MIN_MAJOR + ' or later, or disable the plugin.\n';

  if (FAIL_CLOSED.indexOf(path.basename(String(hook))) !== -1) {
    process.stderr.write(message);
    process.exit(2);
  }

  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) raw += chunk;

  let sessionId = '';
  try {
    const evt = JSON.parse(raw);
    if (evt && typeof evt.session_id === 'string') sessionId = evt.session_id;
  } catch (err) {
    // No readable event: no session to remember, so the message is printed.
  }

  // Only characters that cannot form a path separator or a relative segment.
  const safeId = sessionId.replace(/[^A-Za-z0-9_-]/g, '_');
  // Once per session: the same error on every tool call would bury the transcript.
  let firstInSession = true;
  if (safeId) {
    const flag = path.join(os.tmpdir(), 'frontend-devkit-old-node-' + safeId);
    try {
      fs.writeFileSync(flag, '', { flag: 'wx' });
    } catch (err) {
      if (err && err.code === 'EEXIST') firstInSession = false;
    }
  }

  if (firstInSession) process.stderr.write(message);
  process.exit(1);
}
