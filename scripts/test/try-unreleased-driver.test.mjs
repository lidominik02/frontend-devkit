// The driver decides whether a scripted session ran against the working tree and what it may
// write, so a void, interrupted or escaping run must never come back as a pass.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { REPO_ROOT, isolatedEnv, runScriptAsync, tempDir, write } from './helpers.mjs';
import { insideRepo, isInside, pickWindowsBinary } from '../../.claude/skills/try-unreleased/scripts/driver.mjs';

const DRIVER = path.join(REPO_ROOT, '.claude', 'skills', 'try-unreleased', 'scripts', 'driver.mjs');
const FAKE = path.join(REPO_ROOT, 'scripts', 'test', 'fixtures', 'fake-claude.mjs');

const SCENARIO = `# demo

## Fixture
### src/a.js
\`\`\`js
export const a = 1;
\`\`\`

## Prompt
Rename a to b.

## Answers
- language → second

## Expect
- tool-called Edit
- form-asked /language/
`;

async function drive(t, { fake = {}, scenario = SCENARIO, args = [] } = {}) {
  const dir = tempDir(t);
  const tmp = path.join(dir, 'tmp');
  fs.mkdirSync(tmp);
  write(dir, { 'scenario.md': scenario });
  const logFile = path.join(dir, 'fake.jsonl');
  const res = await runScriptAsync(DRIVER, {
    args: [path.join(dir, 'scenario.md'), '--claude', FAKE, '--json', ...args],
    env: { ...isolatedEnv(tmp), FAKE_CLAUDE: JSON.stringify(fake), FAKE_CLAUDE_LOG: logFile },
  });
  const report = res.code === 2 ? null : JSON.parse(res.stdout);
  const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  return { ...res, report, log, tmp };
}

const ask = (...questions) => ({
  request: {
    tool_name: 'AskUserQuestion',
    input: { questions: questions.map((q) => ({ question: q, header: q.slice(0, 8), options: [{ label: 'First (Recommended)' }, { label: 'Second' }], multiSelect: false })) },
  },
});
const writeTo = (tool, file) => ({ request: { tool_name: tool, input: { file_path: file, content: 'x' } } });
const editEvent = { emit: { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: 'src/a.js' } }] } } };
const responses = (log) => log.filter((e) => e.received?.type === 'control_response').map((e) => e.received.response.response);

describe('the driver against a scripted session', { concurrency: true }, () => {
  test('initializes first, answers forms, keeps writes inside the scratch repository, and passes', async (t) => {
    const outside = path.join(REPO_ROOT, 'escaped.txt');
    const { code, report, log, tmp } = await drive(t, {
      fake: {
        steps: [
          ask('Which language are the artifacts in?', 'Which mode?'),
          writeTo('Write', outside),
          writeTo('Write', 'src/new.js'),
          writeTo('Edit', '../escape.js'),
          { request: { tool_name: 'Bash', input: { command: 'ls' } } },
          editEvent,
          { result: { subtype: 'success', total_cost_usd: 0.12 } },
        ],
      },
    });

    assert.equal(code, 0);
    assert.equal(report.status, 'completed');
    assert.deepEqual(report.expectations.map((e) => e.result), ['met', 'met']);

    const [start, first, second] = log;
    assert.deepEqual(first.received.request, { subtype: 'initialize' });
    assert.deepEqual(second.received.message, { role: 'user', content: 'Rename a to b.' });

    const [form, outsideWrite, insideWrite, upWrite, bash] = responses(log);
    assert.deepEqual(form.updatedInput.answers, { 'Which language are the artifacts in?': 'Second', 'Which mode?': 'First (Recommended)' });
    assert.equal(form.behavior, 'allow');
    assert.deepEqual([outsideWrite.behavior, insideWrite.behavior, upWrite.behavior, bash.behavior], ['deny', 'allow', 'deny', 'allow']);
    assert.match(outsideWrite.message, /outside the scratch repository/);
    assert.deepEqual(report.unscriptedQuestions, [{ question: 'Which mode?', picked: 'First (Recommended)' }]);
    assert.deepEqual(report.deniedRequests, [{ tool: 'Write', target: outside }, { tool: 'Edit', target: '../escape.js' }]);

    // The isolation flags, the working tree's core, and the run's own id, model and ceiling.
    const args = start.args;
    for (const flag of ['-p', '--include-hook-events', '--verbose', '--strict-mcp-config']) assert.ok(args.includes(flag), flag);
    const value = (flag) => args[args.indexOf(flag) + 1];
    assert.equal(value('--permission-prompt-tool'), 'stdio');
    assert.equal(value('--setting-sources'), 'project,local');
    assert.equal(value('--mcp-config'), '{"mcpServers":{}}');
    assert.equal(value('--input-format'), 'stream-json');
    assert.equal(value('--output-format'), 'stream-json');
    assert.equal(value('--plugin-dir'), path.join(REPO_ROOT, 'plugins', 'core'));
    assert.equal(value('--session-id'), report.sessionId);
    assert.equal(value('--max-budget-usd'), '2');
    assert.equal(value('--model'), 'sonnet');

    // The run directory stays, outside the repository, under the OS temp directory.
    assert.equal(path.dirname(report.runDir), fs.realpathSync.native(tmp));
    assert.equal(fs.readFileSync(path.join(report.runDir, 'repo', 'src', 'a.js'), 'utf8'), 'export const a = 1;\n');
    assert.ok(fs.existsSync(path.join(report.runDir, 'repo', '.git')));
    const stream = fs.readFileSync(path.join(report.runDir, 'stream.jsonl'), 'utf8').trim().split('\n');
    assert.equal(JSON.parse(stream.at(-1)).type, 'result');
    assert.equal(report.cliVersion, '0.0.0-fake');
    assert.deepEqual(report.plugins, ['core@inline']);
    assert.equal(report.costUsd, 0.12);
    assert.match(report.transcript, new RegExp(`${report.sessionId}\\.jsonl$`));
    // Every observation carries the versions it was made on.
    assert.equal(report.node, process.version);
    assert.match(report.os, /\S+ \S+/);
    assert.deepEqual(report.unconfirmedWrites, []);
    assert.ok(!fs.existsSync(outside));
  });

  // A pre-approved write never reaches the driver as a request; the stream still shows it.
  test('a write outside the repository the session never asked about is listed as unconfirmed', async (t) => {
    const outside = path.join(REPO_ROOT, 'pre-approved.txt');
    const toolUse = (name, file) => ({ emit: { type: 'assistant', message: { content: [{ type: 'tool_use', name, input: { file_path: file } }] } } });
    const { report } = await drive(t, {
      fake: {
        steps: [
          toolUse('Write', outside),
          toolUse('Edit', 'src/a.js'),
          toolUse('Write', '/elsewhere/denied.txt'),
          writeTo('Write', '/elsewhere/denied.txt'),
          { result: { subtype: 'success' } },
        ],
      },
    });
    assert.deepEqual(report.deniedRequests, [{ tool: 'Write', target: '/elsewhere/denied.txt' }]);
    assert.deepEqual(report.unconfirmedWrites, [{ tool: 'Write', target: outside }]);
  });

  test('a scripted answer the form does not offer is never sent; the first option goes, and the miss is reported', async (t) => {
    const { report, log } = await drive(t, {
      scenario: SCENARIO.replace('- language → second', '- language → Klingon'),
      fake: { steps: [ask('Which language are the artifacts in?'), { result: { subtype: 'success' } }] },
    });
    const [form] = responses(log);
    assert.deepEqual(form.updatedInput.answers, { 'Which language are the artifacts in?': 'First (Recommended)' });
    assert.deepEqual(report.unscriptedQuestions, [{ question: 'Which language are the artifacts in?', picked: 'First (Recommended)', notOffered: 'Klingon' }]);
  });

  test('a CLI that refuses the initialize request is an error naming the protocol, not a plugin failure', async (t) => {
    const { code, report } = await drive(t, { fake: { initAck: 'error', steps: [{ hang: true }] }, args: ['--timeout', '5'] });
    assert.equal(report.status, 'error');
    assert.match(report.reason, /^NOT RUN: the CLI refused the initialize request \(unknown request\); .*\/cli-upgrade-check/);
    assert.deepEqual(report.expectations, []);
    assert.equal(code, 1);
  });

  test('a CLI that exits with no answer, no init event and no result never started: an error naming the protocol', async (t) => {
    const { code, report } = await drive(t, { fake: { initAck: 'none', noInit: true, steps: [{ exit: 1 }] } });
    assert.equal(report.status, 'error');
    assert.match(report.reason, /^NOT RUN: the session never started: no answer to the initialize request, no init event and no result \(exit 1; see stderr\.log\)/);
    assert.equal(code, 1);
  });

  // A session that ran was billed: a missing acknowledgement alone must not void it.
  test('a session that ran without acknowledging initialize is judged as usual, with a note', async (t) => {
    const { code, report } = await drive(t, { fake: { initAck: 'none', steps: [editEvent, ask('Which language?'), { result: { subtype: 'success' } }] } });
    assert.equal(report.status, 'completed');
    assert.deepEqual(report.expectations.map((e) => e.result), ['met', 'met']);
    assert.match(report.notes[0], /^the initialize request was never acknowledged, though the session ran/);
    assert.equal(code, 0);
  });

  test('an acknowledged run carries no note', async (t) => {
    const { report } = await drive(t, { fake: { steps: [{ result: { subtype: 'success' } }] } });
    assert.deepEqual(report.notes, []);
  });

  test('a result written without a final newline still counts', async (t) => {
    const { code, report } = await drive(t, { fake: { steps: [editEvent, ask('Which language?'), { result: { subtype: 'success', noNewline: true } }] } });
    assert.equal(report.status, 'completed');
    assert.equal(code, 0);
  });

  // The session outlives its result by more than the timeout; the result already decided the run.
  test('a successful result is not undone by the timeout while the session is slow to exit', async (t) => {
    const { code, report, log } = await drive(t, {
      fake: { steps: [editEvent, ask('Which language?'), { result: { subtype: 'success', thenHang: true } }] },
      args: ['--timeout', '1'],
    });
    assert.equal(report.status, 'completed');
    assert.equal(code, 0);
    assert.throws(() => process.kill(log[0].pid, 0), { code: 'ESRCH' });
  });

  test('a framework pack loads with its dependencies, and the call overrides model and ceiling', async (t) => {
    const { report, log } = await drive(t, {
      scenario: SCENARIO + '\n## Options\n- packs: nuxt\n- model: haiku\n',
      args: ['--budget', '0.5'],
      fake: { steps: [{ result: { subtype: 'success' } }] },
    });
    const args = log[0].args;
    const dirs = args.flatMap((a, i) => (a === '--plugin-dir' ? [path.basename(args[i + 1])] : []));
    assert.deepEqual(dirs, ['core', 'vue', 'nuxt']);
    assert.equal(args[args.indexOf('--model') + 1], 'haiku');
    assert.equal(args[args.indexOf('--max-budget-usd') + 1], '0.5');
    assert.deepEqual([report.model, report.budgetUsd], ['haiku', 0.5]);
  });

  test('an expectation not met fails the run', async (t) => {
    const { code, report } = await drive(t, { fake: { steps: [{ result: { subtype: 'success' } }] } });
    assert.equal(report.status, 'completed');
    assert.deepEqual(report.expectations.map((e) => e.result), ['not-met', 'not-met']);
    assert.equal(code, 1);
  });

  // The session hangs, so only the driver's own stop ends it before the timeout would.
  test('the installed devkit beside the working tree voids the run and stops it', async (t) => {
    const { code, report } = await drive(t, {
      fake: { extraPlugins: [{ name: 'vue', source: 'vue@frontend-devkit' }], steps: [editEvent, { hang: true }] },
      args: ['--timeout', '5'],
    });
    assert.equal(report.status, 'invalid');
    assert.match(report.reason, /vue@frontend-devkit/);
    assert.deepEqual(report.expectations, []);
    assert.equal(code, 1);
  });

  test('a session that never reports its plugins is invalid, even with a successful result', async (t) => {
    const { code, report } = await drive(t, { fake: { noInit: true, steps: [editEvent, { result: { subtype: 'success' } }] } });
    assert.equal(report.status, 'invalid');
    assert.match(report.reason, /no init event/);
    assert.equal(code, 1);
  });

  test('a run that hits its ceiling is interrupted, never a pass, even with every expectation met', async (t) => {
    const { code, report } = await drive(t, {
      fake: { steps: [ask('Which language?'), editEvent, { result: { subtype: 'error_max_budget_usd', is_error: true } }] },
    });
    assert.equal(report.status, 'interrupted');
    assert.match(report.reason, /error_max_budget_usd/);
    assert.deepEqual(report.expectations, []);
    assert.deepEqual(report.observedBeforeInterruption.map((e) => e.result), ['met', 'met']);
    assert.equal(code, 1);
  });

  test('a session that ends without a result is interrupted', async (t) => {
    const { code, report } = await drive(t, { fake: { steps: [editEvent, { exit: 3 }] } });
    assert.equal(report.status, 'interrupted');
    assert.match(report.reason, /without a result \(exit 3\)/);
    assert.equal(code, 1);
  });

  test('a timeout is interrupted, and the session is stopped', async (t) => {
    const { code, report, log } = await drive(t, { fake: { steps: [{ hang: true }] }, args: ['--timeout', '0.5'] });
    assert.equal(report.status, 'interrupted');
    assert.match(report.reason, /timed out after 0.5 s/);
    assert.equal(code, 1);
    assert.throws(() => process.kill(log[0].pid, 0), { code: 'ESRCH' });
  });

  test('a missing claude binary is an error reported as NOT RUN', async (t) => {
    const { code, report } = await drive(t, { args: ['--claude', path.join(REPO_ROOT, 'no-such-dir', 'claude')] });
    assert.equal(report.status, 'error');
    assert.match(report.reason, /^NOT RUN: .*not found/);
    assert.deepEqual(report.expectations, []);
    assert.equal(code, 1);
  });

  for (const [what, scenario, args, message] of [
    ['no scenario file', null, [], /no scenario file given/],
    ['an unreadable scenario', null, ['missing.md'], /cannot read/],
    ['a scenario that does not parse', '# demo\n## Expect\n- tool-called Edit\n', [], /no "## Prompt" section/],
    ['an unknown pack', SCENARIO + '\n## Options\n- packs: react\n', [], /no pack "react"/],
    ['a budget that is not positive', SCENARIO, ['--budget', '-1'], /--budget is a positive number/],
    ['an unknown option', SCENARIO, ['--fast'], /unknown option --fast/],
  ]) {
    test(`${what} is a usage error, exit 2, with no run directory`, async (t) => {
      const dir = tempDir(t);
      const tmp = path.join(dir, 'tmp');
      fs.mkdirSync(tmp);
      if (scenario) write(dir, { 'scenario.md': scenario });
      const res = await runScriptAsync(DRIVER, { args: [...(scenario ? [path.join(dir, 'scenario.md')] : []), ...args], env: isolatedEnv(tmp), cwd: dir });
      assert.equal(res.code, 2);
      assert.match(res.stderr, message);
      assert.deepEqual(fs.readdirSync(tmp), []);
    });
  }
});

describe('a write target is inside the scratch repository only after every link resolves', () => {
  test('relative, absolute and .. paths', (t) => {
    const repo = tempDir(t);
    assert.equal(insideRepo(repo, 'src/new/deep.js'), true);
    assert.equal(insideRepo(repo, path.join(repo, 'a.js')), true);
    assert.equal(insideRepo(repo, 'src/../../x.js'), false);
    assert.equal(insideRepo(repo, path.join(path.dirname(repo), 'x.js')), false);
    assert.equal(insideRepo(repo, ''), false);
    assert.equal(insideRepo(repo, undefined), false);
    // A sibling whose name starts with the repository's is not inside it.
    assert.equal(insideRepo(repo, `${repo}-other/x.js`), false);
  });

  test('a link out of the repository, existing or dangling, is outside', (t) => {
    const repo = tempDir(t);
    const elsewhere = tempDir(t);
    try {
      fs.symlinkSync(elsewhere, path.join(repo, 'out'), 'dir');
      fs.symlinkSync(path.join(elsewhere, 'gone.js'), path.join(repo, 'dangling.js'), 'file');
    } catch (e) {
      if (e.code === 'EPERM') return t.skip('creating a symlink needs privileges on this system');
      throw e;
    }
    assert.equal(insideRepo(repo, 'out/new.js'), false);
    assert.equal(insideRepo(repo, 'dangling.js'), false);
  });

  // npm installs claude as a .cmd shim, which only a shell can start; the driver starts none.
  test('on Windows an .exe is started, a .cmd shim is named with the way around it, nothing found is not found', () => {
    assert.deepEqual(pickWindowsBinary('C:\\Users\\Dev\\.local\\bin\\claude.exe\r\n', 'claude'), { path: 'C:\\Users\\Dev\\.local\\bin\\claude.exe' });
    assert.deepEqual(
      pickWindowsBinary('C:\\Users\\Dev\\AppData\\Roaming\\npm\\claude\r\nC:\\Users\\Dev\\AppData\\Roaming\\npm\\claude.cmd\r\n', 'claude'),
      { reason: "NOT RUN: claude is a .cmd shim (C:\\Users\\Dev\\AppData\\Roaming\\npm\\claude.cmd), which needs a shell; pass --claude <claude.exe or the package's cli.js>" },
    );
    assert.deepEqual(pickWindowsBinary('', 'claude'), { reason: 'NOT RUN: claude not found' });
  });

  test('Windows paths compare case-insensitively, with either separator', () => {
    const w = path.win32;
    assert.equal(isInside('C:\\Users\\Dev\\Temp\\run\\repo', 'c:\\users\\dev\\temp\\run\\REPO\\src\\a.js', w), true);
    assert.equal(isInside('C:\\Users\\Dev\\Temp\\run\\repo', 'C:/Users/Dev/Temp/run/repo/src/a.js', w), true);
    assert.equal(isInside('C:\\Users\\Dev\\Temp\\run\\repo', 'C:\\Users\\Dev\\Temp\\run\\other\\a.js', w), false);
    assert.equal(isInside('C:\\Users\\Dev\\Temp\\run\\repo', 'D:\\Users\\Dev\\Temp\\run\\repo\\a.js', w), false);
  });
});
