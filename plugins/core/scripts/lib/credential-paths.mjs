// Whether a path names credential material. Shared by the block-secrets hook,
// which matches tool input against it, and snapshot.mjs, which keeps matching
// files out of every tree and diff it writes. Importing this module has no side
// effects.

/** @param {string} file */
export function isCredentialPath(file) {
  // Templates are documentation, not secrets, and are the common case in a
  // repo. Checked first so no rule below can override the exemption.
  if (/\.(example|sample|template|dist)$/.test(file)) return false;
  const base = file.split('/').pop() ?? '';
  if (base === '.env' || base.startsWith('.env.')) return true;
  if (/(^|\/)(secrets|\.ssh|\.gnupg)\//.test(file)) return true;
  if (/\/\.aws\/credentials$/.test(file)) return true;
  if (/\.(pem|p12|pfx|keystore|key)$/.test(file)) return true;
  if (/(^|\/)id_(rsa|ed25519|ecdsa)(\.pub)?$/.test(file)) return true;
  if (/serviceAccount[A-Za-z0-9_.-]*\.json$/.test(base)) return true;
  if (base === 'credentials.json') return true;
  return false;
}
