#!/usr/bin/env node
// PostToolUse: validate the frontmatter of the component file just written.
//
// The description IS the triggering mechanism and 1024 is the Agent Skills
// spec's hard cap, so both are worth knowing at the keystroke rather than at
// push. The field allowlist is the part that cannot wait: `plugin validate
// --strict` does not read component frontmatter, so a misspelled
// `disable-model-invocation` loads as silence — the skill just quietly becomes
// model-invocable, and nothing anywhere says so.
//
// Scoped to the one file the event names, so this costs a single fs read.

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkFrontmatter } from '../validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let event = {};
try { event = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }

const file = event?.tool_input?.file_path;
if (!file) process.exit(0);

const abs = path.resolve(ROOT, file);
const rel = path.relative(ROOT, abs);

// Only this marketplace's own components: a SKILL.md, or anything under agents/.
const isComponent =
  rel.startsWith('plugins') &&
  !rel.startsWith('..') &&
  (path.basename(abs) === 'SKILL.md' || rel.includes(`${path.sep}agents${path.sep}`));
if (!isComponent || !fs.existsSync(abs)) process.exit(0);

const { ok, findings } = checkFrontmatter([abs]);
if (ok) process.exit(0);

console.error(
  `Frontmatter problem in the file just written:\n\n${findings.map((f) => `  ${f}`).join('\n')}\n\n` +
  'An unknown field is not an error at load time — Claude Code ignores it — so this ' +
  'will not surface anywhere else until CI.'
);
process.exit(2);
