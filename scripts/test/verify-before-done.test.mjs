// verify-before-done is a Stop gate that must never trap the session: it blocks
// only on a failing gate, and skips a tree it has already seen green.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { REPO_ROOT, gitRepo, isolatedEnv, runScript, tempDir } from './helpers.mjs';

const HOOK = path.join(REPO_ROOT, 'plugins', 'core', 'scripts', 'verify-before-done.mjs');

const PASS = 'node -e "process.exit(0)"';
const FAIL = 'node -e "process.exit(1)"';
// The counter lives outside the repository, so a skipped run is told apart from a
// silent pass without changing the tree being fingerprinted.
const COUNT = "node -e \"require('fs').appendFileSync(process.env.DEVKIT_GATE_RUNS, 'x')\"";
const COUNT_FAIL = "node -e \"require('fs').appendFileSync(process.env.DEVKIT_GATE_RUNS, 'x'); process.exit(1)\"";
const FAIL_IF_BROKEN = "node -e \"process.exit(require('fs').existsSync('broken') ? 1 : 0)\"";

function gitEnv() {
  return Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
}

function git(dir, ...args) {
  const res = spawnSync('git', args, { cwd: dir, env: gitEnv(), encoding: 'utf8' });
  if (res.error) throw res.error;
  if (res.status !== 0) assert.fail(`git ${args.join(' ')} failed in ${dir}: ${res.stderr.trim()}`);
}

const commit = (dir, message) => git(dir, 'commit', '-q', '--no-verify', '-m', message);

const writeLint = (dir, lint) => fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { lint } }));

// State files go to os.tmpdir(), so each test points it at a directory of its own.
function stopHook(t) {
  const state = tempDir(t);
  const runsFile = path.join(state, 'gate-runs');
  const env = { ...isolatedEnv(state), DEVKIT_GATE_RUNS: runsFile };
  const stop = (dir, payload) => {
    const res = runScript(HOOK, { input: JSON.stringify(payload), env: { ...env, CLAUDE_PROJECT_DIR: dir } });
    assert.equal(res.code, 0, `stderr: ${res.stderr.trim()}`);
    return res.stdout;
  };
  const runs = () => (fs.existsSync(runsFile) ? fs.readFileSync(runsFile, 'utf8').length : 0);
  return { stop, runs };
}

const session = (extra = {}) => ({ session_id: `vbd-${randomUUID()}`, stop_hook_active: false, ...extra });

const blocks = (out) => out !== '' && JSON.parse(out).decision === 'block';

describe('verify-before-done: a Stop gate that cannot trap the session', () => {
  const repo = (t, lint) => {
    const dir = gitRepo(t);
    if (lint === undefined) fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: {} }));
    else writeLint(dir, lint);
    return dir;
  };

  test('a failing gate blocks the stop', (t) => {
    const { stop } = stopHook(t);
    assert.notEqual(stop(repo(t, FAIL), { stop_hook_active: false }), '');
  });

  test('a block uses the Stop decision contract', (t) => {
    const { stop } = stopHook(t);
    assert.ok(blocks(stop(repo(t, FAIL), { stop_hook_active: false })));
  });

  test('stop_hook_active prevents a loop', (t) => {
    const { stop } = stopHook(t);
    assert.equal(stop(repo(t, FAIL), { stop_hook_active: true }), '');
  });

  test('a passing gate stays silent', (t) => {
    const { stop } = stopHook(t);
    assert.equal(stop(repo(t, PASS), { stop_hook_active: false }), '');
  });

  test('a repo with no gates never blocks', (t) => {
    const { stop } = stopHook(t);
    assert.equal(stop(repo(t), { stop_hook_active: false }), '');
  });
});

describe('verify-before-done: an unchanged green tree is not re-verified, a red one always is', () => {
  // A committed package.json and an untracked file, so the tree is dirty and the gates have work.
  const repo = (t, lint) => {
    const dir = gitRepo(t);
    writeLint(dir, lint);
    git(dir, 'add', 'package.json');
    commit(dir, 'init');
    fs.writeFileSync(path.join(dir, 'work.txt'), 'a');
    return dir;
  };

  test('the first Stop in a session runs the gates', (t) => {
    const { stop, runs } = stopHook(t);
    assert.equal(stop(repo(t, COUNT), session({ background_tasks: [] })), '');
    assert.equal(runs(), 1);
  });

  test('an unchanged tree after a passing run skips the gates', (t) => {
    const { stop, runs } = stopHook(t);
    const dir = repo(t, COUNT);
    const s = session();
    stop(dir, s);
    assert.equal(stop(dir, s), '');
    assert.equal(runs(), 1);
  });

  test('editing an untracked file re-runs the gates', (t) => {
    const { stop, runs } = stopHook(t);
    const dir = repo(t, COUNT);
    const s = session();
    stop(dir, s);
    fs.appendFileSync(path.join(dir, 'work.txt'), 'b');
    stop(dir, s);
    assert.equal(runs(), 2);
  });

  test('a payload without session_id always runs the gates', (t) => {
    const { stop, runs } = stopHook(t);
    const dir = repo(t, COUNT);
    stop(dir, { stop_hook_active: false });
    stop(dir, { stop_hook_active: false });
    assert.equal(runs(), 2);
  });

  test('an in-flight background subagent exits 0 without running the gates', (t) => {
    const { stop, runs } = stopHook(t);
    const tasks = [{ id: 'b1', type: 'subagent', status: 'running', description: 'writes files' }];
    assert.equal(stop(repo(t, COUNT), session({ background_tasks: tasks })), '');
    assert.equal(runs(), 0);
  });

  // A background shell such as a dev server can run all session: it must not turn the gates off.
  test('a running background shell does not skip the gates', (t) => {
    const { stop, runs } = stopHook(t);
    const tasks = [{ id: 's1', type: 'shell', status: 'running', description: 'dev server', command: 'npm run dev' }];
    stop(repo(t, COUNT), session({ background_tasks: tasks }));
    assert.equal(runs(), 1);
  });

  test('a subagent that is not running does not skip the gates', (t) => {
    const { stop, runs } = stopHook(t);
    const tasks = [{ id: 'b2', type: 'subagent', status: 'completed', description: 'done' }];
    stop(repo(t, COUNT), session({ background_tasks: tasks }));
    assert.equal(runs(), 1);
  });

  test('a running subagent next to a shell still skips the gates', (t) => {
    const { stop, runs } = stopHook(t);
    const tasks = [
      { id: 's2', type: 'shell', status: 'running', description: 'dev server', command: 'npm run dev' },
      { id: 'b3', type: 'subagent', status: 'running', description: 'writes files', agent_type: 'general-purpose' },
    ];
    stop(repo(t, COUNT), session({ background_tasks: tasks }));
    assert.equal(runs(), 0);
  });

  test('a failing gate blocks the first Stop in a session', (t) => {
    const { stop } = stopHook(t);
    assert.ok(blocks(stop(repo(t, COUNT_FAIL), session())));
  });

  test('an unchanged tree after a failing run runs the gates and blocks again', (t) => {
    const { stop, runs } = stopHook(t);
    const dir = repo(t, COUNT_FAIL);
    const s = session();
    stop(dir, s);
    assert.ok(blocks(stop(dir, s)));
    assert.equal(runs(), 2);
  });
});

// A branch switch carrying the same uncommitted edit leaves status and the diff
// identical while the committed content under it changes.
describe('verify-before-done: a branch switch is a different tree', () => {
  const repo = (t) => {
    const dir = gitRepo(t);
    writeLint(dir, FAIL_IF_BROKEN);
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'notes\n');
    git(dir, 'add', 'package.json', 'notes.txt');
    commit(dir, 'init');
    git(dir, 'checkout', '-q', '-b', 'red');
    fs.writeFileSync(path.join(dir, 'broken'), 'x');
    git(dir, 'add', 'broken');
    commit(dir, 'red');
    git(dir, 'checkout', '-q', '-');
    fs.appendFileSync(path.join(dir, 'notes.txt'), 'edit\n');
    return dir;
  };

  test('the green branch passes before the switch', (t) => {
    const { stop } = stopHook(t);
    assert.equal(stop(repo(t), session()), '');
  });

  test('a branch switch carrying the same edit re-runs the gates and blocks', (t) => {
    const { stop } = stopHook(t);
    const dir = repo(t);
    const s = session();
    stop(dir, s);
    git(dir, 'checkout', '-q', 'red');
    assert.ok(blocks(stop(dir, s)));
  });
});

describe('verify-before-done: repositories without a plain HEAD at the project root', () => {
  // A repository with no commit yet has no HEAD to diff against, and must still skip.
  test('an unchanged tree on an unborn branch skips the second Stop', (t) => {
    const { stop, runs } = stopHook(t);
    const dir = gitRepo(t);
    writeLint(dir, COUNT);
    const s = session();
    stop(dir, s);
    stop(dir, s);
    assert.equal(runs(), 1);
  });

  // Untracked content anywhere in the repository is part of the tree, as status already reports it.
  const subdirRepo = (t) => {
    const dir = gitRepo(t);
    const web = path.join(dir, 'web');
    fs.mkdirSync(web);
    fs.mkdirSync(path.join(dir, 'shared'));
    writeLint(web, COUNT);
    git(dir, 'add', 'web/package.json');
    commit(dir, 'init');
    fs.writeFileSync(path.join(web, 'new.ts'), 'a');
    fs.writeFileSync(path.join(dir, 'shared', 'util.ts'), 'a');
    return { dir, web };
  };

  test('an unchanged tree in a subdirectory project skips the second Stop', (t) => {
    const { stop, runs } = stopHook(t);
    const { web } = subdirRepo(t);
    const s = session();
    stop(web, s);
    stop(web, s);
    assert.equal(runs(), 1);
  });

  test('an untracked edit outside a subdirectory project re-runs the gates', (t) => {
    const { stop, runs } = stopHook(t);
    const { dir, web } = subdirRepo(t);
    const s = session();
    stop(web, s);
    fs.appendFileSync(path.join(dir, 'shared', 'util.ts'), 'b');
    stop(web, s);
    assert.equal(runs(), 2);
  });
});
