// Reads a shell command the way a POSIX shell does -- quotes, escapes,
// separators, heredoc bodies, substitutions -- and finds the command each
// simple command really runs. Shared by the PreToolUse hooks that judge a
// command by its invocations rather than by its text. Importing this module
// has no side effects.

/**
 * `subs` holds the text of each substitution in the command, `stdin` each
 * heredoc body and here-string fed to it, `redirects` the target of each `<`,
 * `<>` and `N<` redirect, and `piped` marks a command whose stdin is a pipe or
 * a `<` redirect.
 * @typedef {{ words: string[], start: number, end: number, subs: string[], stdin: string[], redirects: string[], piped: boolean }} SimpleCommand
 */
/** @typedef {{ delim: string, strip: boolean, into: string[] | null }} Heredoc */

const META = new Set([' ', '\t', '\n', ';', '&', '|', '<', '>', '(', ')']);

/** Thrown by parseShell on an unterminated quote or substitution. */
export class Unparsable extends Error {}

/**
 * Splits `src` into simple commands, each word with its quoting removed, and
 * collects the text of every `$(...)`, backtick or `<(...)` substitution met
 * on the way. Throws Unparsable on an unterminated quote or substitution.
 *
 * One departure from a shell: an unquoted word that starts with a drive path
 * (`C:\`) keeps each backslash that precedes an ordinary character, so a
 * Windows path such as `C:\Progra~1\Git\cmd\git` survives as written.
 * @param {string} src
 * @returns {SimpleCommand[]}
 */
export function parseShell(src) {
  const n = src.length;
  /** @type {SimpleCommand[]} */
  const cmds = [];
  /** @type {Heredoc[]} */
  const heredocs = [];
  // Heredocs in a substitution with no delimiter line past the scan position;
  // the scan only moves forward, so an entry never goes stale.
  /** @type {Set<string>} */
  const absent = new Set();
  /** @returns {SimpleCommand} */
  const blank = () => ({ words: [], start: -1, end: -1, subs: [], stdin: [], redirects: [], piped: false });
  let cur = blank();
  let i = 0;
  let redirectTarget = false;
  let hereString = false;
  let inputTarget = false;
  let lastWordEnd = -1;

  /** @returns {never} */
  const fail = () => { throw new Unparsable(); };

  const endCommand = () => {
    cur.end = i;
    cmds.push(cur);
    cur = blank();
    redirectTarget = false;
    hereString = false;
    inputTarget = false;
  };

  /** @param {number} j */
  const processSubstitutionAt = (j) => (src[j] === '<' || src[j] === '>') && src[j + 1] === '(';

  /**
   * Reads a heredoc operator's delimiter, with `i` just past its `<<`, or
   * returns null when no word follows it.
   * @param {string[] | null} into @returns {Heredoc | null}
   */
  const heredoc = (into) => {
    const strip = src[i] === '-';
    if (strip) i++;
    while (src[i] === ' ' || src[i] === '\t') i++;
    if (i >= n || META.has(src[i])) return null;
    return { delim: word(), strip, into };
  };

  /**
   * Reads the heredoc body that starts at `i`: its text and the offset where
   * shell text resumes, or null when no delimiter line comes. Inside a
   * substitution, a line that starts with the delimiter and a `)` also ends
   * the body, and the `)` stays syntax, as bash 5.2.21 reads it.
   * @param {Heredoc} h @param {boolean} inSub
   * @returns {{ body: string, next: number, paren: boolean } | null}
   */
  const heredocBody = ({ delim, strip }, inSub) => {
    let body = '';
    for (let at = i; at < n;) {
      let eol = src.indexOf('\n', at);
      if (eol < 0) eol = n;
      const line = src.slice(at, eol);
      const text = strip ? line.replace(/^\t+/, '') : line;
      if (text === delim) return { body, next: eol + 1, paren: false };
      if (inSub && text.startsWith(`${delim})`)) return { body, next: eol - text.length + delim.length, paren: true };
      body += `${line}\n`;
      at = eol + 1;
    }
    return null;
  };

  /** Consumes each pending heredoc body; one whose delimiter never comes takes the rest. @param {Heredoc[]} pending */
  const heredocBodies = (pending) => {
    for (const h of pending) {
      const read = heredocBody(h, false);
      h.into?.push(read?.body ?? src.slice(i));
      i = read?.next ?? n;
    }
    pending.length = 0;
  };

  /**
   * Consumes the heredoc bodies pending inside a substitution. One whose
   * delimiter line never comes was a shift (`$((1<<2))`), not an operator, so it
   * takes no body and the word read as its delimiter stands as text. A body
   * that ends at `delim)` leaves the heredocs after it for the next line.
   * @param {Heredoc[]} pending
   */
  const substitutionBodies = (pending) => {
    let k = 0;
    while (k < pending.length) {
      const h = pending[k++];
      const key = `${+h.strip}${h.delim}`;
      const read = absent.has(key) ? null : heredocBody(h, true);
      if (!read) { absent.add(key); continue; }
      i = read.next;
      if (read.paren) break;
    }
    pending.splice(0, k);
  };

  const single = () => {
    const close = src.indexOf("'", i + 1);
    if (close < 0) fail();
    const s = src.slice(i + 1, close);
    i = close + 1;
    return s;
  };

  const ansiC = () => {
    let out = '';
    for (i += 2; i < n; i++) {
      if (src[i] === '\\') { out += src[++i] ?? ''; continue; }
      if (src[i] === "'") { i++; return out; }
      out += src[i];
    }
    return fail();
  };

  const backtick = () => {
    let out = '';
    for (i++; i < n; i++) {
      if (src[i] === '\\') { out += src[++i] ?? ''; continue; }
      if (src[i] === '`') { i++; return out; }
      out += src[i];
    }
    return fail();
  };

  // Returns the text between `$(` (or `<(`, `>(`) and its matching `)`. A
  // heredoc body inside is skipped, since its quotes and parens are not syntax.
  const substitution = () => {
    i += 2;
    const from = i;
    let depth = 1;
    /** @type {Heredoc[]} */
    const pending = [];
    while (i < n) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === "'") { single(); continue; }
      if (c === '"') { double(false); continue; }
      if (c === '`') { backtick(); continue; }
      if (src.startsWith('<<<', i)) { i += 3; continue; }
      if (src.startsWith('<<', i)) {
        i += 2;
        const h = heredoc(null);
        if (h) pending.push(h);
        continue;
      }
      if (c === '\n') { i++; substitutionBodies(pending); continue; }
      if (c === '(') depth++;
      else if (c === ')' && --depth === 0) { i++; return src.slice(from, i - 1); }
      i++;
    }
    return fail();
  };

  /** @param {boolean} collect whether substitutions found here belong to this command */
  const double = (collect) => {
    let out = '';
    i++;
    while (i < n) {
      const c = src[i];
      if (c === '"') { i++; return out; }
      if (c === '\\' && '"\\$`\n'.includes(src[i + 1] ?? 'x')) {
        if (src[i + 1] !== '\n') out += src[i + 1];
        i += 2;
        continue;
      }
      if ((c === '$' && src[i + 1] === '(') || c === '`') {
        const at = i;
        const inner = c === '`' ? backtick() : substitution();
        if (collect) cur.subs.push(inner);
        out += src.slice(at, i);
        continue;
      }
      out += c;
      i++;
    }
    return fail();
  };

  const word = () => {
    let out = '';
    const drivePath = /^[A-Za-z]:\\/.test(src.slice(i, i + 3));
    while (i < n && (!META.has(src[i]) || processSubstitutionAt(i))) {
      const c = src[i];
      if (c === "'") out += single();
      else if (c === '"') out += double(true);
      else if (c === '\\' && drivePath && i + 1 < n && !META.has(src[i + 1]) && !'\'"$`\\'.includes(src[i + 1])) { out += c; i++; }
      else if (c === '\\') { if (src[i + 1] !== '\n') out += src[i + 1] ?? ''; i += 2; }
      else if (c === '$' && src[i + 1] === "'") out += ansiC();
      else if ((c === '$' && src[i + 1] === '(') || c === '`' || processSubstitutionAt(i)) {
        const at = i;
        cur.subs.push(c === '`' ? backtick() : substitution());
        out += src.slice(at, i);
      } else { out += c; i++; }
    }
    return out;
  };

  const redirection = () => {
    // A descriptor glued to the operator (2>&1) belongs to it, not to the arguments.
    if (lastWordEnd === i && /^\d+$/.test(cur.words[cur.words.length - 1] ?? '')) cur.words.pop();
    if (src.startsWith('<<<', i)) { i += 3; redirectTarget = true; hereString = true; return; }
    if (src.startsWith('<<', i)) { i += 2; heredocs.push(heredoc(cur.stdin) ?? fail()); return; }
    inputTarget = src[i] === '<';
    if (src[i] === '&') i++; // &> and &>>
    else if (src[i] === '<') cur.piped = true; // stdin from a file or a process substitution
    i++;
    if (i < n && '>&|'.includes(src[i])) i++;
    redirectTarget = true;
  };

  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === '\\' && src[i + 1] === '\n') { i += 2; continue; }
    if (c === '\n') { endCommand(); i++; heredocBodies(heredocs); continue; }
    if (c === '#') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === ';' || c === '(' || c === ')') { endCommand(); i++; continue; }
    if (c === '|') {
      const or = src[i + 1] === '|';
      endCommand();
      cur.piped = !or;
      i += or || src[i + 1] === '&' ? 2 : 1;
      continue;
    }
    if (c === '&' && src[i + 1] !== '>') { endCommand(); i += src[i + 1] === '&' ? 2 : 1; continue; }
    if ((c === '<' || c === '>' || c === '&') && !processSubstitutionAt(i)) { redirection(); continue; }
    const at = i;
    const w = word();
    if (redirectTarget) {
      if (hereString) cur.stdin.push(w);
      else if (inputTarget) cur.redirects.push(w);
      redirectTarget = false;
      hereString = false;
      inputTarget = false;
    } else {
      if (cur.start < 0) cur.start = at;
      cur.words.push(w);
    }
    lastWordEnd = i;
  }
  endCommand();
  return cmds;
}

// --- command structure -------------------------------------------------------

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*\+?=/;
const RESERVED = new Set(['!', '{', 'if', 'then', 'else', 'elif', 'do', 'while', 'until']);
const WRAPPERS = new Set(['command', 'exec', 'nohup', 'time']);

/** Shells whose script shellInput finds, by commandName. */
export const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'pwsh', 'powershell', 'cmd']);

/**
 * A command word's name as it is compared: its basename at the last `/` or
 * `\`, without a trailing `.exe`, `.cmd` or `.bat`, lowercased, so `git`,
 * `GIT.EXE` and `C:\Progra~1\Git\cmd\git` all read as `git`.
 * @param {string} word
 */
export function commandName(word) {
  return word.slice(Math.max(word.lastIndexOf('/'), word.lastIndexOf('\\')) + 1).replace(/\.(?:exe|cmd|bat)$/i, '').toLowerCase();
}

/**
 * The words from the command name on, past assignments, reserved words,
 * wrappers (`command`, `exec`, `nohup`, `time`) and `env` with its options,
 * an `env -S` string split into words.
 * @param {string[]} input
 */
export function commandWords(input) {
  let words = input;
  let k = 0;
  while (k < words.length) {
    const w = words[k];
    if (ASSIGNMENT.test(w) || RESERVED.has(w)) { k++; continue; }
    if (w === 'env') {
      k++;
      while (k < words.length && (ASSIGNMENT.test(words[k]) || words[k].startsWith('-'))) {
        const split = envSplitString(words, k);
        if (split) {
          words = [...words.slice(0, k), ...split.words, ...words.slice(k + split.width)];
          continue;
        }
        k += ['-u', '-C', '--unset', '--chdir'].includes(words[k]) ? 2 : 1;
      }
      continue;
    }
    if (WRAPPERS.has(w)) {
      if (w === 'command' && /^-[A-Za-z]*[vV]/.test(words[k + 1] ?? '')) break; // looks up, never runs
      k++;
      while (k < words.length && words[k].startsWith('-')) k += w === 'exec' && words[k] === '-a' ? 2 : 1;
      continue;
    }
    break;
  }
  return words.slice(k);
}

/**
 * The words of an `env -S` / `--split-string` string at `words[k]`, and how
 * many words the option spans, or null when `words[k]` is another option.
 * @param {string[]} words @param {number} k
 * @returns {{ words: string[], width: number } | null}
 */
export function envSplitString(words, k) {
  const w = words[k];
  let text;
  let width = 1;
  if (w === '-S' || w === '--split-string') { text = words[k + 1] ?? ''; width = 2; }
  else if (/^-S./.test(w)) text = w.slice(2);
  else if (w.startsWith('--split-string=')) text = w.slice('--split-string='.length);
  else return null;
  return { words: splitEnvString(text), width };
}

// env splits its -S string at blanks, honouring quotes and backslashes, and
// treats `;`, `&` and `|` as ordinary characters, so a shell tokeniser would
// cut the string short.
/** @param {string} text */
function splitEnvString(text) {
  /** @type {string[]} */
  const words = [];
  let word = '';
  let inWord = false;
  let quote = '';
  for (let k = 0; k < text.length; k++) {
    const c = text[k];
    if (quote) {
      if (c === quote) quote = '';
      else if (c === '\\' && quote === '"' && k + 1 < text.length) word += text[++k];
      else word += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      inWord = true;
    } else if (c === '\\' && k + 1 < text.length) {
      word += text[++k];
      inWord = true;
    } else if (/\s/.test(c)) {
      if (inWord) words.push(word);
      word = '';
      inWord = false;
    } else {
      word += c;
      inWord = true;
    }
  }
  if (inWord) words.push(word);
  return words;
}

// pwsh and powershell read `-c` and any spelling of `-Command` from `-com` on,
// in any case; every word after it is the script.
const PWSH_COMMAND = /^-(?:c|com(?:m(?:a(?:n(?:d)?)?)?)?)$/i;
const PWSH_FILE = /^-(?:f|file)$/i;
const CMD_RUN = /^\/\/?[ck]/i;

/**
 * Where a shell invocation reads its script, `words[0]` being the shell. For
 * a POSIX shell: the `-c` string, or stdin when there is no `-c` and no
 * script-file operand (or `-s` is given). For pwsh and powershell: the words
 * after `-Command` (`-c`), or from the first word that is not an option on,
 * stdin when `-Command` is `-` or when there are no such words, nothing after
 * `-File`. For cmd: the words after `/c` or `/k` (`//c` as Git Bash spells
 * it), text glued to the switch included, else stdin.
 * @param {string[]} words
 * @returns {{ script: string | null, stdin: boolean }}
 */
export function shellInput(words) {
  const name = commandName(words[0] ?? '');
  if (name === 'pwsh' || name === 'powershell') {
    for (let k = 1; k < words.length; k++) {
      if (PWSH_FILE.test(words[k])) return { script: null, stdin: false };
      if (PWSH_COMMAND.test(words[k])) {
        const script = words.slice(k + 1).join(' ');
        return script === '-' ? { script: null, stdin: true } : { script, stdin: false };
      }
      // powershell 5.1 runs its first positional word as -Command. pwsh opens it
      // as a file, but reading it as a script misses nothing. An option's value
      // read as a script only puts one more word in front.
      if (!words[k].startsWith('-')) return { script: words.slice(k).join(' '), stdin: false };
    }
    return { script: null, stdin: true };
  }
  if (name === 'cmd') {
    const k = words.findIndex((w, j) => j > 0 && CMD_RUN.test(w));
    if (k < 0) return { script: null, stdin: true };
    // cmd takes the command glued to the switch too: `/cgit push`, `/c"git push"`.
    const glued = words[k].replace(CMD_RUN, '');
    return { script: [glued, ...words.slice(k + 1)].join(' ').trim(), stdin: false };
  }
  let k = 1;
  let hasC = false;
  let hasS = false;
  while (k < words.length) {
    const w = words[k];
    if (w === '--') { k++; break; }
    if (/^[-+][oO]$/.test(w)) { k += 2; continue; }
    if (/^-[A-Za-z]+$/.test(w)) {
      if (w.includes('c')) hasC = true;
      if (w.includes('s')) hasS = true;
      k++;
      continue;
    }
    if (w.startsWith('-') || w.startsWith('+')) { k++; continue; }
    break;
  }
  return { script: hasC ? words[k] ?? null : null, stdin: !hasC && (hasS || k >= words.length) };
}
