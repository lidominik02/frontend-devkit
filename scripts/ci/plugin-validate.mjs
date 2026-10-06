#!/usr/bin/env node
// Runs `claude plugin validate --strict` on the marketplace and every pack it lists.
// Exit 0 = every target clean; exit 1 = a `❯` finding or a non-zero exit, as `::error::` lines.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'marketplace.json'), 'utf8'));
const targets = ['.', ...manifest.plugins.map((p) => p.source)];

let failed = false;
for (const target of targets) {
  const res = spawnSync('claude', ['plugin', 'validate', target, '--strict'], { cwd: ROOT, encoding: 'utf8' });
  if (res.error) {
    console.log(`::error::${target}: could not run claude plugin validate: ${res.error.message}`);
    failed = true;
    continue;
  }
  const out = `${res.stdout ?? ''}${res.stderr ?? ''}`;
  const findings = out.split(/\r?\n/).filter((line) => line.includes('❯'));
  if (res.status !== 0 || findings.length > 0) {
    console.log(`::error::${target} failed claude plugin validate --strict (exit ${res.status ?? res.signal})`);
    for (const line of findings) console.log(`::error::${target}: ${line.trim()}`);
    process.stdout.write(out.endsWith('\n') || out === '' ? out : `${out}\n`);
    failed = true;
  } else {
    console.log(`${target} ok`);
  }
}

process.exit(failed ? 1 : 0);
