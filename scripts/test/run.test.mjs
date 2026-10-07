// run.mjs stands in front of every hook. On a supported Node it must be invisible; on an
// older one it must say why the hook did not run, block only for block-secrets, and not
// repeat the message on every tool call of a session.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { pathToFileURL } from 'node:url';

import { REPO_ROOT, gitRepo, hookEvent, isolatedEnv, runScript, tempDir, write } from './helpers.mjs';

const SCRIPTS = path.join(REPO_ROOT, 'plugins', 'core', 'scripts');
const RUN = path.join(SCRIPTS, 'run.mjs');
const hookPath = (name) => path.join(SCRIPTS, name);

const OLD_VERSION = '20.1.0';
const MESSAGE =
  `frontend-devkit core: Node 22+ is required, this is Node ${OLD_VERSION}. ` +
  'Upgrade to Node 22 or later, or disable the plugin.\n';

// Assembled at runtime so this file's own text never names credential material.
const DOTENV = '.' + 'env';

function both(hook, opts) {
  return {
    direct: runScript(hookPath(hook), opts),
    viaRun: runScript(RUN, { ...opts, args: [hookPath(hook)] }),
  };
}

function assertSame({ direct, viaRun }, expectedCode) {
  assert.equal(direct.code, expectedCode, `direct stderr: ${direct.stderr.trim()}`);
  assert.deepEqual(viaRun, direct);
}

function verifyBeforeDoneEvent(t) {
  const dir = gitRepo(t);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { lint: 'node -e "process.exit(1)"' } }));
  // A fresh npm cache makes npm check for its own update, and only the first of the two runs
  // prints the notice, so the gate output would differ between them.
  const env = { ...isolatedEnv(tempDir(t)), npm_config_update_notifier: 'false', CLAUDE_PROJECT_DIR: dir };
  return { input: JSON.stringify({ stop_hook_active: false }), env };
}

describe('run.mjs on Node 22 or later: the hook behaves as if started directly', () => {
  test('block-secrets', () => {
    assertSame(both('block-secrets.mjs', { input: hookEvent('Read', { file_path: DOTENV }) }), 2);
  });

  test('commit-hygiene', () => {
    assertSame(both('commit-hygiene.mjs', { input: hookEvent('Bash', { command: 'git push' }) }), 2);
  });

  // A no-op exits 0 silently too, so the formatter leaves a mark on each run.
  test('format-on-write', (t) => {
    const proj = tempDir(t);
    const log = path.join(tempDir(t), 'formatted');
    const file = path.join(proj, 'a.ts');
    write(proj, {
      'node_modules/prettier/package.json': JSON.stringify({ name: 'prettier', bin: { prettier: 'bin/prettier.cjs' } }),
      'node_modules/prettier/bin/prettier.cjs':
        `require('node:fs').appendFileSync(${JSON.stringify(log)}, process.argv.slice(2).join(' ') + '\\n');\n`,
      'a.ts': 'x\n',
    });
    const opts = { input: hookEvent('Write', { file_path: file }), env: { CLAUDE_PROJECT_DIR: proj } };
    const marks = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '');

    const direct = runScript(hookPath('format-on-write.mjs'), opts);
    assert.equal(marks(), `--write ${file}\n`, 'the hook started directly did not run the formatter');
    const viaRun = runScript(RUN, { ...opts, args: [hookPath('format-on-write.mjs')] });
    assert.equal(marks(), `--write ${file}\n--write ${file}\n`, 'the hook through run.mjs did not run the formatter');
    assertSame({ direct, viaRun }, 0);
  });

  test('verify-before-done', (t) => {
    const res = both('verify-before-done.mjs', verifyBeforeDoneEvent(t));
    assertSame(res, 0);
    assert.equal(JSON.parse(res.viaRun.stdout).decision, 'block');
  });

  test('argv, stdin and the exit code reach the hook untouched', (t) => {
    const dir = tempDir(t);
    const probe = path.join(dir, 'probe.mjs');
    fs.writeFileSync(
      probe,
      "let raw = '';\n" +
        "process.stdin.setEncoding('utf8');\n" +
        "process.stdin.on('data', (d) => { raw += d; });\n" +
        "process.stdin.on('end', () => {\n" +
        '  process.stdout.write(JSON.stringify({ argv: process.argv.slice(1), raw }));\n' +
        '  process.exitCode = 3;\n' +
        '});\n',
    );
    const res = runScript(RUN, { args: [probe, '--flag', 'value'], input: 'payload' });
    assert.equal(res.code, 3, `stderr: ${res.stderr.trim()}`);
    assert.deepEqual(JSON.parse(res.stdout), { argv: [probe, '--flag', 'value'], raw: 'payload' });
  });
});

describe('run.mjs below Node 22: the hook is not loaded, and the user is told why', () => {
  // A preload rewrites the reported version, so the old-Node branch runs on the current Node.
  function oldNode(t) {
    const state = tempDir(t);
    const preload = path.join(tempDir(t), 'old-node.mjs');
    fs.writeFileSync(
      preload,
      `Object.defineProperty(process.versions, 'node', { value: '${OLD_VERSION}' });\n`,
    );
    const env = { ...isolatedEnv(state), NODE_OPTIONS: `--import=${pathToFileURL(preload).href}` };
    const run = (hook, event) => runScript(RUN, { args: [hookPath(hook)], input: JSON.stringify(event), env });
    return { run, state };
  }

  test('block-secrets blocks every call, each with the message', (t) => {
    const { run } = oldNode(t);
    const event = { session_id: 's1', tool_name: 'Read', tool_input: { file_path: '/a/src/App.vue' } };
    for (let i = 0; i < 2; i++) {
      const res = run('block-secrets.mjs', event);
      assert.equal(res.code, 2);
      assert.equal(res.stderr, MESSAGE);
    }
  });

  for (const hook of ['commit-hygiene.mjs', 'format-on-write.mjs', 'verify-before-done.mjs']) {
    test(`${hook} fails open and prints the message once per session`, (t) => {
      const { run } = oldNode(t);
      const first = run(hook, { session_id: 's1', tool_name: 'Bash', tool_input: { command: 'git push' } });
      assert.equal(first.code, 1);
      assert.equal(first.stderr, MESSAGE);

      const second = run(hook, { session_id: 's1', tool_name: 'Bash', tool_input: { command: 'git push' } });
      assert.equal(second.code, 1);
      assert.equal(second.stderr, '');

      const otherSession = run(hook, { session_id: 's2' });
      assert.equal(otherSession.code, 1);
      assert.equal(otherSession.stderr, MESSAGE);
    });
  }

  test('without a session_id the message is printed on every call', (t) => {
    const { run } = oldNode(t);
    for (let i = 0; i < 2; i++) {
      const res = run('format-on-write.mjs', { tool_name: 'Write' });
      assert.equal(res.code, 1);
      assert.equal(res.stderr, MESSAGE);
    }
  });

  test('a session_id cannot place the flag file outside the temp directory', (t) => {
    const { run, state } = oldNode(t);
    const sessionId = `..${path.sep}..${path.sep}escape/a\\b`;
    assert.equal(run('commit-hygiene.mjs', { session_id: sessionId }).stderr, MESSAGE);
    assert.equal(run('commit-hygiene.mjs', { session_id: sessionId }).stderr, '');

    const entries = fs.readdirSync(state, { withFileTypes: true });
    assert.equal(entries.length, 1, `entries: ${entries.map((e) => e.name).join(', ')}`);
    assert.ok(entries[0].isFile());
  });
});
