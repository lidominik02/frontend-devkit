// Whether a path names credential material. Shared by the block-secrets hook,
// which matches tool input against it, and snapshot.mjs, which keeps matching
// files out of every tree and diff it writes. Importing this module has no side
// effects.

// Windows paths arrive with backslashes, and a case-insensitive filesystem
// opens `.env` for `.ENV`, so every path rule compares this form.
/** @param {string} file */
export function normalizePath(file) {
  return file.replace(/\\/g, '/').toLowerCase();
}

/** @param {string} file */
export function isCredentialPath(file) {
  const p = normalizePath(file);
  // Templates are documentation, not secrets, and are the common case in a
  // repo. Checked first so no rule below can override the exemption.
  if (/\.(example|sample|template|dist)$/.test(p)) return false;
  const base = p.split('/').pop() ?? '';
  if (base === '.env' || base.startsWith('.env.')) return true;
  if (/(^|\/)(secrets|\.ssh|\.gnupg)\//.test(p)) return true;
  if (/\/\.aws\/credentials$/.test(p)) return true;
  if (/\.(pem|p12|pfx|keystore|key)$/.test(p)) return true;
  if (/(^|\/)id_(rsa|ed25519|ecdsa)(\.pub)?$/.test(p)) return true;
  if (/serviceaccount[a-z0-9_.-]*\.json$/.test(base)) return true;
  if (base === 'credentials.json') return true;
  return false;
}
