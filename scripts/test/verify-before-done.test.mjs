// verify-before-done is a Stop gate that must never trap the session: it blocks
// only on a failing gate, and skips a tree it has already seen green.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { REPO_ROOT, git, gitRepo, isolatedEnv, runScript, runScriptAsync, tempDir } from './helpers.mjs';

const HOOK = path.join(REPO_ROOT, 'plugins', 'core', 'scripts', 'verify-before-done.mjs');

const PASS = 'node -e "process.exit(0)"';
const FAIL = 'node -e "process.exit(1)"';
const FAIL_SAYING = "node -e \"console.log('src/app.ts:1 Unexpected any'); process.exitCode = 1\"";
// The counter lives outside the repository, so a skipped run is told apart from a
// silent pass without changing the tree being fingerprinted.
const COUNT = "node -e \"require('fs').appendFileSync(process.env.DEVKIT_GATE_RUNS, 'x')\"";
const COUNT_FAIL = "node -e \"require('fs').appendFileSync(process.env.DEVKIT_GATE_RUNS, 'x'); process.exit(1)\"";
const FAIL_IF_BROKEN = "node -e \"process.exit(require('fs').existsSync('broken') ? 1 : 0)\"";

const commit = (dir, message) => git(dir, ['commit', '-q', '--no-verify', '-m', message]);

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

  test('a block uses the Stop decision contract and quotes what the failing gate said', (t) => {
    const { stop } = stopHook(t);
    const out = stop(repo(t, FAIL_SAYING), { stop_hook_active: false });
    assert.ok(blocks(out));
    assert.match(JSON.parse(out).reason, /^ {6}src\/app\.ts:1 Unexpected any\r?$/m);
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
    git(dir, ['add', 'package.json']);
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
    git(dir, ['add', 'package.json', 'notes.txt']);
    commit(dir, 'init');
    git(dir, ['checkout', '-q', '-b', 'red']);
    fs.writeFileSync(path.join(dir, 'broken'), 'x');
    git(dir, ['add', 'broken']);
    commit(dir, 'red');
    git(dir, ['checkout', '-q', '-']);
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
    git(dir, ['checkout', '-q', 'red']);
    assert.ok(blocks(stop(dir, s)));
  });
});

// run-gates is resolved next to the hook, so a copy beside a stand-in shows what the hook does with it.
async function withStandIn(t, runGatesSource, payload = { stop_hook_active: false }) {
  const scripts = tempDir(t);
  fs.copyFileSync(HOOK, path.join(scripts, 'verify-before-done.mjs'));
  fs.writeFileSync(path.join(scripts, 'run-gates.mjs'), runGatesSource);
  const dir = gitRepo(t);
  writeLint(dir, PASS);
  const stateDir = tempDir(t);
  const res = await runScriptAsync(path.join(scripts, 'verify-before-done.mjs'), {
    input: JSON.stringify(payload),
    env: { ...isolatedEnv(stateDir), CLAUDE_PROJECT_DIR: dir },
  });
  assert.equal(res.code, 0, `stderr: ${res.stderr.trim()}`);
  const remembered = fs.readdirSync(stateDir).some((f) => f.startsWith('devkit-verify-before-done-'));
  return { ...res, remembered };
}

describe('verify-before-done: run-gates stops its gates inside the hook budget', { concurrency: true }, () => {
  test('run-gates is handed what is left of the budget, less a reserve', async (t) => {
    const argsFile = path.join(tempDir(t), 'args.json');
    await withStandIn(
      t,
      `import fs from 'node:fs';\nfs.writeFileSync(${JSON.stringify(argsFile)}, JSON.stringify(process.argv.slice(2)));\n` +
        `process.stdout.write(JSON.stringify({ results: [] }));\n`,
    );
    const args = JSON.parse(fs.readFileSync(argsFile, 'utf8'));
    const i = args.indexOf('--budget');
    assert.notEqual(i, -1, `no --budget in ${JSON.stringify(args)}`);
    const budget = Number(args[i + 1]);
    assert.ok(budget > 0 && budget <= 185_000, `budget ${args[i + 1]}`);
  });

  // Staying silent when run-gates wrote no report reads as a pass.
  test('run-gates exiting without a report is a non-blocking notice quoting its stderr', async (t) => {
    const res = await withStandIn(
      t,
      `process.stderr.write('Error: Cannot find module ./project-facts.mjs\\n');\nprocess.exit(1);\n`,
    );
    assert.notEqual(res.stdout, '', 'the hook printed nothing');
    const out = JSON.parse(res.stdout);
    assert.equal(out.decision, undefined);
    assert.match(out.hookSpecificOutput.additionalContext, /NOT RUN/);
    assert.match(out.hookSpecificOutput.additionalContext, /Cannot find module \.\/project-facts\.mjs/);
  });

  // A usage error ran no gate, so remembering the tree as green would skip the next real run.
  test('a usage-error report is a non-blocking notice quoting it, and the tree is not remembered', async (t) => {
    const usageError = 'unknown stage "nope"; use one of: fast, full, release';
    const res = await withStandIn(
      t,
      `process.stdout.write(${JSON.stringify(JSON.stringify({ passed: false, usageError }))});\nprocess.exit(2);\n`,
      session(),
    );
    assert.notEqual(res.stdout, '', 'the hook printed nothing');
    const out = JSON.parse(res.stdout);
    assert.equal(out.decision, undefined);
    assert.match(out.hookSpecificOutput.additionalContext, /NOT RUN/);
    assert.ok(out.hookSpecificOutput.additionalContext.includes(usageError));
    assert.equal(res.remembered, false);
  });

  // The control for the test above: the same stand-in setup does remember a green report.
  test('a green report under a session is remembered', async (t) => {
    assert.equal((await withStandIn(t, `process.stdout.write(JSON.stringify({ results: [] }));\n`, session())).remembered, true);
  });

  // A gate that could not run is still unverified when another one fails beside it.
  test('a block carries each failing gate\'s output and every blocking gate that did not run', async (t) => {
    const report = {
      results: [
        { name: 'typecheck', command: 'npm run typecheck', status: 'fail', code: 2, output: 'src/a.ts:1 error one\nsrc/b.ts:9 error two' },
        { name: 'lint', command: 'npm run lint', status: 'not-run', blocking: true, reason: 'timed out after 30s', output: '' },
      ],
    };
    const res = await withStandIn(t, `process.stdout.write(${JSON.stringify(JSON.stringify(report))});\nprocess.exitCode = 1;\n`);
    const out = JSON.parse(res.stdout);
    assert.equal(out.decision, 'block');
    assert.ok(
      out.reason.includes('  - typecheck: FAILED (npm run typecheck)\n      src/a.ts:1 error one\n      src/b.ts:9 error two'),
      out.reason,
    );
    assert.ok(out.reason.includes('  - lint: NOT RUN (timed out after 30s)'), out.reason);
    assert.doesNotMatch(out.reason, /to see the full output/);
  });
});

describe('verify-before-done: stale state files are pruned', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const aged = (file, days) => {
    const when = new Date(Date.now() - days * DAY);
    fs.utimesSync(file, when, when);
  };
  const seed = (state) => {
    const old = path.join(state, 'devkit-verify-before-done-old');
    const fresh = path.join(state, 'devkit-verify-before-done-fresh');
    const other = path.join(state, 'unrelated-old');
    for (const f of [old, fresh, other]) fs.writeFileSync(f, 'x');
    aged(old, 8);
    aged(fresh, 1);
    aged(other, 8);
    return { old, fresh, other };
  };
  const stopIn = (state, dir) => runScript(HOOK, {
    input: JSON.stringify(session()),
    env: { ...isolatedEnv(state), npm_config_update_notifier: 'false', CLAUDE_PROJECT_DIR: dir },
  });

  test('an 8-day-old state file goes, a 1-day-old one and an unrelated file stay', (t) => {
    const state = tempDir(t);
    const { old, fresh, other } = seed(state);
    assert.equal(stopIn(state, gitRepo(t)).code, 0);
    assert.equal(fs.existsSync(old), false);
    assert.equal(fs.existsSync(fresh), true);
    assert.equal(fs.existsSync(other), true);
  });

  test('a file that cannot be deleted does not change the hook output', (t) => {
    const dir = gitRepo(t);
    writeLint(dir, FAIL);
    const clean = stopIn(tempDir(t), dir);
    const state = tempDir(t);
    // A directory cannot be unlinked, so the deletion fails.
    const stuck = path.join(state, 'devkit-verify-before-done-stuck');
    fs.mkdirSync(stuck);
    aged(stuck, 8);
    const res = stopIn(state, dir);
    assert.equal(res.code, 0);
    assert.equal(res.stdout, clean.stdout);
    assert.equal(res.stderr, clean.stderr);
    assert.equal(fs.existsSync(stuck), true);
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
    git(dir, ['add', 'web/package.json']);
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
