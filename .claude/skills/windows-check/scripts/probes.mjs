#!/usr/bin/env node
// The Windows half of the pre-release check: what a gate whose binary is missing looks like
// under each shell and package manager Windows users run, as run-gates.mjs classifies it.
//
//   node .claude/skills/windows-check/scripts/probes.mjs
//
// Prints one JSON report. Each probe is a scratch project under the OS temp directory whose
// `lint` script calls a binary that does not exist. The package manager runs it once directly,
// for the real stderr and exit code, and run-gates.mjs runs it once, for the classification. A
// missing binary is expected to come back `not-run` as not installed; anything else is a
// finding. A shell or package manager that is not installed, a project it cannot set up, and a
// run that does not finish are reported NOT RUN.
//
// Exit 0: every observed probe classified as expected. Exit 1: one did not. Exit 2: not
// Windows, or an argument.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runAsEntry } from '../../../../scripts/pack-graph.mjs';

const TREE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const RUN_GATES = path.join(TREE, 'plugins', 'core', 'scripts', 'run-gates.mjs');
const MISSING = 'devkit-windows-check-missing-binary';
const NOT_INSTALLED = /not installed/;

/**
 * The lint gate's classification out of a run-gates.mjs `--json` run.
 * @param {string} stdout
 * @param {{ error?: Error, signal?: string | null }} [proc] the run's spawnSync result
 * @returns {{ classification: 'pass' | 'fail' | 'not-run' | 'unknown' | 'not-observed', reason: string | null }}
 */
export function classification(stdout, proc = {}) {
  if (proc.error || proc.signal) {
    return { classification: 'not-observed', reason: `run-gates.mjs did not finish: ${proc.error?.message ?? `killed by ${proc.signal}`}` };
  }
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    return { classification: 'unknown', reason: 'run-gates.mjs printed no JSON' };
  }
  const lint = report.results?.find((r) => r.name === 'lint');
  if (!lint) return { classification: 'unknown', reason: 'run-gates.mjs reported no lint gate' };
  return { classification: lint.status, reason: lint.reason ?? null };
}

/**
 * One row per item: a probe passes when its missing binary is classified not-run as not installed.
 * One never observed — unavailable, or a run that did not finish — is NOT RUN, never a fail.
 * @param {{ probes: { name: string, available: boolean, classification: string | null, reason: string | null, exitCode: number | null }[] }} report
 * @returns {{ item: string, result: 'pass' | 'fail' | 'NOT RUN', detail: string }[]}
 */
export function summarize(report) {
  return report.probes.map((p) => {
    if (!p.available || p.classification === 'not-observed') return { item: p.name, result: 'NOT RUN', detail: p.reason ?? 'not available' };
    const ok = p.classification === 'not-run' && NOT_INSTALLED.test(p.reason ?? '');
    const detail = `exit ${p.exitCode ?? 'none'}, classified ${p.classification}${p.reason ? `: ${p.reason}` : ''}`;
    return { item: p.name, result: ok ? 'pass' : 'fail', detail };
  });
}

/**
 * Git Bash's bash.exe, from every `where git` and `where bash` hit. git.exe can sit in <Git>\cmd,
 * <Git>\bin or <Git>\mingw64\bin, or behind a package manager's shim; bash.exe is in <Git>\bin.
 * @param {string[]} gits @param {string[]} bashes @param {(p: string) => boolean} exists
 */
export function findGitBash(gits, bashes, exists) {
  const w = path.win32;
  // <Git>\bin, <Git>\usr\bin, or a versioned install such as scoop's git\current\bin; never WSL's.
  const direct = bashes.find((b) => /\\git\\(?:[^\\]+\\)?(?:usr\\)?bin\\bash\.exe$/i.test(b) && exists(b));
  if (direct) return direct;
  // Only a Git for Windows root counts: MSYS2 and Cygwin also have a bin\bash.exe near their git.exe.
  const isGitRoot = (dir) => exists(w.join(dir, 'git-bash.exe')) || exists(w.join(dir, 'cmd', 'git.exe'));
  for (const git of gits) {
    let dir = w.dirname(git);
    for (let up = 0; up < 3; up++, dir = w.dirname(dir)) {
      const bash = w.join(dir, 'bin', 'bash.exe');
      if (isGitRoot(dir) && exists(bash)) return bash;
    }
  }
  return null;
}

// npm, pnpm and yarn are .cmd shims on Windows, which only a shell can start; cmd.exe is named
// explicitly so nothing else runs through a shell.
function cmd(line, { cwd = os.tmpdir(), env = {} } = {}) {
  const res = spawnSync('cmd.exe', ['/d', '/c', line], { cwd, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 120_000 });
  return { ok: !res.error && res.status === 0, status: res.error ? null : res.status, stdout: (res.stdout ?? '').trim(), stderr: (res.stderr ?? '').trim() };
}

const lines = (s) => s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const firstLine = (s) => lines(s)[0] ?? null;
const major = (v) => Number(String(v ?? '').split('.')[0]) || 0;

function versions() {
  const ps51 = cmd('powershell -NoProfile -Command $PSVersionTable.PSVersion.ToString()');
  const ps7 = cmd('pwsh -NoProfile -Command $PSVersionTable.PSVersion.ToString()');
  const claude = cmd('claude --version');
  return {
    os: firstLine(cmd('ver').stdout) ?? `${os.type()} ${os.release()}`,
    node: process.version,
    cli: claude.ok ? firstLine(claude.stdout) : null,
    shells: [
      { name: 'PowerShell 5.1', version: ps51.ok ? firstLine(ps51.stdout) : null },
      { name: 'PowerShell 7', version: ps7.ok ? firstLine(ps7.stdout) : null },
    ],
  };
}

function whereAll(name) {
  const res = cmd(`where ${name}`);
  return res.ok ? lines(res.stdout) : [];
}

// The global yarn outside a project is often Classic even where Corepack gives a project Berry,
// so Berry is also asked of Corepack.
function berryVersion() {
  const global = cmd('yarn --version');
  if (global.ok && major(firstLine(global.stdout)) >= 2) return { version: firstLine(global.stdout) };
  const corepack = cmd('corepack yarn@stable --version');
  if (corepack.ok && major(firstLine(corepack.stdout)) >= 2) return { version: firstLine(corepack.stdout) };
  return { missing: global.ok ? `yarn ${firstLine(global.stdout)} is Yarn Classic, and Corepack gave no Berry` : 'yarn not found, and Corepack gave no Berry' };
}

// Berry refuses to run a script in a project it has not installed, so the probe installs first.
function prepareBerry(dir, version) {
  const inside = cmd('yarn --version', { cwd: dir });
  if (!inside.ok || firstLine(inside.stdout) !== version) {
    return `the yarn on PATH runs ${firstLine(inside.stdout) ?? 'nothing'} here, not ${version}: it ignores packageManager (enable Corepack with \`corepack enable\`)`;
  }
  fs.writeFileSync(path.join(dir, 'yarn.lock'), '');
  const install = cmd('yarn install', { cwd: dir });
  return install.ok ? null : `yarn install failed: ${firstLine(install.stderr) ?? firstLine(install.stdout) ?? `exit ${install.status}`}`;
}

function probeList() {
  const pnpm = cmd('pnpm --version');
  const berry = berryVersion();
  const powershell = whereAll('powershell')[0] ?? null;
  const pwsh = whereAll('pwsh')[0] ?? null;
  const bash = findGitBash(whereAll('git'), whereAll('bash'), fs.existsSync);
  const lint = `${MISSING} --check`;
  const npm = { packageManager: 'npm', run: 'npm run lint' };
  return [
    { name: 'cmd.exe', shell: 'cmd.exe', ...npm, lint },
    { name: 'PowerShell 5.1 script shell', shell: 'powershell.exe', ...npm, lint, env: { npm_config_script_shell: powershell }, missing: !powershell && 'powershell.exe not found' },
    { name: 'PowerShell 7 script shell', shell: 'pwsh', ...npm, lint, env: { npm_config_script_shell: pwsh }, missing: !pwsh && 'pwsh not found' },
    {
      name: 'Yarn Berry',
      shell: 'cmd.exe',
      packageManager: berry.version ? `yarn@${berry.version}` : 'yarn',
      run: 'yarn run lint',
      lint,
      missing: berry.missing,
      prepare: (dir) => prepareBerry(dir, berry.version),
    },
    { name: 'pnpm', shell: 'cmd.exe', packageManager: pnpm.ok ? `pnpm@${firstLine(pnpm.stdout)}` : 'pnpm', run: 'pnpm run lint', lint, missing: !pnpm.ok && 'pnpm not found' },
    { name: 'Git Bash script shell', shell: 'bash.exe', ...npm, lint, env: { npm_config_script_shell: bash }, missing: !bash && 'Git Bash not found' },
    { name: 'stdout without a newline before the cmd.exe message', shell: 'cmd.exe', ...npm, lint: `node -e "process.stdout.write('partial line')" && ${MISSING} --check` },
  ];
}

function runProbe(p) {
  const base = { name: p.name, shell: p.shell, packageManager: p.packageManager, exitCode: null, stderr: null, classification: null };
  if (p.missing) return { ...base, available: false, reason: p.missing };

  const dir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'windows-check-')));
  try {
    const pkg = { name: 'windows-check-probe', private: true, scripts: { lint: p.lint } };
    if (p.packageManager !== 'npm') pkg.packageManager = p.packageManager;
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
    const unprepared = p.prepare?.(dir);
    if (unprepared) return { ...base, available: false, reason: unprepared };
    const direct = cmd(p.run, { cwd: dir, env: p.env });
    const gates = spawnSync(process.execPath, [RUN_GATES, '--stage', 'fast', '--json'], { cwd: dir, env: { ...process.env, ...p.env }, encoding: 'utf8', timeout: 300_000 });
    const c = classification(gates.stdout ?? '', gates);
    return { ...base, available: true, exitCode: direct.status, stderr: direct.stderr, classification: c.classification, reason: c.reason };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function main() {
  const [arg] = process.argv.slice(2);
  if (arg !== undefined) {
    process.stderr.write(`probes: unknown argument ${arg}\n`);
    process.exit(2);
  }
  if (process.platform !== 'win32') {
    process.stderr.write(`probes: /windows-check runs only on Windows; this is ${process.platform}.\n`);
    process.exit(2);
  }
  const report = { ...versions(), probes: probeList().map(runProbe) };
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exitCode = summarize(report).some((r) => r.result === 'fail') ? 1 : 0;
}

runAsEntry(import.meta.main, main, 'probes.mjs');
