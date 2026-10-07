#!/usr/bin/env node
// Describes a project by reading the files it already maintains. Nothing is
// added to the repo and nothing is written into it, so every fact is derived
// from a file that exists for the project's own reasons.
//
// detect() returns these top-level keys, in this order:
//
//   dir              the directory being described
//   projectRoot      whether dir is a project root: it has a package.json or a
//                    .claude/project.json, or it is the git top level. When it
//                    is not, every "no script" source below gives the reason.
//   packageManager   package.json "packageManager", else the lockfile
//   stack            dependencies, plus which framework packs serve it
//   baseBranch       git symbolic-ref refs/remotes/origin/HEAD
//   git              the remote URL, plus .gitlab/ or .github/ markers
//   commit           commitlint config, which enforces the convention rather
//                    than describing it
//   changeTemplates  .gitlab/merge_request_templates/ or .github/
//   gates            package.json scripts (aliases resolved). Reported as
//                    DECLARED, never as "available" -- see detectGates.
//   devServer        the script that serves the app, which alias matched, the
//                    workspace it lives in, and any port it names. Declared,
//                    never bound -- see detectDevServer.
//   browserTools     browser MCP servers this PROJECT declares in .mcp.json,
//                    and whether its settings approve them. Declared, never
//                    available -- see detectBrowserTools.
//   storybook        a Storybook script in package.json (aliases resolved),
//                    reported the same way as devServer -- declared, never
//                    bound -- plus whether a .storybook/ config exists.
//   designReference  project-local skills that exist under .claude/skills/.
//                    Whether the design tool's MCP is present in THIS session
//                    is not a fact this script can read at all -- see
//                    detectDesignReference -- so `available` here is always
//                    null; the caller must check its own tool list.
//   userStoryPath    .claude/project.json's userStoryPath override, or null.
//                    No file-based detection exists for this one; a caller
//                    applies its own default when it is null.
//   overrides        .claude/project.json verbatim, or null
//
// Reading from the file that enforces a fact keeps it current; a copy in a
// devkit-owned manifest would drift.
//
// `.claude/project.json` is honoured if present, but only to override what
// detection gets wrong. It is never required.
//
// Usage:  node project-facts.mjs [--json]      (defaults to --json)
// Import: import { detect } from './project-facts.mjs'

import { readFileSync, existsSync, readdirSync, accessSync, constants, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** @typedef {{ command: string|null, script: string|null, source: string, declared: boolean, available: boolean|null }} Gate */

// Canonical gate name -> the script names projects actually use, in preference
// order. Real repos disagree on these spellings (`typecheck` vs `type-check`,
// `test` vs `test:unit`), so the gate is detected rather than assumed.
const GATE_ALIASES = /** @type {Record<string, string[]>} */ ({
  typecheck: ['typecheck', 'type-check', 'types', 'tsc'],
  lint: ['lint', 'eslint'],
  test: ['test', 'test:unit', 'unit', 'vitest', 'jest'],
  build: ['build'],
  format: ['format', 'format:write', 'prettier'],
});
export const GATE_NAMES = Object.keys(GATE_ALIASES);

// The script that serves the app for a human to look at, in preference order.
// `start` is last because in a production-oriented setup it serves a build
// rather than the working tree, which is the wrong thing to verify a change
// against. Deliberately NOT a gate: every one of these starts a watcher, and
// run-gates.mjs refuses those.
const DEV_ALIASES = ['dev', 'serve', 'start'];

// The script that starts Storybook's own dev server, in preference order.
// Deliberately excludes `storybook:build`: that is a one-shot static build, a
// gate-shaped command rather than a server a browser can be pointed at, which
// is the same distinction DEV_ALIASES draws against `start`.
const STORYBOOK_ALIASES = ['storybook', 'storybook:dev', 'sb'];

// Browser MCP servers this devkit knows how to drive, matched on the launch
// command rather than the server key. The key is whatever the author of the
// .mcp.json typed -- `browser`, `devtools`, anything -- while the package name
// is what actually determines which tools appear.
const BROWSER_MCP = /** @type {[RegExp, string][]} */ ([
  [/chrome-devtools-mcp/, 'chrome-devtools'],
  [/@playwright\/mcp|playwright-mcp/, 'playwright'],
]);

// Claude Code sanitises a server name before it appears in a tool name or is
// compared against an approval list: every character outside [A-Za-z0-9_-]
// becomes an underscore. Reproducing that here is what keeps `toolPrefix` and
// `approved` true for a key the author typed as `chrome.devtools` -- which is
// the only case this field exists for, since the recommended keys need no
// normalising.
/** @param {unknown} k */
function mcpName(k) {
  return String(k).replace(/[^A-Za-z0-9_-]/g, '_');
}

/** @param {string} dir @param {string[]} args */
function git(dir, args) {
  const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  return r.status === 0 ? String(r.stdout).trim() : null;
}

/** @param {string} bin */
function onPath(bin) {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  return spawnSync(probe, [bin], { stdio: 'ignore' }).status === 0;
}

// Returns null on anything it cannot parse, which includes a valid JSONC file
// with comments in it -- real tsconfig.json files often are. Callers must treat
// null as "unknown", never as "empty".
/** @param {string} p */
export function readJson(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

/** @param {string} dir */
function detectPackageManager(dir) {
  const pkg = readJson(path.join(dir, 'package.json'));
  // Corepack's "packageManager": "pnpm@10.6.1" is authoritative: it is what
  // actually runs.
  const declared = typeof pkg?.packageManager === 'string' ? pkg.packageManager.split('@')[0] : null;
  if (declared) return { name: declared, source: 'package.json packageManager' };
  for (const [file, name] of [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lockb', 'bun'],
    ['bun.lock', 'bun'],
    ['package-lock.json', 'npm'],
    ['npm-shrinkwrap.json', 'npm'],
  ]) {
    if (existsSync(path.join(dir, String(file)))) return { name: String(name), source: String(file) };
  }
  return { name: null, source: 'not detected' };
}

/** @param {string} pm @param {string} script */
function runCommand(pm, script) {
  if (pm === 'yarn') return `yarn ${script}`;
  return `${pm ?? 'npm'} run ${script}`;
}

/** @param {string} dir @returns {Record<string, Gate>} */
function detectGates(dir, pm) {
  const pkg = readJson(path.join(dir, 'package.json'));
  const scripts = pkg?.scripts ?? {};
  /** @type {Record<string, Gate>} */
  const gates = {};
  for (const [canonical, candidates] of Object.entries(GATE_ALIASES)) {
    const found = candidates.find((s) => typeof scripts[s] === 'string');
    // `declared` means the project names this gate. `available` stays null
    // ("unknown until run") because a script name says nothing about whether
    // its binary resolves -- only run-gates.mjs, having executed the command,
    // can answer that.
    gates[canonical] = found
      ? {
          command: runCommand(pm, found),
          script: String(scripts[found]),
          source: `package.json script "${found}"`,
          declared: true,
          available: null,
        }
      : { command: null, script: null, source: 'no matching script in package.json', declared: false, available: false };
  }
  return gates;
}

// The workspace packages a monorepo's root package.json does not itself hold.
// Shared by stack and dev-server detection so the two cannot disagree about
// where a project's real package lives -- reporting a framework and no dev
// server in one breath is the exact drift this file exists to prevent.
/** @param {string} dir @returns {{rel: string, pkg: Record<string, any>}[]} */
function workspacePackages(dir) {
  const found = /** @type {{rel: string, pkg: Record<string, any>}[]} */ ([]);
  for (const base of ['.', 'packages', 'apps']) {
    const baseDir = path.join(dir, base);
    let entries = /** @type {string[]} */ ([]);
    try { entries = readdirSync(baseDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { continue; }
    for (const name of entries) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const pkg = readJson(path.join(baseDir, name, 'package.json'));
      if (!pkg) continue;
      found.push({ rel: base === '.' ? name : `${base}/${name}`, pkg });
    }
  }
  return found;
}

// The dev server is how a change becomes observable, so it is detected the same
// way a gate is -- from the project's own scripts, never assumed.
//
// `declaredPort` is the port the SCRIPT NAMES, which is not the port the server
// binds. Vite and Nuxt both walk to the next free port when theirs is taken and
// print the one they actually got, so a caller that trusts this number drives a
// browser at a URL nothing is serving and reports whatever stale page answers.
// The bound URL comes from the server's own startup output. This field exists to
// say what the project intended, and null means "the script names no port",
// never "the default". A composite script that names several ports reports the
// first, for the same reason: it is what the project wrote down, not a promise.
//
// `alias` says WHICH of the candidate list matched, because they are not
// equivalent -- a `start` script in a production-oriented setup serves a build
// rather than the working tree, so a caller that verifies against it is
// looking at the last build and not at the change. Reporting the alias puts
// that branch on a fact instead of on string-matching `source`.
//
// Shared by detectDevServer and detectStorybook: both are "find the script
// that serves something long-running, and read the port it names" -- the same
// walk, the same port regex, the same declared-not-bound split. One copy of
// that logic is what keeps the two from disagreeing about where a monorepo's
// real package lives.
/** @param {string} dir @param {string|null} pm @param {string[]} aliases @param {string} noun */
function detectServerScript(dir, pm, aliases, noun) {
  const pkg = readJson(path.join(dir, 'package.json'));
  const monorepo = existsSync(path.join(dir, 'pnpm-workspace.yaml')) || Array.isArray(pkg?.workspaces);
  /** @param {Record<string, unknown>|undefined} scripts */
  const pick = (scripts) => aliases.find((s) => typeof scripts?.[s] === 'string' && String(scripts[s]).trim() !== '');

  let scripts = /** @type {Record<string, unknown>|undefined} */ (pkg?.scripts);
  let alias = pick(scripts);
  /** @type {string|null} */
  let workspace = null;

  // Same walk detectStack uses: in a monorepo the root package.json usually
  // holds only tooling, and the app that can actually be served lives one level
  // down.
  if (!alias && monorepo) {
    for (const w of workspacePackages(dir)) {
      const a = pick(w.pkg.scripts);
      if (a) { scripts = w.pkg.scripts; alias = a; workspace = w.rel; break; }
    }
  }

  if (!alias) {
    return {
      command: null,
      script: null,
      source: monorepo ? `no ${noun} script in the root package.json or any workspace package` : `no ${noun} script in package.json`,
      declared: false,
      alias: null,
      workspace: null,
      declaredPort: null,
    };
  }

  const script = String(/** @type {Record<string, unknown>} */ (scripts)[alias]);
  const port = script.match(/(?:--port[=\s]+|(?:^|\s)-p[=\s]+|(?:^|\s)PORT=)(\d{2,5})(?!\d)/);
  return {
    command: runCommand(/** @type {string} */ (pm), alias),
    script,
    source: workspace ? `package.json script "${alias}" in ${workspace}` : `package.json script "${alias}"`,
    declared: true,
    alias,
    // Relative directory the script lives in, or null for the repository root.
    // `command` is the script invocation; this says where to run it.
    workspace,
    declaredPort: port ? Number(port[1]) : null,
  };
}

/** @param {string} dir @param {string|null} pm */
function detectDevServer(dir, pm) {
  return detectServerScript(dir, pm, DEV_ALIASES, 'dev');
}

// Approval for a server declared in .mcp.json, read from the project's own
// settings. Returns null rather than false when neither file mentions it,
// because the interactive trust dialog records its answer in the USER's config,
// outside this repository -- so "not written down here" is genuinely unknown,
// and reporting it as false would be a confident wrong answer.
//
// These three keys do NOT follow ordinary settings precedence, so the chain is
// not walked last-writer-wins. A `disabledMcpjsonServers` entry in ANY settings
// file rejects the server outright; the enables are a union across files, not a
// ranking. Applying general precedence here would report `approved: true` for a
// server the base file disabled and the local one re-enabled, which is the one
// answer a caller acts on and cannot check.
/** @param {string} key @param {unknown[]} chain */
function approvalFor(key, chain) {
  const want = mcpName(key);
  /** @param {unknown} v */
  const names = (v) => (Array.isArray(v) ? v.map(mcpName) : []);
  const settings = chain
    .filter((raw) => raw && typeof raw === 'object')
    .map((raw) => /** @type {Record<string, unknown>} */ (raw));

  if (settings.some((s) => names(s.disabledMcpjsonServers).includes(want))) return false;
  if (settings.some((s) => s.enableAllProjectMcpServers === true || names(s.enabledMcpjsonServers).includes(want))) return true;
  return null;
}

// What browser MCP server THIS PROJECT declares, for the one caller that needs
// it: an audit asking what a repository already has before proposing anything.
//
// `declared: false` does NOT mean no browser tool is available. A server added
// at user scope lives in the user's own config and serves every project without
// appearing in any file here, which is the normal way to install one. The only
// authority on whether a browser can be driven is the caller's own tool list;
// this function describes the repository, and `available` stays null to keep
// those two questions apart -- the same split `gates` draws between a declared
// script and a binary that resolves.
/** @param {string} dir */
function detectBrowserTools(dir) {
  const rel = '.mcp.json';
  const present = existsSync(path.join(dir, rel));
  // Parsed and empty are different answers, and readJson collapses them: it
  // returns null both for a file that is not JSON and for one whose content IS
  // the literal `null`. Only the first is "nothing in it loaded because it is
  // broken", which is what the callers report as a finding.
  /** @type {boolean|null} */
  let parsed = present ? false : null;
  /** @type {any} */
  let cfg = null;
  if (present) {
    try { cfg = JSON.parse(readFileSync(path.join(dir, rel), 'utf8')); parsed = true; } catch { parsed = false; }
  }
  const declared = cfg && typeof cfg.mcpServers === 'object' && cfg.mcpServers !== null && !Array.isArray(cfg.mcpServers) ? cfg.mcpServers : {};
  const chain = [
    readJson(path.join(dir, '.claude', 'settings.json')),
    readJson(path.join(dir, '.claude', 'settings.local.json')),
  ];

  const servers = [];
  for (const [key, entry] of Object.entries(declared)) {
    const e = /** @type {Record<string, unknown>} */ (entry);
    const launch = [e?.command, ...(Array.isArray(e?.args) ? e.args : [])]
      .filter((v) => typeof v === 'string')
      .join(' ');
    const match = BROWSER_MCP.find(([re]) => re.test(launch));
    if (!match) continue;
    // The tool prefix is built from the KEY, not the package: Claude Code names
    // an MCP tool mcp__<server-key>__<tool>, so a server keyed `browser` exposes
    // mcp__browser__take_snapshot and a grant written against the package name
    // matches nothing. The key is sanitised on the way in -- see mcpName -- so a
    // key with a dot or a space does not reach the tool name intact.
    servers.push({ key, kind: match[1], toolPrefix: `mcp__${mcpName(key)}__`, approved: approvalFor(key, chain) });
  }

  return {
    configPath: present ? rel : null,
    // Present but unparseable is its own state: the servers in it load nowhere,
    // and an empty list would read as "this project declares none".
    parsed,
    servers,
    declared: servers.length > 0,
    available: null,
  };
}

// Storybook itself is detected the same way a dev server is -- from the
// project's own scripts -- plus one more signal a Storybook install always
// leaves behind regardless of what its script is called.
//
// The config check walks every workspace package, not just the root: a root
// script commonly delegates to one workspace via `--filter`, which is a root
// script (so `server.workspace` is null) even though `.storybook/` itself
// lives under that workspace, not the root. Checking the root alone would
// report configPresent: false for exactly the monorepo shape this repo type
// most often has -- the same failure detectDevServer's own walk exists to
// avoid for the dev script itself.
/** @param {string} dir @param {string|null} pm */
function detectStorybook(dir, pm) {
  const server = detectServerScript(dir, pm, STORYBOOK_ALIASES, 'Storybook');
  const configPresent = existsSync(path.join(dir, '.storybook'))
    || workspacePackages(dir).some((w) => existsSync(path.join(dir, w.rel, '.storybook')));
  return { ...server, configPresent };
}

// What this can and cannot say. Whether the design tool's MCP is present in
// THIS session is Claude Code's own runtime state -- a fact about the
// session, not about the repository -- and a Node subprocess launched over
// Bash has no API into it, the same way it has no API into the tool list any
// other skill was granted. That check belongs to whichever skill calls this
// script; it already knows its own tool grant and can try the tool directly.
//
// What IS a fact about the repository: which project-local skills exist.
// This script cannot judge which one, if any, is a design workflow -- naming
// it explicitly is what the .claude/project.json override is for.
/** @param {string} dir */
function detectDesignReference(dir) {
  /** @type {string[]} */
  const projectSkills = [];
  try {
    for (const e of readdirSync(path.join(dir, '.claude', 'skills'), { withFileTypes: true })) {
      if (e.isDirectory() && existsSync(path.join(dir, '.claude', 'skills', e.name, 'SKILL.md'))) {
        projectSkills.push(e.name);
      }
    }
  } catch { /* no .claude/skills directory */ }
  return {
    projectSkills,
    skill: null,
    declared: projectSkills.length > 0,
    source: projectSkills.length > 0 ? '.claude/skills' : 'none',
    // Always null, on purpose -- see the comment above this function. Never
    // read as "no design tool is available"; it means "this script cannot say".
    available: null,
  };
}

// Reported, never resolved to the top level: that would describe a wrong directory
// inside another repository as that repository, and a workspace folder as the root.
/** @param {string} dir */
function detectProjectRoot(dir) {
  const marker = existsSync(path.join(dir, 'package.json')) || existsSync(path.join(dir, '.claude', 'project.json'));
  // git 2.43.0 prints the resolved top level, then the path below it: empty at the top.
  const out = git(dir, ['rev-parse', '--show-toplevel', '--show-prefix']);
  const [gitTopLevel = null, prefix = ''] = out === null ? [] : out.split('\n');
  const isRoot = marker || (gitTopLevel !== null && prefix === '');
  const where = gitTopLevel ? `is below the git top level ${gitTopLevel}` : 'is not inside a git work tree';
  return { isRoot, gitTopLevel, reason: isRoot ? null : `not a project root: ${dir} has no package.json and ${where}` };
}

/** @param {string} dir */
function detectBaseBranch(dir) {
  const head = git(dir, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (head) return { name: head.replace(/^origin\//, ''), source: 'origin/HEAD' };
  for (const b of ['main', 'master', 'dev', 'develop']) {
    if (git(dir, ['rev-parse', '--verify', `refs/remotes/origin/${b}`])) {
      return { name: b, source: `refs/remotes/origin/${b}` };
    }
  }
  const cur = git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']);
  return { name: cur, source: cur ? 'current branch (no remote HEAD)' : 'not detected' };
}

/** @param {string} dir */
function detectGitHost(dir) {
  const url = git(dir, ['remote', 'get-url', 'origin']) ?? '';
  const hasGitlabMarkers = existsSync(path.join(dir, '.gitlab')) || existsSync(path.join(dir, '.gitlab-ci.yml'));
  const hasGithubMarkers = existsSync(path.join(dir, '.github'));

  // Order matters: a self-hosted GitLab has neither "gitlab" nor "github" in its
  // hostname, so the in-repo markers are what identify it.
  let host = null;
  if (/github\.com/i.test(url)) host = 'github';
  else if (/gitlab/i.test(url) || hasGitlabMarkers) host = 'gitlab';
  else if (hasGithubMarkers) host = 'github';

  const m = url.match(/@([^:/]+)|https?:\/\/([^:/]+)/);
  const hostname = m ? (m[1] ?? m[2] ?? null) : null;
  const selfHosted = Boolean(hostname && !/^(github|gitlab)\.com$/i.test(hostname));
  const cli = host === 'gitlab' ? 'glab' : host === 'github' ? 'gh' : null;

  return {
    host,
    hostname,
    selfHosted,
    remote: url || null,
    cli,
    cliAvailable: cli ? onPath(cli) : false,
  };
}

/** @param {string} dir */
function detectCommitConvention(dir) {
  const candidates = [
    'commitlint.config.ts', 'commitlint.config.js', 'commitlint.config.mjs',
    'commitlint.config.cjs', '.commitlintrc', '.commitlintrc.json',
    '.commitlintrc.js', '.commitlintrc.yml',
  ];
  const found = candidates.find((f) => existsSync(path.join(dir, f)));
  if (found) {
    // The config is machine-enforced, so point at it rather than paraphrasing
    // the rules: a paraphrase drifts, the file cannot.
    return { convention: 'commitlint', configPath: found, enforced: true };
  }
  const pkg = readJson(path.join(dir, 'package.json'));
  if (pkg?.commitlint) return { convention: 'commitlint', configPath: 'package.json', enforced: true };
  const husky = existsSync(path.join(dir, '.husky'));
  return { convention: null, configPath: null, enforced: false, huskyPresent: husky };
}

/** @param {string} dir */
function detectChangeTemplates(dir) {
  /** @type {string[]} */
  const found = [];
  const dirs = ['.gitlab/merge_request_templates', '.github/PULL_REQUEST_TEMPLATE'];
  for (const d of dirs) {
    try {
      for (const f of readdirSync(path.join(dir, d))) {
        if (f.endsWith('.md')) found.push(path.join(d, f));
      }
    } catch { /* absent */ }
  }
  for (const f of ['.gitlab/merge_request_templates.md', '.github/pull_request_template.md', '.github/PULL_REQUEST_TEMPLATE.md']) {
    if (existsSync(path.join(dir, f))) found.push(f);
  }
  return found;
}

// A meta-framework is checked before the view library it is built on, because
// every Nuxt app also depends on `vue` and every Next app on `react`. Checking
// in the other order would report every Nuxt repo as a plain SPA and hand it
// guidance that inverts under SSR.
//
// The value names the stack, not the pack -- `vue-spa` and `nuxt` are both Vue.
// PACKS below is what maps one to the other.
/** @param {Record<string, unknown>} deps */
function stackFromDeps(deps) {
  const has = (/** @type {string} */ d) => Object.prototype.hasOwnProperty.call(deps, d);
  if (has('nuxt')) return 'nuxt';
  if (has('next')) return 'next';
  if (has('vue')) return 'vue-spa';
  if (has('react')) return 'react-spa';
  return null;
}

// Meta-framework stacks list BOTH packs, general first, because the packs
// layer: `nuxt` depends on `vue` and carries only what SSR inverts or adds.
// A consumer applies them in order, so the more specific one wins a conflict.
//
// This mapping lives here, once, rather than in the prose of every component
// that needs it. Two components each describing the same mapping is two copies
// that drift -- the failure this whole script exists to avoid.
/** @type {Record<string, string[]>} */
const PACKS = {
  'vue-spa': ['vue'],
  nuxt: ['vue', 'nuxt'],
  'react-spa': [],
  next: [],
};

/** @param {string|null} stack */
function packsFor(stack) {
  return stack ? (PACKS[stack] ?? []) : [];
}

/** @param {string} dir */
function detectStack(dir) {
  const pkg = readJson(path.join(dir, 'package.json'));
  const rootDeps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const monorepo = existsSync(path.join(dir, 'pnpm-workspace.yaml')) || Array.isArray(pkg?.workspaces);

  let stack = stackFromDeps(rootDeps);
  /** @type {string[]} */
  const workspaceStacks = [];

  // In a monorepo the root package.json usually holds only scripts and tooling;
  // the framework lives in a workspace package. Detecting at the root alone
  // reports "no stack" for exactly those projects.
  if (monorepo) {
    for (const { pkg: wp } of workspacePackages(dir)) {
      const s = stackFromDeps({ ...(wp.dependencies ?? {}), ...(wp.devDependencies ?? {}) });
      if (s && !workspaceStacks.includes(s)) workspaceStacks.push(s);
    }
    // Prefer the most specific framework found anywhere in the workspace.
    if (!stack) stack = workspaceStacks.find((s) => s === 'nuxt' || s === 'next') ?? workspaceStacks[0] ?? null;
  }

  const tsRange = typeof rootDeps.typescript === 'string' ? rootDeps.typescript : null;
  const typescriptMajor = tsRange ? Number((tsRange.match(/(\d+)/) ?? [])[1] ?? NaN) : null;
  const typed = existsSync(path.join(dir, 'tsconfig.json'))
    || existsSync(path.join(dir, 'tsconfig.base.json'))
    || Object.prototype.hasOwnProperty.call(rootDeps, 'typescript');
  return { stack, packs: packsFor(stack), monorepo, typed, typescriptRange: tsRange, typescriptMajor: Number.isFinite(typescriptMajor) ? typescriptMajor : null, workspaceStacks };
}

/** @param {string} [dir] */
export function detect(dir = process.env.CLAUDE_PROJECT_DIR || process.cwd()) {
  const pm = detectPackageManager(dir);
  const facts = {
    dir,
    projectRoot: detectProjectRoot(dir),
    packageManager: pm,
    stack: detectStack(dir),
    baseBranch: detectBaseBranch(dir),
    git: detectGitHost(dir),
    commit: detectCommitConvention(dir),
    changeTemplates: detectChangeTemplates(dir),
    gates: detectGates(dir, pm.name),
    devServer: detectDevServer(dir, pm.name),
    browserTools: detectBrowserTools(dir),
    storybook: detectStorybook(dir, pm.name),
    designReference: detectDesignReference(dir),
    userStoryPath: /** @type {string|null} */ (null),
    overrides: /** @type {Record<string, unknown>|null} */ (null),
  };

  const notRoot = facts.projectRoot.reason;
  if (notRoot) {
    for (const g of Object.values(facts.gates)) if (!g.declared) g.source = notRoot;
    if (!facts.devServer.declared) facts.devServer.source = notRoot;
    if (!facts.storybook.declared) facts.storybook.source = notRoot;
  }

  // Optional override file, for the cases detection gets wrong. Never required.
  const override = readJson(path.join(dir, '.claude', 'project.json'));
  if (override && typeof override === 'object' && !Array.isArray(override)) {
    facts.overrides = override;
    if (typeof override.baseBranch === 'string') facts.baseBranch = { name: override.baseBranch, source: '.claude/project.json' };
    if (override.gates && typeof override.gates === 'object' && !Array.isArray(override.gates)) {
      for (const [name, command] of Object.entries(override.gates)) {
        if (typeof command !== 'string' || name.startsWith('$')) continue;
        facts.gates[name] = { command, script: command, source: '.claude/project.json', declared: true, available: null };
      }
    }
    // Same shape as the gates override: the value replaces the whole command,
    // for a script named something detection does not recognise.
    if (override.storybook && typeof override.storybook === 'object' && !Array.isArray(override.storybook)) {
      const command = /** @type {any} */ (override.storybook).command;
      if (typeof command === 'string') {
        facts.storybook = { ...facts.storybook, command, script: command, source: '.claude/project.json', declared: true };
      }
    }
    if (override.designReference && typeof override.designReference === 'object' && !Array.isArray(override.designReference)) {
      const skill = /** @type {any} */ (override.designReference).skill;
      if (typeof skill === 'string') {
        facts.designReference = { ...facts.designReference, skill, declared: true, source: '.claude/project.json' };
      }
    }
    if (typeof override.userStoryPath === 'string') facts.userStoryPath = override.userStoryPath;
  }
  return facts;
}

/**
 * Whether the module at `url` is the script node was started with. The fallback
 * for Node before 22.18, where import.meta.main does not exist. A hand-built
 * file:// URL misses a path with a space, a non-ASCII character or a symlink;
 * an argv[1] that is not a path (`node -e "..." x`) is not the entry.
 * @param {string} url @param {string|undefined} argv1
 */
export function isEntry(url, argv1) {
  if (!argv1) return false;
  try {
    return url === pathToFileURL(realpathSync(argv1)).href;
  } catch {
    return false;
  }
}

// CLI.
if (import.meta.main ?? isEntry(import.meta.url, process.argv[1])) {
  process.stdout.write(JSON.stringify(detect(), null, 2) + '\n');
}
