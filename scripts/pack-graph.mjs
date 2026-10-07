#!/usr/bin/env node
// Derives the pack layering from the manifests, so nothing has to restate it.
//
// A pack's dependencies name its layer. `core` is framework-agnostic and every
// pack depends on it, so it never forms a family; a pack's NON-core dependency
// is its base, and that pair is what the delta contract governs: the
// specialisation carries only what its layer inverts or adds, and names the base
// rules that do not apply there.
//
// Today that is vue -> nuxt. Adding react and next creates react -> next with no
// change here, because the relationship is read from plugin.json rather than
// written down anywhere.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Printed and `--json` paths use `/` on every OS.
const rel = (root, p) => path.relative(root, p).split(path.sep).join('/');

const AGNOSTIC = 'core';

const MARKETPLACE = '.claude-plugin/marketplace.json';

// Thrown when a marketplace entry cannot be followed; the message names the entry or the file.
const unfollowable = (message) => Object.assign(new Error(message), { code: 'ERR_PACK_UNFOLLOWABLE' });

/** @param {string} file */
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

export function packs(root = ROOT) {
  const list = readJson(path.join(root, MARKETPLACE))?.plugins;
  if (!Array.isArray(list)) throw unfollowable(`${MARKETPLACE} is missing, not valid JSON, or has no plugins list`);
  return list.map((entry) => {
    if (typeof entry?.source !== 'string') {
      throw unfollowable(`${MARKETPLACE} -> entry "${entry?.name}" has a non-path source`);
    }
    const dir = path.join(root, entry.source);
    const manifest = path.join(dir, '.claude-plugin/plugin.json');
    const meta = readJson(manifest);
    if (meta === null || typeof meta !== 'object') throw unfollowable(`${rel(root, manifest)} is missing or not valid JSON`);
    const deps = (meta.dependencies ?? []).map((d) => d.name);

    const skillsDir = path.join(dir, 'skills');
    const skills = fs.existsSync(skillsDir)
      ? fs.readdirSync(skillsDir).map((name) => {
          const refsDir = path.join(skillsDir, name, 'references');
          const refs = fs.existsSync(refsDir)
            ? fs.readdirSync(refsDir).filter((f) => f.endsWith('.md')).sort()
            : [];
          return { name, refs, dir: rel(root, path.join(skillsDir, name)) };
        })
      : [];

    const evalsDir = path.join(dir, 'evals');
    const cases = fs.existsSync(evalsDir)
      ? fs.readdirSync(evalsDir, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => e.name)
          .sort()
      : [];

    return {
      name: meta.name,
      version: meta.version,
      deps,
      // The base is what this pack specialises. `core` is excluded: it is the
      // floor everything stands on, not a layer anything inverts.
      base: deps.find((d) => d !== AGNOSTIC) ?? null,
      skills,
      cases,
      dir: rel(root, dir),
    };
  });
}

// A family is one base and one pack specialising it. Chains are expressed as
// overlapping pairs, so a three-deep stack yields two families and each is
// checked against its own immediate base rather than the root.
export function families(all = packs()) {
  return all
    .filter((p) => p.base)
    .map((p) => ({ base: all.find((b) => b.name === p.base), specialisation: p }))
    .filter((f) => f.base);
}

// Counterpart naming is not uniform: a pack often prefixes its own name onto a
// reference that mirrors one in its base (review-checklist.md becomes
// nuxt-review-checklist.md). Normalising by stripping that prefix matches the
// pair instead of reporting both as orphans.
export function normalise(file, packName) {
  return file.replace(new RegExp(`^${packName}-`), '');
}

export function compareReferences(family) {
  const b = family.base.skills[0], s = family.specialisation.skills[0];
  if (!b || !s) return null;

  const baseRefs = new Map(b.refs.map((f) => [normalise(f, family.base.name), f]));
  const specRefs = new Map(s.refs.map((f) => [normalise(f, family.specialisation.name), f]));

  const shared = [...baseRefs.keys()].filter((k) => specRefs.has(k));
  return {
    baseSkill: b, specSkill: s,
    shared: shared.map((k) => ({ topic: k, base: baseRefs.get(k), spec: specRefs.get(k) })),
    onlyBase: [...baseRefs.entries()].filter(([k]) => !specRefs.has(k)).map(([, v]) => v),
    onlySpec: [...specRefs.entries()].filter(([k]) => !baseRefs.has(k)).map(([, v]) => v),
  };
}

function cli() {
  const all = packs();
  const fams = families(all);

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ packs: all, families: fams.map((f) => ({
      base: f.base.name, specialisation: f.specialisation.name, references: compareReferences(f),
    })) }, null, 2));
    return;
  }

  console.log('packs');
  for (const p of all) {
    console.log(`  ${p.name.padEnd(8)} deps: ${p.deps.join(', ') || '(none)'}${p.base ? `   specialises: ${p.base}` : ''}`);
  }

  if (!fams.length) {
    console.log('\nNo families: no pack declares a non-core dependency, so nothing is a delta on anything.');
    return;
  }

  for (const f of fams) {
    const cmp = compareReferences(f);
    console.log(`\nfamily: ${f.base.name} -> ${f.specialisation.name}`);
    if (!cmp) { console.log('  one side has no skill; nothing to compare'); continue; }
    console.log(`  ${cmp.baseSkill.dir}  (${cmp.baseSkill.refs.length} refs)`);
    console.log(`  ${cmp.specSkill.dir}  (${cmp.specSkill.refs.length} refs)`);
    console.log(`\n  paired topics (${cmp.shared.length}) — read these side by side:`);
    for (const s of cmp.shared) console.log(`    ${s.topic.padEnd(28)} ${f.base.name}: ${s.base}   ${f.specialisation.name}: ${s.spec}`);
    if (cmp.onlyBase.length) console.log(`\n  only in ${f.base.name} (does the specialisation invert any of it?):\n    ${cmp.onlyBase.join('\n    ')}`);
    if (cmp.onlySpec.length) console.log(`\n  only in ${f.specialisation.name} (is any of it true of the base too?):\n    ${cmp.onlySpec.join('\n    ')}`);
    console.log(`\n  eval cases — ${f.base.name}: ${f.base.cases.join(', ') || '(none)'}`);
    console.log(`  eval cases — ${f.specialisation.name}: ${f.specialisation.cases.join(', ') || '(none)'}`);
  }
}

/**
 * Runs `cli` when `main` (the caller's `import.meta.main`) is true. That holds through a
 * symlinked launch; older Node leaves it undefined, and silently running nothing there would
 * let the Stop hook and CI pass unchecked, so it exits 1 naming the script started.
 * @param {boolean|undefined} main @param {() => void} cli @param {string} name
 */
export function runAsEntry(main, cli, name) {
  if (main) cli();
  else if (main === undefined) {
    const started = process.argv[1] ? path.basename(process.argv[1]) : name;
    console.error(`${started} requires Node 22.18+ or 24.2+, this is Node ${process.versions.node}.`);
    process.exit(1);
  }
}

// An importer (validate.mjs, the hooks) reaches this guard first, so on an older Node the
// message names the script started rather than this one.
runAsEntry(import.meta.main, cli, 'pack-graph.mjs');
