#!/usr/bin/env node
// PostToolUse hook -- formats the file Claude just wrote, so formatting noise
// never reaches code review.
//
// Always exits 0. The edit has already happened by the time this runs, and
// PostToolUse cannot block, so there is no failure to signal.
//
// Node rather than bash: see the note in block-secrets.mjs. A shell hook with a
// syntax error exits 2, the "block" signal, and takes the session down.
//
// Known cost: rewriting a file after Claude wrote it can desynchronise the
// model's view of it, so a follow-up Edit occasionally fails with "old_string
// not found" and has to re-read. That is why this runs a formatter only, never
// a fixer that changes semantics.

import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// A format command from a host repo's manifest is a string from a checked-out
// file handed to a subprocess on every write. Only well-known formatters are
// honoured, and the argument vector is passed without a shell, so a crafted
// manifest cannot execute arbitrary code.
const ALLOWED_FORMATTERS = new Set([
  'prettier', 'biome', 'oxfmt', 'dprint', 'eslint', 'gofmt', 'ruff', 'rustfmt', 'black',
]);

const EXT_PRETTIER = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|vue|svelte|css|scss|less|json|jsonc|md|mdx|yml|yaml|html)$/;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', () => {
  try { main(raw); } catch { /* advisory only */ }
  process.exit(0);
});

/** Walk up from the edited file looking for a local binary. In a pnpm or yarn
 * workspace the formatter is often installed in the workspace package rather
 * than the repo root, where checking only the root would find nothing.
 * @param {string} fromDir @param {string} stopDir @param {string} bin */
function findLocalBin(fromDir, stopDir, bin) {
  let dir = fromDir;
  for (let i = 0; i < 12; i++) {
    const candidate = path.join(dir, 'node_modules', '.bin', bin);
    if (existsSync(candidate)) return candidate;
    if (dir === stopDir || dir === path.dirname(dir)) break;
    dir = path.dirname(dir);
  }
  const atRoot = path.join(stopDir, 'node_modules', '.bin', bin);
  return existsSync(atRoot) ? atRoot : null;
}

/** Whether `file` resolves to a path inside `dir`, symlinks followed on both sides.
 * @param {string} dir @param {string} file */
function inside(dir, file) {
  let rel;
  try { rel = path.relative(realpathSync(dir), realpathSync(file)); } catch { return false; }
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

/** @param {string} bin @param {string[]} args */
function run(bin, args) {
  spawnSync(bin, args, { stdio: 'ignore', timeout: 30_000 });
}

/** @param {string} input */
function main(input) {
  /** @type {any} */
  let evt = {};
  try { evt = JSON.parse(input); } catch { return; }

  const file = String(evt.tool_input?.file_path ?? evt.tool_input?.notebook_path ?? '');
  if (!file) return;
  if (!existsSync(file) || !statSync(file).isFile()) return;

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  // A file outside the project (the user's auto-memory, an --add-dir directory) is not
  // the project's to format, yet findLocalBin's fallback would run the project's formatter.
  if (!inside(projectDir, file)) return;
  const fileDir = path.dirname(path.resolve(file));

  // An explicit format command in the project manifest wins, provided it names
  // a recognised formatter.
  const manifestPath = path.join(projectDir, '.claude', 'project.json');
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      const declared = typeof manifest?.gates?.format === 'string' ? manifest.gates.format.trim() : '';
      if (declared) {
        const parts = declared.split(/\s+/);
        const name = path.basename(parts[0] ?? '');
        if (ALLOWED_FORMATTERS.has(name)) {
          const local = findLocalBin(fileDir, projectDir, name);
          run(local ?? parts[0], [...parts.slice(1), file]);
          return;
        }
        process.stderr.write(
          `devkit format-on-write: ignoring gates.format "${parts[0]}" -- not a recognised formatter. ` +
          `Allowed: ${[...ALLOWED_FORMATTERS].join(', ')}.\n`
        );
      }
    } catch { /* a malformed manifest is not this hook's problem */ }
  }

  if (EXT_PRETTIER.test(file)) {
    const prettier = findLocalBin(fileDir, projectDir, 'prettier');
    if (prettier) run(prettier, ['--write', file]);
    return;
  }
  if (file.endsWith('.go')) { run('gofmt', ['-w', file]); return; }
  if (file.endsWith('.py')) {
    const ruff = findLocalBin(fileDir, projectDir, 'ruff') ?? 'ruff';
    run(ruff, ['format', file]);
    return;
  }
  if (file.endsWith('.rs')) { run('rustfmt', [file]); }
}
