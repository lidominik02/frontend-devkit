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
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = (...p) => path.join(ROOT, ...p);

const AGNOSTIC = 'core';

export function packs() {
  const manifest = JSON.parse(fs.readFileSync(r('.claude-plugin/marketplace.json'), 'utf8'));
  return manifest.plugins.map((entry) => {
    const dir = path.join(ROOT, entry.source);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, '.claude-plugin/plugin.json'), 'utf8'));
    const deps = (meta.dependencies ?? []).map((d) => d.name);

    const skillsDir = path.join(dir, 'skills');
    const skills = fs.existsSync(skillsDir)
      ? fs.readdirSync(skillsDir).map((name) => {
          const refsDir = path.join(skillsDir, name, 'references');
          const refs = fs.existsSync(refsDir)
            ? fs.readdirSync(refsDir).filter((f) => f.endsWith('.md')).sort()
            : [];
          return { name, refs, dir: path.relative(ROOT, path.join(skillsDir, name)) };
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
      deps,
      // The base is what this pack specialises. `core` is excluded: it is the
      // floor everything stands on, not a layer anything inverts.
      base: deps.find((d) => d !== AGNOSTIC) ?? null,
      skills,
      cases,
      dir: path.relative(ROOT, dir),
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) cli();
