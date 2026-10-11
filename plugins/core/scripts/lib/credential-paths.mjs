// Whether a path names credential material. Shared by the block-secrets hook,
// which matches tool input against it, and snapshot.mjs, which keeps matching
// files out of every tree and diff it writes; env-names.mjs reads only the files
// isDotenvFile names. Importing this module has no side effects.

// The names both the path rule and the text pattern below are built from.
const SECRET_DIRS = ['secrets', '.ssh', '.gnupg'];
const KEY_EXTENSIONS = ['pem', 'p12', 'pfx', 'keystore', 'key'];
const KEY_FILES = ['id_rsa', 'id_ed25519', 'id_ecdsa'];

/** @param {string} s */
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const IN_SECRET_DIR = new RegExp(`(^|/)(${SECRET_DIRS.map(escape).join('|')})/`);
const KEY_EXTENSION = new RegExp(`\\.(${KEY_EXTENSIONS.join('|')})$`);
const KEY_FILE = new RegExp(`(^|/)(${KEY_FILES.join('|')})(\\.pub)?$`);

// Windows paths arrive with backslashes, and a case-insensitive filesystem
// opens `.env` for `.ENV`, so every path rule compares this form.
/** @param {string} file */
export function normalizePath(file) {
  return file.replace(/\\/g, '/').toLowerCase();
}

/**
 * Whether a file is named like a dotenv file, `.env` or `.env.*`, in any letter
 * case and after either slash. The one rule for the name: the block-secrets hook
 * chooses its dotenv message by it, and env-names.mjs reads only such files.
 * A template (`.env.example`) is named like one too.
 * @param {string} file
 */
export function isDotenvFile(file) {
  const base = normalizePath(file).split('/').pop() ?? '';
  return base === '.env' || base.startsWith('.env.');
}

/** @param {string} file */
export function isCredentialPath(file) {
  const p = normalizePath(file);
  // Templates are documentation, not secrets, and are the common case in a
  // repo. Checked first so no rule below can override the exemption.
  if (/\.(example|sample|template|dist)$/.test(p)) return false;
  const base = p.split('/').pop() ?? '';
  if (isDotenvFile(p)) return true;
  // A file under a dotenv-named directory (`.env.d/secret`), as the text pattern reads it.
  if (p.split('/').slice(0, -1).some((dir) => isDotenvFile(dir) && !/\.(example|sample|template|dist)$/.test(dir))) return true;
  if (IN_SECRET_DIR.test(p)) return true;
  if (/(^|\/)\.aws\/credentials$/.test(p)) return true;
  if (KEY_EXTENSION.test(p)) return true;
  if (KEY_FILE.test(p)) return true;
  if (/serviceaccount[a-z0-9_.-]*\.json$/.test(base)) return true;
  if (base === 'credentials.json') return true;
  return false;
}

/**
 * `s` as regex source; with `caseless`, each letter a class of both its cases.
 * @param {string} s @param {boolean} caseless
 */
const literal = (s, caseless) =>
  [...s].map((c) => (caseless && /[a-z]/i.test(c) ? `[${c.toLowerCase()}${c.toUpperCase()}]` : escape(c))).join('');

// The two dotenv alternatives carry a lookbehind: `\benv\b` alone is satisfied
// by the word boundary *after* "env", so `\.env\b` matches the literal
// substring inside `process.env`, `import.meta.env` and similar identifiers
// with nothing to its left checked. A real dotenv path is preceded by a path
// context -- start of string, whitespace, a quote, `=`, `/`, `\`, or `~` --
// never by an identifier character or another dot.
/**
 * Regex source that finds a dotenv path in a word or a command text. It has no
 * capturing group. Match it with the `i` flag, or pass `caseless` to build it
 * case-insensitive for a regex without one.
 * @param {boolean} [caseless]
 */
export function dotenvPattern(caseless = false) {
  const env = literal('.env', caseless);
  return String.raw`(?<![A-Za-z0-9_.])${env}\b|(?<![A-Za-z0-9_.])${env}\.[A-Za-z0-9_.-]+`;
}

/**
 * Regex source that finds a credential path in a word or a command text, by the
 * names isCredentialPath judges a path with: a dotenv file or a file under a
 * dotenv-named directory, a file under
 * `secrets/`, `.ssh` or `.gnupg` (the last two named bare too: `tar czf x
 * ~/.ssh`), `.aws/credentials`, a key file by extension or `id_*` name, a
 * service-account or `credentials.json` file. It has no capturing group. Match
 * it with the `i` flag, or pass `caseless` to build it case-insensitive for a
 * regex without one, such as a rule that tells an option `-T` from `-t`.
 * @param {boolean} [caseless]
 */
export function credentialPattern(caseless = false) {
  /** @param {string} s */
  const lit = (s) => literal(s, caseless);
  const start = '(?<![A-Za-z0-9_.-])';
  const end = '(?![A-Za-z0-9_.-])';
  // A key extension is the file's last one, as KEY_EXTENSION's `$` reads a path:
  // the word ends after it (`server.key;`, `"server.key"`), so `config.key.js` passes.
  const wordEnd = String.raw`(?=$|[\s'"\x60;|&)<>,])`;
  const dirs = SECRET_DIRS.map((d) => (d.startsWith('.') ? `${start}${lit(d)}${end}` : String.raw`${start}${lit(d)}[\\/]`));
  return [
    dotenvPattern(caseless),
    ...dirs,
    String.raw`${start}${lit('.aws')}[\\/]${lit('credentials')}`,
    ...KEY_FILES.map((f) => String.raw`\b${lit(f)}`),
    ...KEY_EXTENSIONS.map((x) => `${lit(`.${x}`)}${wordEnd}`),
    String.raw`${lit('serviceaccount')}[A-Za-z0-9_.-]*${lit('.json')}`,
    lit('credentials.json'),
  ].join('|');
}
