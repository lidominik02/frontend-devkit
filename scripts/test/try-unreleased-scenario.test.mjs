// A scenario's expectations decide whether a /try-unreleased run passed, so a check that
// cannot fail, or a scenario that silently drops an expectation, reports a broken lifecycle as working.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { REPO_ROOT, tempDir, write } from './helpers.mjs';
import { KINDS, answerFor, checkExpectations, parseScenario } from '../../.claude/skills/try-unreleased/scripts/scenario.mjs';

const SCENARIOS = path.join(REPO_ROOT, '.claude', 'skills', 'try-unreleased', 'scenarios');

// A kept scenario that no longer parses fails only when someone runs it before a release.
describe('every kept scenario parses, with only expectation kinds the driver checks', () => {
  const files = fs.readdirSync(SCENARIOS).filter((f) => f.endsWith('.md'));

  test('the first three scenarios are kept', () => {
    for (const name of ['bounded-change', 'open-task-continue', 'stop-hook-failing-gate']) assert.ok(files.includes(`${name}.md`), name);
  });

  // validate's references check reads only the packs, so a renamed scenario another skill runs
  // would surface only after the user agreed to a billed run.
  test('every scenario a repo-local skill names exists', () => {
    const skills = path.join(REPO_ROOT, '.claude', 'skills');
    const cited = fs.readdirSync(skills)
      .map((d) => path.join(skills, d, 'SKILL.md'))
      .filter((f) => fs.existsSync(f))
      .flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(/try-unreleased\/scenarios\/([a-z0-9-]+\.md)/g)].map((m) => [path.relative(REPO_ROOT, f), m[1]]));
    assert.ok(cited.length >= 2, 'no scenario citation found');
    for (const [from, file] of cited) assert.ok(files.includes(file), `${from} names scenarios/${file}, which does not exist`);
  });

  for (const file of files) {
    test(file, () => {
      const s = parseScenario(fs.readFileSync(path.join(SCENARIOS, file), 'utf8'));
      assert.equal(`${s.name}.md`, file);
      for (const e of s.expect) assert.ok(Object.hasOwn(KINDS, e.kind), `${file}: unknown kind ${e.kind}`);
    });
  }
});

const scenario = (sections) => `# demo\n\nA description.\n\n## Prompt\nDo the thing.\n\n${sections}`;
const expectOnly = (...items) => parseScenario(scenario(`## Expect\n${items.map((i) => `- ${i}`).join('\n')}\n`));

describe('parseScenario', () => {
  test('reads every section, keeping a fixture file that holds a fence of its own', () => {
    const text = [
      '# open-task',
      '',
      '## Fixture',
      '### temp/feat/planning/PLAN.md',
      '````md',
      '# Plan',
      '',
      '```',
      'node run.mjs',
      '```',
      '## Not a section',
      '````',
      '',
      '### src/empty.js',
      '```',
      '```',
      '',
      '## Prompt',
      'Continue the plan.',
      '',
      'Second paragraph.',
      '',
      '## Answers',
      '- Which mode? → Inline',
      '- Pause → Continue',
      '',
      '## Expect',
      '- file-exists src/empty.js',
      '- hook-blocked Stop /gates are failing/i',
      '- form-asked /mode with spaces/',
      '',
      '## Options',
      '- model: haiku',
      '- budget: 0.5',
      '- packs: core, vue',
      '',
    ].join('\n');
    const s = parseScenario(text);
    assert.equal(s.name, 'open-task');
    assert.equal(s.prompt, 'Continue the plan.\n\nSecond paragraph.');
    assert.deepEqual(s.fixture, [
      { path: 'temp/feat/planning/PLAN.md', content: '# Plan\n\n```\nnode run.mjs\n```\n## Not a section\n' },
      { path: 'src/empty.js', content: '' },
    ]);
    assert.deepEqual(s.answers, [
      { match: 'Which mode?', label: 'Inline' },
      { match: 'Pause', label: 'Continue' },
    ]);
    assert.deepEqual(s.expect[1], { kind: 'hook-blocked', args: ['Stop', /gates are failing/i], text: 'hook-blocked Stop /gates are failing/i' });
    assert.deepEqual(s.expect[2].args, [/mode with spaces/]);
    assert.equal(s.model, 'haiku');
    assert.equal(s.budgetUsd, 0.5);
    assert.deepEqual(s.packs, ['core', 'vue']);
  });

  test('defaults: packs core, no model or budget, no fixture or answers', () => {
    const s = expectOnly('tool-called Edit');
    assert.deepEqual(s.packs, ['core']);
    assert.equal(s.model, undefined);
    assert.equal(s.budgetUsd, undefined);
    assert.deepEqual([s.fixture, s.answers], [[], []]);
  });

  test('CRLF reads as LF', () => {
    assert.deepEqual(parseScenario(scenario('## Expect\n- tool-called Edit\n').replace(/\n/g, '\r\n')), expectOnly('tool-called Edit'));
  });

  test('an unknown kind parses, so the run reports it rather than refusing the file', () => {
    assert.deepEqual(expectOnly('commit-made main').expect[0], { kind: 'commit-made', args: ['main'], text: 'commit-made main' });
  });

  // Each defect is an error naming its line, so the author can find it.
  for (const [what, text, line, message] of [
    ['a missing prompt', '# demo\n\n## Expect\n- tool-called Edit\n', 5, /no "## Prompt" section/],
    ['an empty prompt', '# demo\n## Prompt\n\n## Expect\n- tool-called Edit\n', 2, /"## Prompt" is empty/],
    ['a missing name', '## Prompt\nGo.\n## Expect\n- tool-called Edit\n', 1, /no "# <name>" heading/],
    ['a bad regex', scenario('## Expect\n- form-asked /(unclosed/\n'), 9, /invalid regex/],
    ['a regex without slashes', scenario('## Expect\n- hook-blocked Stop lint\n'), 9, /expected a \/regex\//],
    ['a missing argument', scenario('## Expect\n- file-matches src/a.js\n'), 9, /file-matches expects: path regex/],
    ['no expectation at all', scenario('## Expect\n\n'), 8, /at least one "## Expect" item/],
    ['a misspelt section, which would drop its items', scenario('## Expects\n- tool-called Edit\n'), 8, /unknown section "## Expects"/],
    ['a section twice', scenario('## Expect\n- tool-called Edit\n## Expect\n- tool-called Write\n'), 10, /appears twice/],
    ['a line that is not an item', scenario('## Expect\ntool-called Edit\n'), 9, /only "- " items/],
    ['an answer without an arrow', scenario('## Answers\n- Mode: Inline\n## Expect\n- tool-called Edit\n'), 9, /<question or header> → <label>/],
    ['a fixture path leaving the repository', scenario('## Fixture\n### ../outside.txt\n```\nx\n```\n## Expect\n- tool-called Edit\n'), 9, /not a path inside the scratch repository/],
    ['an absolute fixture path', scenario('## Fixture\n### /etc/x\n```\nx\n```\n## Expect\n- tool-called Edit\n'), 9, /not a path inside/],
    ['a Windows drive path', scenario('## Expect\n- file-exists C:\\x.txt\n'), 9, /not a path inside/],
    ['an expectation path with ..', scenario('## Expect\n- file-exists src/../../x\n'), 9, /not a path inside/],
    ['a fixture file without a code block', scenario('## Fixture\n### a.txt\ntext\n## Expect\n- tool-called Edit\n'), 9, /has no code block/],
    ['an unclosed code block', scenario('## Fixture\n### a.txt\n```\nx\n'), 9, /not closed/],
    ['a fixture file twice', scenario('## Fixture\n### a.txt\n```\n```\n### a.txt\n```\n```\n## Expect\n- tool-called Edit\n'), 12, /in the fixture twice/],
    ['a budget that is not positive', scenario('## Expect\n- tool-called Edit\n## Options\n- budget: 0\n'), 11, /positive number/],
    ['an unknown option', scenario('## Expect\n- tool-called Edit\n## Options\n- timeout: 5\n'), 11, /unknown option "timeout"/],
  ]) {
    test(`${what} is an error at line ${line}`, () => {
      assert.throws(() => parseScenario(text), (e) => e.line === line && message.test(e.message) && e.message.startsWith(`line ${line}: `));
    });
  }
});

describe('answerFor', () => {
  const s = { answers: [{ match: 'pause', label: 'Stop' }] };
  const options = [{ label: 'Continue (Recommended)' }, { label: 'Stop' }];

  test('a scripted answer matches the question text or the header, ignoring case', () => {
    assert.deepEqual(answerFor(s, { question: 'How do we go on after the PAUSE?', header: 'Next', options }), { label: 'Stop', scripted: true });
    assert.deepEqual(answerFor(s, { question: 'How do we go on?', header: 'Pause', options }), { label: 'Stop', scripted: true });
  });

  test('an unscripted question gets its first, recommended, option and is marked unscripted', () => {
    assert.deepEqual(answerFor(s, { question: 'Which mode?', header: 'Mode', options }), { label: 'Continue (Recommended)', scripted: false });
  });

  // A free-text answer no form offered would send the session down a branch nobody scripted.
  test('a scripted label goes back as the offered option, its "(Recommended)" suffix included', () => {
    const go = { answers: [{ match: 'pause', label: 'continue' }] };
    assert.deepEqual(answerFor(go, { question: 'After the pause?', options }), { label: 'Continue (Recommended)', scripted: true });
  });

  test('a matching question that does not offer the label gets its first option, and the miss is named', () => {
    const design = { answers: [{ match: 'design', label: 'Build it' }] };
    const roundOne = { question: 'Is there a design source?', options: [{ label: 'None (Recommended)' }, { label: 'Figma' }] };
    assert.deepEqual(answerFor(design, roundOne), { label: 'None (Recommended)', scripted: false, offScript: 'Build it' });
  });

  test('an answer can match an option label, so it applies wherever that option is offered', () => {
    const build = { answers: [{ match: 'Build it', label: 'Build it' }] };
    const approval = { question: 'Approve this?', header: 'Approval', options: [{ label: 'Change something' }, { label: 'Build it (Recommended)' }] };
    assert.deepEqual(answerFor(build, approval), { label: 'Build it (Recommended)', scripted: true });
  });

  test('a later answer is used when an earlier match does not offer its label', () => {
    const two = { answers: [{ match: 'pause', label: 'Abort' }, { match: 'pause', label: 'Stop' }] };
    assert.deepEqual(answerFor(two, { question: 'After the pause?', options }), { label: 'Stop', scripted: true });
  });
});

describe('checkExpectations', () => {
  const assistant = (...content) => ({ type: 'assistant', message: { content } });
  const tool = (name, input = {}) => ({ type: 'tool_use', name, input });
  const hook = (hook_event, fields) => ({ type: 'system', subtype: 'hook_response', hook_event, exit_code: 0, outcome: 'success', stdout: '', stderr: '', ...fields });
  const ask = (question, header) => ({ questions: [{ question, header, options: [{ label: 'A' }, { label: 'B' }] }] });
  const blockJson = JSON.stringify({ decision: 'block', reason: 'fast gates are failing:\n  - lint: FAILED src/a.js no-undef' });

  const events = [
    { type: 'system', subtype: 'init', plugins: [] },
    assistant({ type: 'text', text: 'hi' }, tool('Edit', { file_path: 'src/a.js' })),
    assistant(tool('Skill', { skill: 'core:clarifying-features' })),
    assistant(tool('AskUserQuestion', ask('Which language are the artifacts in?', 'Language'))),
    { type: 'control_request', request_id: 'r1', request: { subtype: 'can_use_tool', tool_name: 'AskUserQuestion', input: ask('Continue after the pause?', 'Pause') } },
    hook('PreToolUse', {}),
    hook('SessionStart', { output: '{"async": true}', stdout: '{"async": true}' }),
    hook('Stop', { output: blockJson, stdout: blockJson }),
    hook('PostToolUse', { exit_code: 2, stderr: 'frontmatter: unknown field' }),
  ];

  function run(t, ...items) {
    const repoDir = tempDir(t);
    write(repoDir, { 'src/a.js': 'export const b = 1;\n' });
    return checkExpectations(expectOnly(...items), { events, repoDir }).map((r) => r.result);
  }

  for (const [kind, met, notMet] of [
    ['file-exists', 'file-exists src/a.js', 'file-exists src/old.js'],
    ['file-absent', 'file-absent src/old.js', 'file-absent src/a.js'],
    ['file-matches', 'file-matches src/a.js /const b/', 'file-matches src/a.js /const a/'],
    ['file-matches on a missing file', 'file-matches src/a.js /b/', 'file-matches src/gone.js /b/'],
    ['tool-called', 'tool-called Edit', 'tool-called Write'],
    ['skill-called, plugin-qualified or bare', 'skill-called clarifying-features', 'skill-called planning-features'],
    ['skill-called, qualified', 'skill-called core:clarifying-features', 'skill-called vue:clarifying-features'],
    ['hook-blocked, JSON decision', 'hook-blocked Stop /lint: FAILED/', 'hook-blocked Stop /typecheck/'],
    ['hook-blocked, exit 2', 'hook-blocked PostToolUse /unknown field/', 'hook-blocked PreToolUse /.*/'],
    ['form-asked, from a tool_use', 'form-asked /artifacts in/', 'form-asked /which branch/'],
    ['form-asked, from a can_use_tool request, by header', 'form-asked /^Pause$/', 'form-asked /^Mode$/'],
  ]) {
    test(`${kind}: met and not met`, (t) => {
      assert.deepEqual(run(t, met, notMet), ['met', 'not-met']);
    });
  }

  test('a hook that ran without blocking does not count as a block, JSON output or not', (t) => {
    assert.deepEqual(run(t, 'hook-blocked PreToolUse /.*/', 'hook-blocked SessionStart /.*/'), ['not-met', 'not-met']);
  });

  test('every result carries its expectation text and a detail', (t) => {
    const repoDir = tempDir(t);
    const [r] = checkExpectations(expectOnly('tool-called Write'), { events, repoDir });
    assert.deepEqual(r, { text: 'tool-called Write', result: 'not-met', detail: 'Write called 0 time(s)' });
  });

  // After a paid session, one unreadable file must not take the other results with it.
  test('a file that cannot be read makes its own expectation unverifiable, and the rest still report', (t) => {
    if (process.platform === 'win32' || process.getuid?.() === 0) return t.skip('file modes do not deny reading here');
    const repoDir = tempDir(t);
    write(repoDir, { 'src/locked.js': 'x\n' });
    fs.chmodSync(path.join(repoDir, 'src', 'locked.js'), 0o000);
    const results = checkExpectations(expectOnly('file-matches src/locked.js /x/', 'tool-called Edit'), { events, repoDir });
    assert.equal(results[0].result, 'unverifiable');
    assert.match(results[0].detail, /^could not be checked: EACCES/);
    assert.equal(results[1].result, 'met');
  });

  test('an unknown kind is unverifiable, naming the kinds it knows', (t) => {
    const [r] = checkExpectations(expectOnly('commit-made main'), { events, repoDir: tempDir(t) });
    assert.equal(r.result, 'unverifiable');
    assert.match(r.detail, /unknown expectation kind "commit-made".*file-exists/);
  });

  // A run that recorded nothing proves nothing about what the session did.
  test('a stream expectation with no events is unverifiable, never not-met or met', (t) => {
    const results = checkExpectations(expectOnly('tool-called Edit', 'form-asked /x/', 'file-absent src/x.js'), { events: [], repoDir: tempDir(t) });
    assert.deepEqual(results.map((r) => r.result), ['unverifiable', 'unverifiable', 'met']);
  });

  test('hook-blocked without hook events is unverifiable: the run lacked --include-hook-events', (t) => {
    const [r] = checkExpectations(expectOnly('hook-blocked Stop /lint/'), { events: events.filter((e) => e.subtype !== 'hook_response'), repoDir: tempDir(t) });
    assert.equal(r.result, 'unverifiable');
    assert.match(r.detail, /--include-hook-events/);
  });
});
