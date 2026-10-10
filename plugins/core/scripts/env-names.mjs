#!/usr/bin/env node
// Lists the variable names a dotenv-style file defines, never their values:
// `node env-names.mjs <file>...`. A value is not written to stdout or stderr, nor is a
// continuation line of a quoted value or of an unquoted PEM block (`-----BEGIN ` to
// `-----END `). Limit: a continuation line of any other unquoted multi-line value that
// looks like `NAME=...` is read as a definition, and its left side printed as a name;
// dotenv itself does not allow unquoted multi-line values. A file whose name is not
// `.env` or `.env.*` is refused unread.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const PEM_BEGIN = '-----BEGIN ';
const PEM_END = '-----END ';
const DOTENV_FILE = /(^|[\\/])\.env(\.[^\\/]*)?$/i;

/**
 * Variable names defined by dotenv-style text, in order, without repeats.
 * @param {string} text
 * @returns {string[]}
 */
export function envNames(text) {
  const names = new Set();
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const name = line
      .slice(0, eq)
      .replace(/^export\s+/, '')
      .trim();
    if (!NAME.test(name)) continue;
    names.add(name);
    // A quoted value may span lines; its continuation lines are value text, not definitions.
    const value = line.slice(eq + 1).trimStart();
    const quote = value[0];
    if (quote === '"' || quote === "'" || quote === '`') {
      let rest = value.slice(1);
      while (!closesQuote(rest, quote) && i + 1 < lines.length) rest = lines[++i];
    } else if (value.startsWith(PEM_BEGIN) && !value.includes(PEM_END)) {
      // A pasted key is unquoted multi-line; its base64 lines can end in `=` and look like names.
      while (i + 1 < lines.length && !lines[++i].includes(PEM_END));
    }
  }
  return [...names];
}

/** Whether `text` holds the closing quote; a backslash escapes only inside double quotes. */
function closesQuote(text, quote) {
  for (let k = 0; k < text.length; k++) {
    if (quote === '"' && text[k] === '\\') k++;
    else if (text[k] === quote) return true;
  }
  return false;
}

function main(files) {
  if (files.length === 0) {
    process.stderr.write('usage: env-names.mjs <file>...\n');
    return 2;
  }
  let status = 0;
  for (const file of files) {
    // A key or certificate is not dotenv text, and a line of it could print as a name.
    if (!DOTENV_FILE.test(file)) {
      process.stderr.write(`env-names: refusing ${file}: not a dotenv file name (.env or .env.*)\n`);
      status = 1;
      continue;
    }
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch (err) {
      process.stderr.write(`env-names: cannot read ${file} (${err.code ?? 'error'})\n`);
      status = 1;
      continue;
    }
    if (files.length > 1) process.stdout.write(`${file}:\n`);
    for (const name of envNames(text)) process.stdout.write(`${name}\n`);
  }
  return status;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
