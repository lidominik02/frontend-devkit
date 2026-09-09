#!/usr/bin/env node
// Describes a project by reading the files it already maintains. Nothing is
// added to the repo and nothing is written into it, so every fact is derived
// from a file that exists for the project's own reasons:
//
//   packageManager   package.json "packageManager", else the lockfile
//   gates            package.json scripts (aliases resolved). Reported as
//                    DECLARED, never as "available" -- see detectGates.
//   baseBranch       git symbolic-ref refs/remotes/origin/HEAD
//   gitHost          the git remote URL, plus .gitlab/ or .github/ markers
//   commitConvention commitlint config, which enforces it rather than describing it
//   mrTemplates      .gitlab/merge_request_templates/ or .github/
//   stack            dependencies
//
// Reading from the file that enforces a fact keeps it current; a copy in a
// devkit-owned manifest would drift.
//
// `.claude/project.json` is honoured if present, but only to override what
// detection gets wrong. It is never required.
//
// Usage:  node project-facts.mjs [--json]      (defaults to --json)
// Import: import { detect } from './project-facts.mjs'

import { readFileSync, existsSync, readdirSync, accessSync, constants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

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

/** @param {string} p */
function readJson(p) {
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
    ['package-lock.json', 'npm'],
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

/** @param {Record<string, unknown>} deps */
function stackFromDeps(deps) {
  const has = (/** @type {string} */ d) => Object.prototype.hasOwnProperty.call(deps, d);
  if (has('nuxt')) return 'vue-nuxt';
  if (has('next')) return 'react-next';
  if (has('vue')) return 'vue';
  if (has('react')) return 'react';
  return null;
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
    for (const base of ['.', 'packages', 'apps']) {
      const baseDir = path.join(dir, base);
      let entries = /** @type {string[]} */ ([]);
      try { entries = readdirSync(baseDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { continue; }
      for (const name of entries) {
        if (name === 'node_modules' || name.startsWith('.')) continue;
        const wp = readJson(path.join(baseDir, name, 'package.json'));
        if (!wp) continue;
        const s = stackFromDeps({ ...(wp.dependencies ?? {}), ...(wp.devDependencies ?? {}) });
        if (s && !workspaceStacks.includes(s)) workspaceStacks.push(s);
      }
    }
    // Prefer the most specific framework found anywhere in the workspace.
    if (!stack) stack = workspaceStacks.find((s) => s === 'vue-nuxt' || s === 'react-next') ?? workspaceStacks[0] ?? null;
  }

  const tsRange = typeof rootDeps.typescript === 'string' ? rootDeps.typescript : null;
  const typescriptMajor = tsRange ? Number((tsRange.match(/(\d+)/) ?? [])[1] ?? NaN) : null;
  const typed = existsSync(path.join(dir, 'tsconfig.json'))
    || existsSync(path.join(dir, 'tsconfig.base.json'))
    || Object.prototype.hasOwnProperty.call(rootDeps, 'typescript');
  return { stack, monorepo, typed, typescriptRange: tsRange, typescriptMajor: Number.isFinite(typescriptMajor) ? typescriptMajor : null, workspaceStacks };
}

/** @param {string} [dir] */
export function detect(dir = process.env.CLAUDE_PROJECT_DIR || process.cwd()) {
  const pm = detectPackageManager(dir);
  const facts = {
    dir,
    packageManager: pm,
    stack: detectStack(dir),
    baseBranch: detectBaseBranch(dir),
    git: detectGitHost(dir),
    commit: detectCommitConvention(dir),
    changeTemplates: detectChangeTemplates(dir),
    gates: detectGates(dir, pm.name),
    overrides: /** @type {Record<string, unknown>|null} */ (null),
  };

  // Optional override file, for the cases detection gets wrong. Never required.
  const override = readJson(path.join(dir, '.claude', 'project.json'));
  if (override) {
    facts.overrides = override;
    if (override.baseBranch) facts.baseBranch = { name: override.baseBranch, source: '.claude/project.json' };
    if (override.gates) {
      for (const [name, command] of Object.entries(override.gates)) {
        if (typeof command !== 'string' || name.startsWith('$')) continue;
        facts.gates[name] = { command, script: command, source: '.claude/project.json', declared: true, available: null };
      }
    }
  }
  return facts;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(JSON.stringify(detect(), null, 2) + '\n');
}
