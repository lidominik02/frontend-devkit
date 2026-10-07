#!/usr/bin/env node
// Writes a version's release notes: its CHANGELOG.md section, from the
// `## X.Y.Z - YYYY-MM-DD` heading up to the next `## `. validate.mjs's changelog check
// requires the heading through changelogHeading, so a version that passes it has notes here.
//
// Usage: node scripts/ci/release-notes.mjs <vX.Y.Z | X.Y.Z> <out-file>
// Exit 0 = the notes were written. Exit 1 = no such section, or a usage error.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runAsEntry } from '../pack-graph.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The one heading a version's section may carry. @param {string} version */
export function changelogHeading(version) {
  return new RegExp(`^## ${version.replace(/\./g, '\\.')} - \\d{4}-\\d{2}-\\d{2}$`);
}

/**
 * The version's section, heading included, or null when it has none.
 * @param {string} text the CHANGELOG.md content @param {string} version
 */
export function releaseNotes(text, version) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const heading = changelogHeading(version);
  const start = lines.findIndex((l) => heading.test(l));
  if (start === -1) return null;
  const next = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  return lines.slice(start, next === -1 ? lines.length : next).join('\n').trim();
}

function cli() {
  const [tag, out] = process.argv.slice(2);
  if (!tag || !out) {
    console.error('usage: node scripts/ci/release-notes.mjs <vX.Y.Z | X.Y.Z> <out-file>');
    process.exit(1);
  }
  const version = tag.replace(/^v/, '');
  const notes = releaseNotes(fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8'), version);
  if (notes === null) {
    console.error(`CHANGELOG.md has no "## ${version} - YYYY-MM-DD" section`);
    process.exit(1);
  }
  fs.writeFileSync(out, `${notes}\n`);
}

runAsEntry(import.meta.main, cli, 'release-notes.mjs');
