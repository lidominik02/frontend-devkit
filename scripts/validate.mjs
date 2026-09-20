#!/usr/bin/env node
// Static validation for this marketplace: one implementation, three callers.
//
// CI calls it, the Stop hook calls it, and the two PostToolUse hooks call
// single checks out of it. It was extracted from .github/workflows/validate.yml,
// where the same logic lived as inline heredocs and could not be run from a
// terminal at all — so nothing caught a bad frontmatter field or a dead
// reference until a push had already happened.
//
// Pure Node against the working tree: no dependencies, no CLI, no network, so
// the Stop hook costs a few milliseconds of fs reads.
//
// Exit 0 = every requested check passed. Exit 1 = at least one failed. Callers
// that need to *block* translate that themselves; see scripts/hooks/.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = (...p) => path.join(ROOT, ...p);
const rel = (p) => path.relative(ROOT, p) || p;

// --- frontmatter ------------------------------------------------------------

// `claude plugin validate --strict` flags unknown fields in plugin.json but NOT
// in component frontmatter (verified against 2.1.250 and 2.1.276), so a typo
// there loads as silence: misspell `disable-model-invocation` and the skill
// quietly becomes model-invocable, misspell `disallowed-tools` and a guardrail
// quietly stops being enforced. Hence these allowlists.
const KNOWN_SKILL = [
  'name', 'description', 'when_to_use', 'disable-model-invocation', 'user-invocable',
  'allowed-tools', 'disallowed-tools', 'argument-hint', 'arguments', 'paths', 'model',
  'effort', 'context', 'agent', 'background', 'shell', 'license', 'compatibility',
  'metadata', 'hooks',
];
const KNOWN_AGENT = [
  'name', 'description', 'tools', 'disallowedTools', 'model', 'permissionMode',
  'maxTurns', 'skills', 'mcpServers', 'hooks', 'memory', 'background', 'effort',
  'isolation', 'color', 'initialPrompt', 'experimental',
];

// 1024 is the Agent Skills spec's hard limit: past it a skill cannot be packaged
// or uploaded, even though Claude Code itself tolerates roughly 1536.
const DESCRIPTION_CAP = 1024;

export function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : null;
}

// Folded scalars (`description: >-`) continue until the next top-level key, so
// the value has to be gathered across lines rather than read off one.
export function describe(text) {
  const fm = frontmatter(text);
  if (fm === null) return null;
  const lines = fm.split('\n');
  const i = lines.findIndex((l) => /^description:/.test(l));
  if (i < 0) return null;
  const body = [lines[i].replace(/^description:\s*>?-?\s*/, '')];
  for (let j = i + 1; j < lines.length; j++) {
    if (/^[A-Za-z_$-]+:/.test(lines[j])) break;
    body.push(lines[j].trim());
  }
  return body.join(' ').replace(/\s+/g, ' ').trim();
}

export function isListed(text) {
  return !/^disable-model-invocation:\s*true/m.test(frontmatter(text) ?? '');
}

// Every component this marketplace ships: SKILL.md files and agent definitions.
export function components() {
  const out = [];
  (function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'SKILL.md' || p.includes(`${path.sep}agents${path.sep}`)) out.push(p);
    }
  })(r('plugins'));
  return out;
}

export function checkFrontmatter(files = components()) {
  const bad = [];
  for (const p of files) {
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, 'utf8');
    const isSkill = path.basename(p) === 'SKILL.md';
    const d = describe(text);

    if (d === null) { bad.push(`${rel(p)} -> no description`); continue; }
    if (d.length > DESCRIPTION_CAP) {
      bad.push(`${rel(p)} -> description ${d.length} chars, cap ${DESCRIPTION_CAP}`);
    }
    if (isSkill) {
      const name = (text.match(/^name:\s*(\S+)/m) || [])[1];
      const dir = path.basename(path.dirname(p));
      if (name !== dir) bad.push(`${rel(p)} -> name "${name}" must match directory "${dir}"`);
    }
    const known = isSkill ? KNOWN_SKILL : KNOWN_AGENT;
    for (const line of (frontmatter(text) ?? '').split('\n')) {
      const k = (line.match(/^([A-Za-z_][A-Za-z0-9_-]*):/) || [])[1];
      if (k && !known.includes(k)) {
        bad.push(`${rel(p)} -> unknown frontmatter field '${k}'; it will be ignored at load time`);
      }
    }
  }
  return { name: 'frontmatter', findings: bad, ok: bad.length === 0 };
}

// --- always-on description budget -------------------------------------------

// Only descriptions are always-on. Every listed one is paid for in every session
// of every repository that enables the pack, so the total is a managed number
// and the README publishes it. Nothing recomputed it, so editing any description
// silently invalidated a documented figure.
export function budget() {
  const packs = {};
  let listed = 0, off = 0;
  for (const p of components()) {
    const text = fs.readFileSync(p, 'utf8');
    const d = describe(text) ?? '';
    const pack = rel(p).split(path.sep)[1];
    if (isListed(text)) {
      listed += d.length;
      packs[pack] = (packs[pack] ?? 0) + d.length;
    } else {
      off += d.length;
    }
  }
  return { listed, off, packs };
}

export function checkBudget() {
  const { listed, packs } = budget();
  const readme = fs.readFileSync(r('README.md'), 'utf8');
  const claimed = readme.match(/\*\*([\d.]+)k characters\*\*/);
  const bad = [];
  if (!claimed) {
    bad.push('README.md no longer states the always-on listing cost — did the sentence move?');
  } else {
    const actual = Math.round(listed / 100) / 10;
    if (Number(claimed[1]) !== actual) {
      bad.push(
        `always-on listing is ${listed} chars (${actual}k), README.md says ${claimed[1]}k. ` +
        `Per pack: ${Object.entries(packs).map(([k, v]) => `${k} ${v}`).join(', ')}`
      );
    }
  }
  return { name: 'budget', findings: bad, ok: bad.length === 0, listed, packs };
}

// --- references resolve -----------------------------------------------------

// A skill pointing at a reference file that does not exist is a dead end followed
// at runtime, and nothing else catches it. Every .md under skills/ and agents/ is
// scanned, not just SKILL.md, because most references live in references/ and
// citing a sibling as `references/x.md` from inside references/ resolves to
// references/references/x.md.
const CONCEPTUAL = new Set(['SKILL.md', 'README.md', 'CLAUDE.md', 'AGENTS.md']);

export function checkReferences() {
  const roots = fs
    .readdirSync(r('plugins'))
    .flatMap((p) => ['skills', 'agents'].map((k) => r('plugins', p, k)))
    .filter((d) => fs.existsSync(d));

  const bad = [];

  const ownerDir = (file) => {
    let d = path.dirname(file);
    while (d.startsWith(r('plugins'))) {
      if (fs.existsSync(path.join(d, 'SKILL.md'))) return d;
      d = path.dirname(d);
    }
    return path.dirname(file);
  };

  const mdFiles = (dir) => {
    const out = new Map();
    (function rec(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) rec(p);
        else if (e.name.endsWith('.md')) out.set(e.name, p);
      }
    })(dir);
    return out;
  };

  for (const root of roots) {
    (function walk(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!e.name.endsWith('.md')) continue;

        const body = fs.readFileSync(p, 'utf8');
        const present = mdFiles(ownerDir(p));
        const cited = new Set([
          ...[...body.matchAll(/`([A-Za-z0-9._/-]+\.md)`/g)].map((m) => m[1]),
          ...[...body.matchAll(/\]\((\.?\/?[A-Za-z0-9._/-]+\.md)(?:#[^)]*)?\)/g)].map((m) => m[1]),
        ]);

        for (const ref of cited) {
          if (CONCEPTUAL.has(path.basename(ref))) continue;
          if (fs.existsSync(path.join(path.dirname(p), ref)) || fs.existsSync(r(ref))) continue;
          const elsewhere = present.get(path.basename(ref));
          const inRefs = path.dirname(p).endsWith(`${path.sep}references`);
          if (elsewhere) {
            bad.push(`${rel(p)} -> ${ref}: exists at ${rel(elsewhere)}, but that path does not resolve from here`);
          } else if (ref.includes('/') || inRefs) {
            bad.push(`${rel(p)} -> ${ref}: no such file; if it is in another pack, name the /plugin:skill invocation instead of a path`);
          }
        }
      }
    })(root);
  }

  return { name: 'references', findings: bad, ok: bad.length === 0 };
}

// --- blocked MCP names match their reference table ---------------------------

// A blocked MCP tool is the one enforcement rule here that rests on a string
// match against a name the server chooses. Nothing errors when a server renames
// a tool: the block silently matches nothing and the table documenting it
// quietly goes stale.
export function checkMcpNames() {
  const skill = r('plugins/core/skills/verifying-ui/SKILL.md');
  const table = r('plugins/core/skills/verifying-ui/references/browser-tools.md');
  const bad = [];
  if (!fs.existsSync(skill) || !fs.existsSync(table)) {
    return { name: 'mcp-names', findings: ['verifying-ui skill or browser-tools.md is missing'], ok: false };
  }
  const body = fs.readFileSync(skill, 'utf8');
  const doc = fs.readFileSync(table, 'utf8');
  const line = (body.match(/^disallowed-tools:(.*)$/m) || [, ''])[1];
  const blocked = line.split(',').map((s) => s.trim()).filter((s) => s.startsWith('mcp__'));
  for (const full of blocked) {
    const bare = full.split('__').pop();
    if (!doc.includes('`' + bare + '`')) bad.push(`${full} is blocked but absent from browser-tools.md`);
  }
  if (!blocked.length) bad.push('no mcp__ names blocked — did the field move?');
  return { name: 'mcp-names', findings: bad, ok: bad.length === 0, count: blocked.length };
}

// --- every script parses, every hook target exists ---------------------------

// A script with a syntax error and a script that deliberately blocks are
// indistinguishable by exit code, so this runs before anything behavioural.
export function checkScripts() {
  const bad = [];
  const mjs = [];
  for (const base of [r('plugins'), r('scripts')]) {
    (function walk(dir) {
      if (!fs.existsSync(dir)) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.mjs')) mjs.push(p);
      }
    })(base);
  }

  // `node --check` parses without executing. Running an unknown script to
  // validate it is not something a Stop hook should ever do.
  for (const p of mjs) {
    try {
      execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' });
    } catch (e) {
      const why = String(e.stderr ?? '').split('\n').find((l) => l.includes('Error')) ?? 'does not parse';
      bad.push(`${rel(p)} -> ${why.trim()}`);
    }
  }

  // Every script named by hooks.json must exist: a renamed file is a dead hook.
  const cfgPath = r('plugins/core/hooks/hooks.json');
  if (fs.existsSync(cfgPath)) {
    let cfg;
    try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); }
    catch { bad.push('plugins/core/hooks/hooks.json is not valid JSON'); }
    if (cfg) {
      for (const entries of Object.values(cfg.hooks ?? {})) {
        for (const entry of entries) {
          for (const h of entry.hooks ?? []) {
            for (const a of h.args ?? []) {
              const p = String(a).replace('${CLAUDE_PLUGIN_ROOT}', r('plugins/core'));
              if (p.includes('/') && !fs.existsSync(p)) bad.push(`hooks.json names a missing script: ${rel(p)}`);
            }
          }
        }
      }
    }
  }
  return { name: 'scripts', findings: bad, ok: bad.length === 0 };
}

// --- runner -----------------------------------------------------------------

export const CHECKS = {
  frontmatter: checkFrontmatter,
  budget: checkBudget,
  references: checkReferences,
  'mcp-names': checkMcpNames,
  scripts: checkScripts,
};

export function runChecks(names = Object.keys(CHECKS)) {
  return names.map((n) => CHECKS[n]());
}

function cli() {
  const arg = process.argv.find((a) => a.startsWith('--checks='));
  const names = arg ? arg.slice('--checks='.length).split(',') : Object.keys(CHECKS);
  const unknown = names.filter((n) => !CHECKS[n]);
  if (unknown.length) {
    console.error(`unknown check(s): ${unknown.join(', ')}`);
    console.error(`available: ${Object.keys(CHECKS).join(', ')}`);
    process.exit(1);
  }
  const ci = process.env.GITHUB_ACTIONS === 'true';
  let failed = 0;
  for (const result of runChecks(names)) {
    if (result.ok) {
      console.log(`  ok    ${result.name}`);
    } else {
      failed += result.findings.length;
      console.error(`  FAIL  ${result.name}`);
      for (const f of result.findings) console.error(`        ${f}`);
    }
  }
  if (failed) {
    if (ci) console.error(`::error::${failed} finding(s)`);
    else console.error(`\n${failed} finding(s)`);
    process.exit(1);
  }
  console.log(`\n${names.length} check(s) passed`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) cli();
