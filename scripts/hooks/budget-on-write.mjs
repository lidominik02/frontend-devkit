#!/usr/bin/env node
// PostToolUse: recompute the always-on description budget after a component edit.
//
// Descriptions are the only part of this marketplace that is always loaded, in
// every session of every repository that enables the pack, so their total has a
// ceiling in devkit.config.json. Moving a skill to `disable-model-invocation`
// changes the total without touching a description at all.
//
// Speaks only when the recomputed total is over the ceiling, the ceiling is unusable, or
// no pack could be read.

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CONFIG, checkBudget } from '../validate.mjs';

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
   rel === CONFIG);
if (!touchesBudget) process.exit(0);

const { ok, unread, unusableConfig, findings, listed, packs } = checkBudget();
if (ok) process.exit(0);

// No pack was read, or no ceiling is usable: the total and the advice would both be wrong.
if (unread || unusableConfig) {
  console.error(findings.join('\n'));
  process.exit(2);
}

const breakdown = Object.entries(packs)
  .map(([k, v]) => `  ${k.padEnd(6)} ${String(v).padStart(5)} chars`)
  .join('\n');

console.error(
  `${findings.join('\n')}\n\n` +
  `Always-on listing now ${listed} chars:\n${breakdown}\n\n` +
  `Bring the description back under the ceiling; raise budget.ceiling in ${CONFIG} only with the user's approval. ` +
  'This is a real cost: every listed description is paid for in every session ' +
  'of every repository that enables the pack.'
);
process.exit(2);
