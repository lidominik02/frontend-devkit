// project-facts describes a project from the files it already maintains. Skills
// inject its output, and a non-zero exit from an injected command aborts the
// whole skill, so exit 0 on any input is the contract, not a nicety.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { pathToFileURL } from 'node:url';

import { REPO_ROOT, gitRepo, isolatedEnv, runScript, tempDir } from './helpers.mjs';

const SCRIPTS = path.join(REPO_ROOT, 'plugins', 'core', 'scripts');
const FACTS = path.join(SCRIPTS, 'project-facts.mjs');
const RUN_GATES = path.join(SCRIPTS, 'run-gates.mjs');
const VERIFY = path.join(SCRIPTS, 'verify-before-done.mjs');

const { detect, isEntry } = await import(pathToFileURL(FACTS).href);

const PASS = 'node -e "process.exit(0)"';
const FAIL = 'node -e "process.exit(1)"';

// Writes each file relative to a fresh directory; a key ending in `/` is a directory.
function writeTree(dir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(dir, rel);
    if (rel.endsWith('/')) {
      fs.mkdirSync(p, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return dir;
}

const project = (t, files = {}) => writeTree(tempDir(t), files);
const pkg = (obj) => JSON.stringify(obj);

function factsCli(dir) {
  return runScript(FACTS, { env: { CLAUDE_PROJECT_DIR: dir } });
}

function gates(t, dir, ...args) {
  return runScript(RUN_GATES, { args, env: { CLAUDE_PROJECT_DIR: dir, ...isolatedEnv(tempDir(t)) } });
}

function expectExit0(dir) {
  const res = factsCli(dir);
  assert.equal(res.code, 0, `exit=${res.code}; stderr: ${res.stderr.trim()}`);
}

describe('project-facts: must describe any project without config, and never throw', () => {
  test('succeeds in this repository', () => expectExit0(REPO_ROOT));
  test('succeeds in an empty directory', (t) => expectExit0(tempDir(t)));

  // Only running a gate can say it is available.
  test('a declared gate never claims available:true', (t) => {
    const scripts = { lint: PASS, test: PASS, typecheck: PASS, build: PASS };
    const { gates } = detect(project(t, { 'package.json': pkg({ scripts }) }));
    for (const name of Object.keys(scripts)) {
      assert.equal(gates[name].declared, true, `${name} is not declared`);
      assert.equal(gates[name].available, null, `${name} claims available: ${gates[name].available}`);
    }
  });

  // Inside a git hook, an inherited GIT_INDEX_FILE would point a script's own git at the caller's index.
  test('a script under test does not inherit GIT_* from the test runner', (t) => {
    const probe = path.join(tempDir(t), 'probe.mjs');
    fs.writeFileSync(probe, 'process.stdout.write(String(process.env.GIT_INDEX_FILE));\n');
    const saved = process.env.GIT_INDEX_FILE;
    process.env.GIT_INDEX_FILE = path.join(tempDir(t), 'index');
    t.after(() => {
      if (saved === undefined) delete process.env.GIT_INDEX_FILE;
      else process.env.GIT_INDEX_FILE = saved;
    });
    assert.equal(runScript(probe).stdout, 'undefined');
  });
});

describe('project-facts: the injected script exits 0 on broken input', () => {
  for (const [name, files] of [
    ['empty dir, no git', {}],
    ['malformed package.json', { 'package.json': '{ not json at all' }],
    ['literal null package.json', { 'package.json': 'null' }],
    ['wrong types in package.json', { 'package.json': '{"scripts":null}' }],
  ]) {
    test(name, (t) => expectExit0(project(t, files)));
  }

  // A .mcp.json is written by hand far more often than package.json is.
  for (const [name, mcp, settings] of [
    ['malformed .mcp.json', '{ broken'],
    ['literal null .mcp.json', 'null'],
    ['null mcpServers', '{"mcpServers":null}'],
    ['server entry is not an object', '{"mcpServers":{"a":1}}'],
    ['malformed settings.json alongside', '{"mcpServers":{}}', '{ broken'],
  ]) {
    test(name, (t) => {
      const files = { 'package.json': pkg({ name: 'x' }), '.mcp.json': mcp };
      if (settings !== undefined) files['.claude/settings.json'] = settings;
      expectExit0(project(t, files));
    });
  }

  // run-gates exits 1 by design on a failing gate, so it must never be injected.
  test('run-gates, by contrast, exits 1 on a failing gate', (t) => {
    const dir = writeTree(gitRepo(t), { 'package.json': pkg({ scripts: { lint: FAIL } }) });
    assert.equal(gates(t, dir, '--gate', 'lint').code, 1);
  });
});

// Detected from the project's own scripts like the dev server, and never a gate:
// it starts a watcher. storybook:build is a one-shot build, not the server.
describe('project-facts: storybook', () => {
  const storybookOf = (t, files) => {
    const s = detect(project(t, files)).storybook;
    return [s.declared, s.command, s.configPresent];
  };

  test('a storybook script is detected and configPresent read', (t) => {
    const files = { 'package.json': pkg({ scripts: { storybook: 'storybook dev -p 6006' } }), '.storybook/': null };
    assert.deepEqual(storybookOf(t, files), [true, 'npm run storybook', true]);
  });

  test('storybook:build alone does not count as the server', (t) => {
    const files = { 'package.json': pkg({ scripts: { 'storybook:build': 'storybook build' } }) };
    assert.deepEqual(storybookOf(t, files), [false, null, false]);
  });

  test('no storybook script reports declared false', (t) => {
    const files = { 'package.json': pkg({ scripts: { lint: 'eslint .' } }) };
    assert.deepEqual(storybookOf(t, files), [false, null, false]);
  });

  test('the storybook script is not picked up as a gate', (t) => {
    const dir = project(t, { 'package.json': pkg({ scripts: { storybook: 'storybook dev', lint: PASS } }) });
    assert.doesNotMatch(gates(t, dir, '--list', '--stage', 'release').stdout, / storybook /);
  });

  // A root script that delegates through --filter has a null `workspace`, yet
  // .storybook/ lives under the workspace.
  test('configPresent finds .storybook under a workspace, not only the root', (t) => {
    const dir = project(t, {
      'package.json': pkg({ name: 'r', workspaces: ['apps/*'], scripts: { storybook: 'pnpm --filter web storybook' } }),
      'apps/web/.storybook/': null,
      'apps/web/package.json': '{}',
    });
    assert.equal(detect(dir).storybook.configPresent, true);
  });
});

// Whether the design tool's MCP is present in the calling session is unknowable
// from disk, so `available` stays null rather than reading as "none present".
describe('project-facts: designReference', () => {
  test('a project-local skill is listed, and available stays null', (t) => {
    const dir = project(t, { 'package.json': '{}', '.claude/skills/web-fe-design/SKILL.md': 'x' });
    const r = detect(dir).designReference;
    assert.deepEqual([r.projectSkills, r.declared, r.skill, r.available], [['web-fe-design'], true, null, null]);
  });

  test('a project with no .claude/skills reports an empty list', (t) => {
    const dir = project(t, { 'package.json': '{}' });
    assert.deepEqual(detect(dir).designReference.projectSkills, []);
  });
});

// A caller applies its own default when this is null.
describe('project-facts: userStoryPath', () => {
  test('defaults to null, never a guessed path', (t) => {
    assert.equal(detect(project(t, { 'package.json': '{}' })).userStoryPath, null);
  });
});

// A meta-framework must never report as the view library it builds on: every
// Nuxt app also depends on vue, and the SPA guidance inverts under SSR.
describe('project-facts: the stack names the stack, and packs map it to packs', () => {
  for (const [name, deps, expected] of [
    ['nuxt reports stack nuxt and both packs, general first', { nuxt: '^4', vue: '^3' }, ['nuxt', ['vue', 'nuxt']]],
    ['vue alone reports vue-spa and only the vue pack', { vue: '^3' }, ['vue-spa', ['vue']]],
    ['next outranks react, and no pack serves it yet', { next: '^15', react: '^19' }, ['next', []]],
    ['react alone reports react-spa', { react: '^19' }, ['react-spa', []]],
  ]) {
    test(name, (t) => {
      const s = detect(project(t, { 'package.json': pkg({ dependencies: deps }) })).stack;
      assert.deepEqual([s.stack, s.packs], expected);
    });
  }

  test('no framework reports a null stack and no packs', (t) => {
    const s = detect(project(t, { 'package.json': '{}' })).stack;
    assert.deepEqual([s.stack, s.packs], [null, []]);
  });
});

describe('project-facts: the lockfile names the package manager when package.json declares none', () => {
  for (const [lockfile, expected] of [
    ['bun.lock', ['bun', 'bun.lock']],
    ['npm-shrinkwrap.json', ['npm', 'npm-shrinkwrap.json']],
  ]) {
    test(`${lockfile} reports ${expected[0]}`, (t) => {
      const p = detect(project(t, { 'package.json': pkg({ name: 'x' }), [lockfile]: '' })).packageManager;
      assert.deepEqual([p.name, p.source], expected);
    });
  }
});

// Declared by .mcp.json and approved by settings are different questions: a
// declared server that settings switch off has no tools at all.
describe('project-facts: browserTools', () => {
  const CDP = pkg({ mcpServers: { 'chrome-devtools': { command: 'npx', args: ['-y', 'chrome-devtools-mcp@latest'] } } });
  const CDP_ROW = (approved) => [true, true, [['chrome-devtools', 'mcp__chrome-devtools__', approved]]];

  const browserOf = (t, { mcp, settings, local } = {}) => {
    const files = { 'package.json': pkg({ name: 'x' }) };
    if (mcp !== undefined) files['.mcp.json'] = mcp;
    if (settings !== undefined) files['.claude/settings.json'] = settings;
    if (local !== undefined) files['.claude/settings.local.json'] = local;
    const b = detect(project(t, files)).browserTools;
    return [b.declared, b.parsed, b.servers.map((s) => [s.kind, s.toolPrefix, s.approved])];
  };

  for (const [name, input, expected] of [
    ['an enabled chrome-devtools server reports approved',
      { mcp: CDP, settings: pkg({ enabledMcpjsonServers: ['chrome-devtools'] }) }, CDP_ROW(true)],
    ['an explicit disable beats enableAllProjectMcpServers',
      { mcp: CDP, settings: pkg({ disabledMcpjsonServers: ['chrome-devtools'], enableAllProjectMcpServers: true }) },
      CDP_ROW(false)],
    // The trust prompt records its answer in the user's config, so silence here is no information.
    ['a declared server no settings mention reports approval unknown', { mcp: CDP }, CDP_ROW(null)],
    // The key is user-chosen; a grant written against the package name would match nothing.
    ['the tool prefix is built from the server key, not the package',
      {
        mcp: pkg({ mcpServers: { browser: { command: 'npx', args: ['@playwright/mcp@latest'] } } }),
        settings: pkg({ enableAllProjectMcpServers: true }),
      },
      [true, true, [['playwright', 'mcp__browser__', true]]]],
    ['an unparseable .mcp.json reports parsed:false, not merely empty', { mcp: '{ broken' }, [false, false, []]],
    ['no .mcp.json at all reports parsed:null', {}, [false, null, []]],
    // A disable in any settings file rejects the server; the enables are a union, not a ranking.
    ['a disable in the committed settings survives an enable in settings.local.json',
      {
        mcp: CDP,
        settings: pkg({ disabledMcpjsonServers: ['chrome-devtools'] }),
        local: pkg({ enabledMcpjsonServers: ['chrome-devtools'] }),
      },
      CDP_ROW(false)],
    ['a disable survives enableAllProjectMcpServers in a later file',
      {
        mcp: CDP,
        settings: pkg({ disabledMcpjsonServers: ['chrome-devtools'] }),
        local: pkg({ enableAllProjectMcpServers: true }),
      },
      CDP_ROW(false)],
    ['settings.local.json alone can approve a server',
      { mcp: CDP, local: pkg({ enabledMcpjsonServers: ['chrome-devtools'] }) }, CDP_ROW(true)],
    // Claude Code replaces every character outside [A-Za-z0-9_-] with an underscore
    // before building the tool name and before matching an approval list.
    ['an unusual server key is sanitised in the tool prefix and in approval matching',
      {
        mcp: pkg({ mcpServers: { 'chrome.devtools': { command: 'npx', args: ['-y', 'chrome-devtools-mcp@1.9.0'] } } }),
        settings: pkg({ enabledMcpjsonServers: ['chrome_devtools'] }),
      },
      [true, true, [['chrome-devtools', 'mcp__chrome_devtools__', true]]]],
    ['a .mcp.json holding literal null is valid JSON and reports parsed:true', { mcp: 'null' }, [false, true, []]],
    ['an array-valued mcpServers does not produce a server keyed by its index',
      { mcp: pkg({ mcpServers: [{ command: 'npx', args: ['chrome-devtools-mcp'] }] }) }, [false, true, []]],
  ]) {
    test(name, (t) => assert.deepEqual(browserOf(t, input), expected));
  }

  // A user-scope install serves every project and appears in no file here.
  test('available stays null, never inferred from disk', (t) => {
    assert.equal(detect(project(t, { 'package.json': pkg({ name: 'x' }) })).browserTools.available, null);
  });
});

// Detected like a gate and emphatically not one: every dev script starts a watcher.
describe('project-facts: devServer', () => {
  const devOf = (t, root, workspace) => {
    const files = { 'package.json': pkg(root) };
    if (workspace) files['apps/web/package.json'] = pkg(workspace);
    return detect(project(t, files)).devServer;
  };

  for (const [name, root, workspace, expected] of [
    ['a dev script naming no port reports declaredPort null, not a default', { scripts: { dev: 'vite' } }, null, [true, null]],
    ['reads --port from the dev script', { scripts: { dev: 'vite --port 4200' } }, null, [true, 4200]],
    ['reads -p from the dev script', { scripts: { dev: 'next dev -p 3100' } }, null, [true, 3100]],
    ['reads a PORT= prefix, and falls back to the serve alias', { scripts: { serve: 'PORT=8080 node server.js' } }, null, [true, 8080]],
    ['a project with no dev script reports declared false', { scripts: { lint: 'eslint .' } }, null, [false, null]],
    ['reads the --port=N spelling', { scripts: { dev: 'vite --port=5180' } }, null, [true, 5180]],
    // Truncating a longer number to a plausible port sends the loop to a URL nothing serves.
    ['a number too long to be a port reports null, not a truncation', { scripts: { dev: 'vite --port 123456' } }, null, [true, null]],
    // The stack walks workspace packages, so the dev server must walk the same ones.
    ['a monorepo dev script in a workspace package is found',
      { name: 'r', workspaces: ['apps/*'] }, { scripts: { dev: 'nuxt dev --port 3000' } }, [true, 3000]],
    ['a workspace package is not searched when the repo is not a monorepo',
      { name: 'r' }, { scripts: { dev: 'nuxt dev' } }, [false, null]],
  ]) {
    test(name, (t) => {
      const s = devOf(t, root, workspace);
      assert.deepEqual([s.declared, s.declaredPort], expected);
    });
  }

  // `start` commonly serves a build, so a loop verifying against it sees the last build.
  for (const [name, root, workspace, expected] of [
    ['the matched alias is reported, not just the command', { scripts: { start: 'vite preview' } }, null, ['start', null]],
    ['an empty dev script does not win over a real one', { scripts: { dev: '  ', start: 'vite preview' } }, null, ['start', null]],
    ['the workspace holding the dev script is reported',
      { name: 'r', workspaces: ['apps/*'] }, { scripts: { dev: 'nuxt dev' } }, ['dev', 'apps/web']],
  ]) {
    test(name, (t) => {
      const s = devOf(t, root, workspace);
      assert.deepEqual([s.alias, s.workspace], expected);
    });
  }

  test('the dev script is not picked up as a gate, since running it would hang', (t) => {
    const dir = project(t, { 'package.json': pkg({ scripts: { dev: 'vite', lint: PASS } }) });
    assert.doesNotMatch(gates(t, dir, '--list', '--stage', 'release').stdout, / dev /);
  });
});

// The plugin cache lives under the user's home, which can hold a space, a
// non-ASCII character or a symlink; the CLI must still recognise itself there.
describe('project-facts: the CLI runs from any install path, and stays silent when imported', () => {
  function copyInto(dir) {
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'project-facts.mjs');
    fs.copyFileSync(FACTS, file);
    return file;
  }

  function expectFacts(script, dir) {
    const res = runScript(script, { cwd: dir, env: { CLAUDE_PROJECT_DIR: dir } });
    assert.equal(res.code, 0, `stderr: ${res.stderr.trim()}`);
    assert.equal(JSON.parse(res.stdout).dir, dir);
  }

  for (const sub of ['with space', 'ékezet']) {
    test(`a copy under "${sub}/" prints the facts`, (t) => {
      const root = tempDir(t);
      expectFacts(copyInto(path.join(root, sub)), project(t, { 'package.json': pkg({ name: 'x' }) }));
    });
  }

  test('a copy reached through a symlinked directory prints the facts', (t) => {
    const root = tempDir(t);
    copyInto(path.join(root, 'real'));
    const link = path.join(root, 'link');
    try {
      fs.symlinkSync(path.join(root, 'real'), link, 'junction');
    } catch (err) {
      if (err.code === 'EPERM') return t.skip('creating a symlink needs a privilege this account lacks');
      throw err;
    }
    expectFacts(path.join(link, 'project-facts.mjs'), project(t, { 'package.json': pkg({ name: 'x' }) }));
  });

  test('importing the module writes nothing to stdout', (t) => {
    const importer = path.join(tempDir(t), 'importer.mjs');
    fs.writeFileSync(importer, `await import(${JSON.stringify(pathToFileURL(FACTS).href)});\n`);
    const res = runScript(importer);
    assert.equal(res.code, 0, `stderr: ${res.stderr.trim()}`);
    assert.equal(res.stdout, '');
  });

  // With no entry script, process.argv[1] is undefined.
  test('importing it with no entry script neither throws nor prints', () => {
    const code = `await import(${JSON.stringify(pathToFileURL(FACTS).href)});`;
    const res = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: REPO_ROOT, encoding: 'utf8' });
    if (res.error) throw res.error;
    assert.equal(res.status, 0, `stderr: ${res.stderr.trim()}`);
    assert.equal(res.stdout, '');
  });

  // run-gates imports detect, and the Stop hook runs run-gates.
  test('run-gates importing it prints only its own output', (t) => {
    const dir = project(t, { 'package.json': pkg({ scripts: { lint: PASS } }) });
    const res = gates(t, dir, '--json', '--gate', 'lint');
    assert.equal(res.code, 0, `stderr: ${res.stderr.trim()}`);
    const out = JSON.parse(res.stdout);
    assert.equal(out.projectRoot, undefined);
  });
});

// The fallback for Node before 22.18. The suite runs where import.meta.main
// exists, so only a direct call exercises it.
describe('project-facts: isEntry recognises the entry script by its real path', () => {
  for (const sub of ['with space', 'ékezet']) {
    test(`a script under "${sub}/" is the entry`, (t) => {
      const file = path.join(tempDir(t), sub, 'entry.mjs');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, '');
      assert.equal(isEntry(pathToFileURL(fs.realpathSync(file)).href, file), true);
    });
  }

  test('a script reached through a symlinked directory is the entry', (t) => {
    const root = tempDir(t);
    fs.mkdirSync(path.join(root, 'real'));
    const file = path.join(root, 'real', 'entry.mjs');
    fs.writeFileSync(file, '');
    const link = path.join(root, 'link');
    try {
      fs.symlinkSync(path.join(root, 'real'), link, 'junction');
    } catch (err) {
      if (err.code === 'EPERM') return t.skip('creating a symlink needs a privilege this account lacks');
      throw err;
    }
    assert.equal(isEntry(pathToFileURL(fs.realpathSync(file)).href, path.join(link, 'entry.mjs')), true);
  });

  test('another script is not the entry', (t) => {
    const dir = tempDir(t);
    fs.writeFileSync(path.join(dir, 'a.mjs'), '');
    fs.writeFileSync(path.join(dir, 'b.mjs'), '');
    assert.equal(isEntry(pathToFileURL(fs.realpathSync(path.join(dir, 'a.mjs'))).href, path.join(dir, 'b.mjs')), false);
  });

  test('no argv[1] is not the entry', () => {
    assert.equal(isEntry(pathToFileURL(FACTS).href, undefined), false);
  });

  // `node -e "..." x` sets argv[1] to "x", which names no file.
  test('an argv[1] that is not a path is not the entry, and does not throw', (t) => {
    const missing = path.join(tempDir(t), 'x');
    assert.equal(isEntry(pathToFileURL(FACTS).href, missing), false);
    assert.equal(isEntry(pathToFileURL(FACTS).href, 'x'), false);
  });
});

// Below the git top level with no package.json, or outside git with none, is a
// wrong directory. A git top level with no package.json is a real project.
describe('project-facts / run-gates: a wrong working directory is not a project without gates', () => {
  function fixture(t) {
    const repo = writeTree(gitRepo(t), { 'pkg/package.json': '{}', 'sub/dir/tsconfig.json': '{}' });
    return { repo, sub: path.join(repo, 'sub', 'dir'), noGit: tempDir(t) };
  }

  const rootOf = (dir) => {
    const f = detect(dir);
    const wrong = (s) => s.startsWith('not a project root');
    return [f.projectRoot.isRoot, wrong(f.gates.lint.source), wrong(f.devServer.source)];
  };

  test('a git top level with no package.json stays a project', (t) => {
    assert.deepEqual(rootOf(fixture(t).repo), [true, false, false]);
  });
  test('below the git top level with no package.json is not a project root', (t) => {
    assert.deepEqual(rootOf(fixture(t).sub), [false, true, true]);
  });
  test('outside git with no package.json is not a project root', (t) => {
    assert.deepEqual(rootOf(fixture(t).noGit), [false, true, true]);
  });
  test('a subdirectory with its own package.json is a project', (t) => {
    assert.deepEqual(rootOf(path.join(fixture(t).repo, 'pkg')), [true, false, false]);
  });

  test('the injected script exits 0 below the git top level', (t) => expectExit0(fixture(t).sub));
  test('the injected script exits 0 in a directory that does not exist', (t) => {
    expectExit0(path.join(fixture(t).noGit, 'gone'));
  });

  test('run-gates --list says it is not a project root, not that a script is missing', (t) => {
    const out = gates(t, fixture(t).sub, '--list').stdout;
    assert.match(out, /not a project root/);
    assert.doesNotMatch(out, /has no [a-z]* script/);
  });

  // Exit 1, so it cannot pass; not blocking, so the Stop hook stays silent there.
  for (const [name, pick] of [
    ['below the git top level', (f) => f.sub],
    ['outside git', (f) => f.noGit],
  ]) {
    test(`run-gates exits 1 with non-blocking not-run results ${name}`, (t) => {
      const res = gates(t, pick(fixture(t)), '--json');
      assert.equal(res.code, 1);
      const r = JSON.parse(res.stdout);
      assert.equal(r.passed, false);
      assert.equal(r.project.root, false);
      assert.equal(r.typecheckMissing, false);
      assert.ok(r.results.length > 0);
      for (const x of r.results) {
        assert.equal(x.status, 'not-run');
        assert.equal(x.blocking, false);
        assert.ok(x.reason.startsWith('not a project root'), x.reason);
      }
    });
  }

  test('run-gates at a git top level with no package.json still reports no lint script', (t) => {
    assert.match(gates(t, fixture(t).repo, '--list').stdout, /this project has no lint script/);
  });
  test('run-gates at a git top level with no package.json exits 0', (t) => {
    assert.equal(gates(t, fixture(t).repo).code, 0);
  });

  test('the Stop hook stays silent in a wrong directory', (t) => {
    const { sub } = fixture(t);
    const res = runScript(VERIFY, {
      input: JSON.stringify({ stop_hook_active: false }),
      env: { CLAUDE_PROJECT_DIR: sub, ...isolatedEnv(tempDir(t)) },
    });
    assert.equal(res.code, 0, `stderr: ${res.stderr.trim()}`);
    assert.equal(res.stdout, '');
  });
});
