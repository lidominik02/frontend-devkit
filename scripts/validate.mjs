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
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import { packs } from './pack-graph.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = (root, ...p) => path.join(root, ...p);
// Findings print `/` on every OS, so a message reads the same in CI on any runner.
const rel = (root, p) => (path.relative(root, p) || p).split(path.sep).join('/');
// A CRLF checkout must report exactly what an LF one does, so every text read normalises here.
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

// --- frontmatter ------------------------------------------------------------

// `claude plugin validate --strict` flags unknown fields in plugin.json but NOT
// in component frontmatter (verified against 2.1.250, 2.1.276 and 2.1.283), so a typo
// there loads as silence: misspell `disable-model-invocation` and the skill
// quietly becomes model-invocable, misspell `disallowed-tools` and a guardrail
// quietly stops being enforced. Hence these allowlists.
const KNOWN_SKILL = [
  'name', 'description', 'when_to_use', 'disable-model-invocation', 'user-invocable',
  'allowed-tools', 'disallowed-tools', 'argument-hint', 'arguments', 'paths', 'model',
  'effort', 'context', 'agent', 'background', 'shell', 'license', 'compatibility',
  'metadata', 'hooks',
];
// `omitClaudeMd` verified against 2.1.283: documented, and in the binary's agent schema.
const KNOWN_AGENT = [
  'name', 'description', 'tools', 'disallowedTools', 'model',
  'maxTurns', 'skills', 'mcpServers', 'hooks', 'memory', 'background', 'omitClaudeMd',
  'effort', 'isolation', 'color', 'initialPrompt', 'experimental',
];
// `permissionMode: plan` held a project agent in plan mode and not a plugin agent (2.1.283).
// `hooks` and `mcpServers` stay accepted: unobserved for a plugin agent.
const IGNORED_IN_PLUGIN_AGENT = ['permissionMode'];

// 1024 is the Agent Skills spec's hard limit: past it a skill cannot be packaged
// or uploaded, even though Claude Code itself tolerates roughly 1536.
const DESCRIPTION_CAP = 1024;

export function frontmatter(text) {
  const m = text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : null;
}

// The description as one line, read from the same parse as every other frontmatter check,
// so the cap, the budget and the angle-bracket check measure the same text.
export function describe(text) {
  const entry = frontmatterValues(text).find(([k]) => k === 'description');
  return entry ? entry[1].replace(/\s+/g, ' ').trim() : null;
}

// Each top-level key with its value. A folded scalar (`description: >-`) continues until
// the next top-level key, and its header is YAML syntax, not part of the value.
/** @returns {Array<[string, string]>} */
export function frontmatterValues(text) {
  const out = [];
  for (const line of (frontmatter(text) ?? '').split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):(.*)$/);
    if (m) {
      const rest = m[2].trim();
      out.push([m[1], /^[>|]([+-][1-9]?|[1-9][+-]?)?(\s+#.*)?$/.test(rest) ? '' : rest]);
    } else if (out.length) {
      out[out.length - 1][1] += `\n${line.trim()}`;
    }
  }
  return out;
}

export function isListed(text) {
  return !/^disable-model-invocation:\s*true/m.test(frontmatter(text) ?? '');
}

// Every component this marketplace ships: SKILL.md files and agent definitions.
export function components(root = ROOT) {
  const out = [];
  (function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'SKILL.md' || p.includes(`${path.sep}agents${path.sep}`)) out.push(p);
    }
  })(r(root, 'plugins'));
  return out;
}

// The repo-local components under .claude/: project skills and project agents. They are not
// shipped, so they take the frontmatter rules but not the always-on budget.
export function localComponents(root = ROOT) {
  const out = [];
  function walk(dir, isAgents) {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, isAgents);
      else if (isAgents ? e.name.endsWith('.md') : e.name === 'SKILL.md') out.push(p);
    }
  }
  walk(r(root, '.claude', 'skills'), false);
  walk(r(root, '.claude', 'agents'), true);
  return out;
}

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// `files` cannot default to `components(root)` in the signature: `root` is declared after it.
export function checkFrontmatter(files, root = ROOT) {
  const bad = [];
  for (const p of files ?? components(root)) {
    if (!fs.existsSync(p)) continue;
    const text = read(p);
    const isSkill = path.basename(p) === 'SKILL.md';
    const inPlugin = rel(root, p).startsWith('plugins/');
    const d = describe(text);

    if (d === null) { bad.push(`${rel(root, p)} -> no description`); continue; }
    if (d.length > DESCRIPTION_CAP) {
      bad.push(`${rel(root, p)} -> description ${d.length} chars, cap ${DESCRIPTION_CAP}`);
    }
    if (isSkill) {
      const name = (text.match(/^name:\s*(\S+)/m) || [])[1];
      const dir = path.basename(path.dirname(p));
      if (name !== dir) bad.push(`${rel(root, p)} -> name "${name}" must match directory "${dir}"`);
      if (name !== undefined && !KEBAB.test(name)) bad.push(`${rel(root, p)} -> name "${name}" is not kebab-case`);
    } else {
      const name = (frontmatterValues(text).find(([k]) => k === 'name') ?? [])[1]?.trim();
      if (!name) bad.push(`${rel(root, p)} -> no name`);
      // `:` separates the plugin from the agent in a namespaced `plugin:agent` name.
      else if (name.includes(':')) bad.push(`${rel(root, p)} -> name "${name}" contains ':', the plugin namespace separator`);
    }
    const known = isSkill ? KNOWN_SKILL : KNOWN_AGENT;
    for (const [k, value] of frontmatterValues(text)) {
      if (!isSkill && IGNORED_IN_PLUGIN_AGENT.includes(k)) {
        if (inPlugin) bad.push(`${rel(root, p)} -> '${k}' is ignored in a plugin agent; only a project agent honours it (observed on 2.1.283)`);
      } else if (!known.includes(k)) {
        bad.push(`${rel(root, p)} -> unknown frontmatter field '${k}'; it will be ignored at load time`);
      }
      // Skill packaging validation rejects a description containing `<` or `>`.
      if (k === 'description' && /[<>]/.test(value)) bad.push(`${rel(root, p)} -> description contains an angle bracket`);
    }
  }
  return { name: 'frontmatter', findings: bad, ok: bad.length === 0 };
}

// --- always-on description budget -------------------------------------------

// Only descriptions are always-on. Every listed one is paid for in every session
// of every repository that enables the pack, so the total is a managed number
// and the README publishes it. Nothing recomputed it, so editing any description
// silently invalidated a documented figure.
export function budget(root = ROOT) {
  const packs = {};
  let listed = 0, off = 0;
  for (const p of components(root)) {
    const text = read(p);
    const d = describe(text) ?? '';
    const pack = rel(root, p).split('/')[1];
    if (isListed(text)) {
      listed += d.length;
      packs[pack] = (packs[pack] ?? 0) + d.length;
    } else {
      off += d.length;
    }
  }
  return { listed, off, packs };
}

export function checkBudget(root = ROOT) {
  const { listed, packs } = budget(root);
  const readme = read(r(root, 'README.md'));
  const claimed = readme.match(/\*\*([\d.]+)k characters\*\*/);
  const ceiling = readme.match(/The ceiling is\s+([\d,]+)\s+characters/);
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
  if (!ceiling) {
    bad.push('README.md no longer states the always-on ceiling ("The ceiling is N characters") — did the sentence move?');
  } else {
    const max = Number(ceiling[1].replace(/,/g, ''));
    if (listed > max) bad.push(`always-on listing is ${listed} chars, over the ${max}-char ceiling README.md publishes`);
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

export function checkReferences(root = ROOT) {
  const roots = fs
    .readdirSync(r(root, 'plugins'))
    .flatMap((p) => ['skills', 'agents'].map((k) => r(root, 'plugins', p, k)))
    .filter((d) => fs.existsSync(d));

  const bad = [];

  const ownerDir = (file) => {
    let d = path.dirname(file);
    while (d.startsWith(r(root, 'plugins'))) {
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

  for (const componentRoot of roots) {
    (function walk(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!e.name.endsWith('.md')) continue;

        const body = read(p);
        const present = mdFiles(ownerDir(p));
        const cited = new Set([
          ...[...body.matchAll(/`([A-Za-z0-9._/-]+\.md)`/g)].map((m) => m[1]),
          ...[...body.matchAll(/\]\((\.?\/?[A-Za-z0-9._/-]+\.md)(?:#[^)]*)?\)/g)].map((m) => m[1]),
        ]);

        for (const ref of cited) {
          if (CONCEPTUAL.has(path.basename(ref))) continue;
          if (fs.existsSync(path.join(path.dirname(p), ref)) || fs.existsSync(r(root, ref))) continue;
          const elsewhere = present.get(path.basename(ref));
          const inRefs = path.dirname(p).endsWith(`${path.sep}references`);
          if (elsewhere) {
            bad.push(`${rel(root, p)} -> ${ref}: exists at ${rel(root, elsewhere)}, but that path does not resolve from here`);
          } else if (ref.includes('/') || inRefs) {
            bad.push(`${rel(root, p)} -> ${ref}: no such file; if it is in another pack, name the /plugin:skill invocation instead of a path`);
          }
        }
      }
    })(componentRoot);
  }

  return { name: 'references', findings: bad, ok: bad.length === 0 };
}

// --- blocked MCP names match their reference table ---------------------------

// A blocked MCP tool is the one enforcement rule here that rests on a string
// match against a name the server chooses. Nothing errors when a server renames
// a tool: the block silently matches nothing and the table documenting it
// quietly goes stale.
//
// Scans every skill with a `disallowed-tools` line, not just verifying-ui: a
// second skill (testing-changes) blocks a second server's tools on the same
// reasoning, and a check that only ever looked at verifying-ui would let that
// second list drift with nothing to catch it.
export function checkMcpNames(root = ROOT) {
  const bad = [];
  let totalBlocked = 0;
  const skillsRoots = fs
    .readdirSync(r(root, 'plugins'))
    .map((p) => r(root, 'plugins', p, 'skills'))
    .filter((d) => fs.existsSync(d));

  for (const skillsRoot of skillsRoots) {
    for (const name of fs.readdirSync(skillsRoot)) {
      const dir = path.join(skillsRoot, name);
      const skill = path.join(dir, 'SKILL.md');
      if (!fs.existsSync(skill)) continue;
      const body = read(skill);
      const line = (body.match(/^disallowed-tools:(.*)$/m) || [, ''])[1];
      const blocked = line.split(',').map((s) => s.trim()).filter((s) => s.startsWith('mcp__'));
      if (!blocked.length) continue;
      totalBlocked += blocked.length;

      // The name may be documented anywhere under this skill's own directory —
      // its main body or any of its references — not only one fixed file.
      const docs = [skill];
      const refsDir = path.join(dir, 'references');
      if (fs.existsSync(refsDir)) {
        for (const f of fs.readdirSync(refsDir)) if (f.endsWith('.md')) docs.push(path.join(refsDir, f));
      }
      const docText = docs.map((f) => read(f)).join('\n');

      for (const full of blocked) {
        const bare = full.split('__').pop();
        if (!docText.includes('`' + bare + '`')) {
          bad.push(`${rel(root, skill)}: ${full} is blocked but "${bare}" is undocumented anywhere under ${rel(root, dir)}`);
        }
      }
    }
  }

  if (!totalBlocked) bad.push('no mcp__ names blocked anywhere — did every disallowed-tools field move?');
  return { name: 'mcp-names', findings: bad, ok: bad.length === 0, count: totalBlocked };
}

// --- every script parses, every hook target exists ---------------------------

// A script with a syntax error and a script that deliberately blocks are
// indistinguishable by exit code, so this runs before anything behavioural.
export function checkScripts(root = ROOT) {
  const bad = [];
  const mjs = [];
  for (const base of [r(root, 'plugins'), r(root, 'scripts')]) {
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
      bad.push(`${rel(root, p)} -> ${why.trim()}`);
    }
  }

  // Every script named by hooks.json must exist: a renamed file is a dead hook.
  const cfgPath = r(root, 'plugins/core/hooks/hooks.json');
  if (fs.existsSync(cfgPath)) {
    let cfg;
    try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); }
    catch { bad.push('plugins/core/hooks/hooks.json is not valid JSON'); }
    if (cfg) {
      for (const entries of Object.values(cfg.hooks ?? {})) {
        for (const entry of entries) {
          for (const h of entry.hooks ?? []) {
            for (const a of h.args ?? []) {
              const p = String(a).replace('${CLAUDE_PLUGIN_ROOT}', r(root, 'plugins/core'));
              if (p.includes('/') && !fs.existsSync(p)) bad.push(`hooks.json names a missing script: ${rel(root, p)}`);
            }
          }
        }
      }
    }
  }
  return { name: 'scripts', findings: bad, ok: bad.length === 0 };
}

// --- one shared release version ----------------------------------------------

// An existing install updates only when `version` changes, and a pack without one updates
// on every commit to the installed branch. One number, plugin.json only: it overrides a
// marketplace entry's, and setting both draws a validator mismatch warning (plugins
// reference, read for CLI 2.1.283). Unreleased commits are not a finding; CI warns on them.
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const MARKETPLACE = '.claude-plugin/marketplace.json';

// The raw entries, for the fields pack-graph's packs() does not carry.
function marketplaceEntries(root) {
  try {
    const list = JSON.parse(read(r(root, MARKETPLACE))).plugins;
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}

// packs() is the one walk from a marketplace entry to its pack, shared with pack-graph.mjs.
// It throws on the first entry it cannot follow; that becomes a finding naming the entry.
function loadPacks(root) {
  try {
    return { list: packs(root), findings: [] };
  } catch (error) {
    return { list: [], findings: [packsFailure(root, error)] };
  }
}

function packsFailure(root, error) {
  const entries = marketplaceEntries(root);
  if (!entries) return `${MARKETPLACE} is missing, not valid JSON, or has no plugins list, so no pack was checked`;
  for (const entry of entries) {
    if (typeof entry?.source !== 'string') {
      return `${MARKETPLACE} -> entry "${entry?.name}" has a non-path source, so no pack was checked`;
    }
    const manifest = r(root, entry.source, '.claude-plugin', 'plugin.json');
    try {
      JSON.parse(read(manifest));
    } catch {
      return `${rel(root, manifest)} is missing or not valid JSON, so no pack was checked`;
    }
  }
  return `the packs could not be read, so none was checked: ${error.message}`;
}

function packVersions(root) {
  const { list, findings } = loadPacks(root);
  const versions = list.map((pack) => {
    const manifest = r(root, pack.dir, '.claude-plugin', 'plugin.json');
    return [rel(root, manifest), JSON.parse(read(manifest)).version];
  });
  return { versions, findings };
}

export function checkVersions(root = ROOT) {
  const { versions, findings: bad } = packVersions(root);
  const entries = marketplaceEntries(root) ?? [];
  if (entries.length === 0 && bad.length === 0) bad.push(`${MARKETPLACE} lists no plugins, so no version was checked`);
  for (const entry of entries) {
    if (entry && typeof entry === 'object' && 'version' in entry) {
      bad.push(`${MARKETPLACE} -> entry "${entry.name}" declares version; it belongs in plugin.json only`);
    }
  }
  const seen = new Map();
  for (const [manifest, version] of versions) {
    if (version === undefined) bad.push(`${manifest} -> no version`);
    else if (!SEMVER.test(String(version))) bad.push(`${manifest} -> version "${version}" is not X.Y.Z`);
    else seen.set(manifest, version);
  }
  if (new Set(seen.values()).size > 1) {
    bad.push(`plugin versions differ: ${[...seen].map(([p, v]) => `${p} ${v}`).join(', ')}`);
  }
  return { name: 'versions', findings: bad, ok: bad.length === 0 };
}

// --- the released version has its CHANGELOG section --------------------------

// The release notes are that version's CHANGELOG.md section, so a version without one
// releases with no notes.
export function checkChangelog(root = ROOT) {
  const { versions, findings: bad } = packVersions(root);
  const wanted = new Set(versions.map(([, v]) => String(v)).filter((v) => SEMVER.test(v)));
  if (wanted.size) {
    let text = null;
    try { text = read(r(root, 'CHANGELOG.md')); }
    catch { bad.push('CHANGELOG.md is missing'); }
    for (const v of text === null ? [] : wanted) {
      if (!new RegExp(`^## ${v.replace(/\./g, '\\.')}(\\s|$)`, 'm').test(text)) {
        bad.push(`CHANGELOG.md has no "## ${v}" section for plugin version ${v}`);
      }
    }
  }
  return { name: 'changelog', findings: bad, ok: bad.length === 0 };
}

// --- every skill directory holds a SKILL.md ------------------------------------

export function checkSkillDirs(root = ROOT) {
  const { list, findings: bad } = loadPacks(root);
  const dirs = list.flatMap((pack) => pack.skills.map((s) => r(root, s.dir)));
  const local = r(root, '.claude', 'skills');
  if (fs.existsSync(local)) dirs.push(...fs.readdirSync(local).map((name) => path.join(local, name)));
  for (const dir of dirs) {
    if (fs.statSync(dir).isDirectory() && !fs.existsSync(path.join(dir, 'SKILL.md'))) {
      bad.push(`${rel(root, dir)} -> no SKILL.md`);
    }
  }
  return { name: 'skill-dirs', findings: bad, ok: bad.length === 0 };
}

// --- ${CLAUDE_PLUGIN_ROOT} paths resolve inside their own pack ----------------

// The variable is the root of the pack that holds the component, so a path into another
// pack, or a renamed script, resolves to nothing at runtime.
const PLUGIN_ROOT_REF = /\$\{CLAUDE_PLUGIN_ROOT\}\/([A-Za-z0-9._/-]*[A-Za-z0-9_-])/g;

export function checkPluginRoot(root = ROOT) {
  const { list, findings: bad } = loadPacks(root);
  const files = components(root);
  for (const pack of list) {
    const packDir = r(root, pack.dir);
    for (const p of files.filter((f) => f.startsWith(packDir + path.sep))) {
      const refs = new Set([...read(p).matchAll(PLUGIN_ROOT_REF)].map((m) => m[1]));
      for (const ref of refs) {
        const resolved = path.resolve(packDir, ref);
        const inside = resolved === packDir || resolved.startsWith(packDir + path.sep);
        if (!inside || !fs.existsSync(resolved)) {
          bad.push(`${rel(root, p)} -> \${CLAUDE_PLUGIN_ROOT}/${ref} does not resolve inside ${pack.dir}`);
        }
      }
    }
  }
  return { name: 'plugin-root', findings: bad, ok: bad.length === 0 };
}

// --- runner -----------------------------------------------------------------

export const CHECKS = {
  frontmatter: (root = ROOT) => checkFrontmatter([...components(root), ...localComponents(root)], root),
  'skill-dirs': checkSkillDirs,
  budget: checkBudget,
  references: checkReferences,
  'mcp-names': checkMcpNames,
  scripts: checkScripts,
  'plugin-root': checkPluginRoot,
  versions: checkVersions,
  changelog: checkChangelog,
};

export function runChecks(names = Object.keys(CHECKS), root = ROOT) {
  return names.map((n) => CHECKS[n](root));
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

// `import.meta.main` holds through a symlinked launch; older Node leaves it undefined, and
// silently running nothing there would let the Stop hook and CI pass unchecked.
if (import.meta.main) cli();
else if (import.meta.main === undefined) {
  console.error(`validate.mjs requires Node 22.18+ or 24.2+, this is Node ${process.versions.node}.`);
  process.exit(1);
}
