#!/usr/bin/env node
// PostToolUse: recompute the always-on description budget after a component edit.
//
// Descriptions are the only part of this marketplace that is always loaded, in
// every session of every repository that enables the pack. README.md publishes
// the total as a managed number. Nothing recomputed it, so editing any listed
// description silently invalidated a documented figure — and moving a skill to
// `disable-model-invocation` changed it without touching a description at all.
//
// Speaks only when the recomputed total no longer matches what README.md claims.

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkBudget } from '../validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let event = {};
try { event = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }

const file = event?.tool_input?.file_path;
if (!file) process.exit(0);

const rel = path.relative(ROOT, path.resolve(ROOT, file));
const touchesBudget =
  !rel.startsWith('..') &&
  ((rel.startsWith('plugins') &&
    (path.basename(rel) === 'SKILL.md' || rel.includes(`${path.sep}agents${path.sep}`))) ||
   rel === 'README.md');
if (!touchesBudget) process.exit(0);

const { ok, findings, listed, packs } = checkBudget();
if (ok) process.exit(0);

const breakdown = Object.entries(packs)
  .map(([k, v]) => `  ${k.padEnd(6)} ${String(v).padStart(5)} chars`)
  .join('\n');

console.error(
  `${findings.join('\n')}\n\n` +
  `Always-on listing now ${listed} chars:\n${breakdown}\n\n` +
  'Update the figure in README.md, or bring the description back under it. ' +
  'This is a real cost: every listed description is paid for in every session ' +
  'of every repository that enables the pack.'
);
process.exit(2);
