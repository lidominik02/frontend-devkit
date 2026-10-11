// Reads a shell command the way a POSIX shell does -- quotes, escapes,
// separators, heredoc bodies, substitutions -- and finds the command each
// simple command really runs, and rewrites a PowerShell command for that same
// reader. Shared by the PreToolUse hooks that judge a command by its
// invocations rather than by its text. Importing this module has no side
// effects.

/**
 * `subs` holds the text of each substitution in the command, those an
 * unquoted heredoc body expands included, `stdin` each
 * heredoc body and here-string fed to it, `redirects` the target of each `<`,
 * `<>` and `N<` redirect, and `piped` marks a command whose stdin is a pipe or
 * a `<` redirect. `spans` holds each word and each redirect target (a
 * here-string's text excepted) with its offsets in the source, quotes included.
 * @typedef {{ value: string, start: number, end: number }} Span
 * @typedef {{ words: string[], start: number, end: number, subs: string[], stdin: string[], redirects: string[], piped: boolean, spans: Span[] }} SimpleCommand
 */
/**
 * `subs` is where the substitutions of the body go when the delimiter is
 * unquoted, which makes the shell expand them; null when it stays literal.
 * @typedef {{ delim: string, strip: boolean, into: string[] | null, subs: string[] | null }} Heredoc
 */

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
  const blank = () => ({ words: [], start: -1, end: -1, subs: [], stdin: [], redirects: [], piped: false, spans: [] });
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
   * returns null when no word follows it. Any quote or backslash in the
   * delimiter keeps the body literal; otherwise its substitutions go to `subs`.
   * @param {string[] | null} into @param {string[] | null} subs @returns {Heredoc | null}
   */
  const heredoc = (into, subs) => {
    const strip = src[i] === '-';
    if (strip) i++;
    while (src[i] === ' ' || src[i] === '\t') i++;
    if (i >= n || META.has(src[i])) return null;
    const at = i;
    const delim = word();
    return { delim, strip, into, subs: /['"\\]/.test(src.slice(at, i)) ? null : subs };
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
      const body = read?.body ?? src.slice(i);
      h.into?.push(body);
      h.subs?.push(...expansions(body));
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
        const h = heredoc(null, null);
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
    if (src.startsWith('<<', i)) { i += 2; heredocs.push(heredoc(cur.stdin, cur.subs) ?? fail()); return; }
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
    if (!hereString) cur.spans.push({ value: w, start: at, end: i });
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

/**
 * The text of each substitution an unquoted heredoc body expands. The body
 * expands as a double-quoted string does, except that a `"` in it is literal,
 * so it is read as one with each such `"` escaped.
 * @param {string} body
 * @returns {string[]}
 */
function expansions(body) {
  let quoted = '';
  for (let k = 0; k < body.length; k++) {
    if (body[k] === '\\') quoted += body.slice(k, ++k + 1);
    else quoted += body[k] === '"' ? '\\"' : body[k];
  }
  return parseShell(`"${quoted}"`).flatMap((cmd) => cmd.subs);
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
    if (commandName(w) === 'env') {
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

/**
 * A pwsh or powershell parameter word: its name, lowercased without the `-`,
 * and the value glued on with `:` (`-Command:"git push"`), or null when the
 * word is no parameter.
 * @param {string} word
 * @returns {{ name: string, value: string | null } | null}
 */
function pwshParameter(word) {
  if (!word.startsWith('-')) return null;
  const colon = word.indexOf(':');
  return colon < 0
    ? { name: word.slice(1).toLowerCase(), value: null }
    : { name: word.slice(1, colon).toLowerCase(), value: word.slice(colon + 1) };
}

// pwsh and powershell read `-c` and any spelling of `-Command` from `-com` on,
// `-e`, `-ec` and any spelling of `-EncodedCommand`, in any case.
/** @param {string} name */
const isPwshCommand = (name) => name === 'c' || (name.length >= 3 && 'command'.startsWith(name));
/** @param {string} name */
const isPwshEncoded = (name) => name === 'ec' || 'encodedcommand'.startsWith(name);
/** @param {string} name */
const isPwshFile = (name) => name === 'f' || name === 'file';
// The other parameters that take a value, so that value is not read as the
// script: `-ExecutionPolicy Bypass -EncodedCommand ...`.
const PWSH_VALUE_PARAMS = [
  'executionpolicy', 'windowstyle', 'outputformat', 'inputformat', 'workingdirectory',
  'configurationname', 'configurationfile', 'settingsfile', 'custompipename', 'version', 'psconsolefile',
];
const PWSH_VALUE_ALIASES = ['ep', 'ex', 'w', 'o', 'of', 'i', 'if', 'wd', 'v'];
/** @param {string} name */
const takesPwshValue = (name) =>
  PWSH_VALUE_ALIASES.includes(name) || (name.length >= 2 && PWSH_VALUE_PARAMS.some((p) => p.startsWith(name)));
// cmd's switches may run together in one word (`/d/c`, `/q/d/cgit`); `/c` or
// `/k` ends them, and any text glued on after it is the command.
const CMD_RUN = /^(?:\/\/?(?:[adqsu]|[eftv]:[a-z0-9]+))*\/\/?[ck]/i;

/**
 * Reads a POSIX shell's options, `words[0]` being the shell: the index of its
 * first operand, whether `-c` or `-s` is given, and whether it echoes what it
 * runs (`-x`, `-v`, `-o xtrace`, `-o verbose`).
 * @param {string[]} words
 */
function posixShellOptions(words) {
  let k = 1;
  let hasC = false;
  let hasS = false;
  let traced = false;
  while (k < words.length) {
    const w = words[k];
    if (w === '--') { k++; break; }
    if (/^[-+][oO]$/.test(w)) {
      if (w === '-o' && /^(?:xtrace|verbose)$/.test(words[k + 1] ?? '')) traced = true;
      k += 2;
      continue;
    }
    if (/^-[A-Za-z]+$/.test(w)) {
      if (w.includes('c')) hasC = true;
      if (w.includes('s')) hasS = true;
      if (/[xv]/.test(w)) traced = true;
      k++;
      continue;
    }
    if (w.startsWith('-') || w.startsWith('+')) { k++; continue; }
    break;
  }
  return { k, hasC, hasS, traced };
}

/**
 * Where a shell invocation reads its script, `words[0]` being the shell. For
 * a POSIX shell: the `-c` string, or stdin when there is no `-c` and no
 * script-file operand (or `-s` is given). For pwsh and powershell: the words
 * after `-Command` (`-c`), or glued to it with `:`, or from the first word
 * that is not an option on; the base64 UTF-16LE text an `-EncodedCommand`
 * (`-e`, `-ec`) decodes to; stdin when `-Command` is `-` or when there are no
 * such words; nothing after `-File`. For cmd: the words after `/c` or `/k`
 * (`//c` as Git Bash spells it, `/d/c` with other switches run together), text
 * glued to the switch included, else stdin.
 * @param {string[]} words
 * @returns {{ script: string | null, stdin: boolean }}
 */
export function shellInput(words) {
  const name = commandName(words[0] ?? '');
  if (name === 'pwsh' || name === 'powershell') {
    for (let k = 1; k < words.length; k++) {
      const param = pwshParameter(words[k]);
      // powershell 5.1 runs its first positional word as -Command. pwsh opens it
      // as a file, but reading it as a script misses nothing. The value of an
      // option not listed below, read as a script, only puts one more word in front.
      if (!param) return { script: words.slice(k).join(' '), stdin: false };
      if (isPwshFile(param.name)) return { script: null, stdin: false };
      if (isPwshCommand(param.name)) {
        const script = [...(param.value === null ? [] : [param.value]), ...words.slice(k + 1)].join(' ');
        return script === '-' ? { script: null, stdin: true } : { script, stdin: false };
      }
      if (param.name && isPwshEncoded(param.name)) {
        const encoded = param.value ?? words[k + 1] ?? '';
        return { script: Buffer.from(encoded, 'base64').toString('utf16le'), stdin: false };
      }
      if (param.value === null && takesPwshValue(param.name)) k++;
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
  const { k, hasC, hasS } = posixShellOptions(words);
  return { script: hasC ? words[k] ?? null : null, stdin: !hasC && (hasS || k >= words.length) };
}

/**
 * The scripts a shell invocation runs, `words[0]` being the shell: its
 * shellInput script, or, when it reads stdin, each heredoc body and
 * here-string `cmd` feeds it. `piped` marks a shell that reads its script from
 * a pipe or a `<` redirect, which can be written anywhere upstream; each hook
 * applies its own policy to that and to how deep it follows a script.
 * @param {string[]} words @param {SimpleCommand} cmd
 * @returns {{ scripts: string[], piped: boolean }}
 */
export function shellScripts(words, cmd) {
  const { script, stdin } = shellInput(words);
  if (script !== null) return { scripts: [script], piped: false };
  if (!stdin) return { scripts: [], piped: false };
  return { scripts: cmd.stdin, piped: cmd.piped };
}

/**
 * The words a POSIX shell's `-c` script reads as its positional parameters,
 * `$0` first (`sh -c 'cat "$1"' _ f` gives `['_', 'f']`), or none.
 * @param {string[]} words
 * @returns {string[]}
 */
export function shellArgs(words) {
  const name = commandName(words[0] ?? '');
  if (name === 'pwsh' || name === 'powershell' || name === 'cmd') return [];
  const { k, hasC } = posixShellOptions(words);
  return hasC ? words.slice(k + 1) : [];
}

/**
 * The script file a POSIX shell runs (`bash f.sh`) and whether the shell
 * echoes its lines as it runs them, or null when it runs no file.
 * @param {string[]} words
 * @returns {{ file: string, traced: boolean } | null}
 */
export function shellScriptFile(words) {
  const name = commandName(words[0] ?? '');
  if (name === 'pwsh' || name === 'powershell' || name === 'cmd') return null;
  const { k, hasC, hasS, traced } = posixShellOptions(words);
  return !hasC && !hasS && k < words.length ? { file: words[k], traced } : null;
}

// --- PowerShell ----------------------------------------------------------------

/** What each PowerShell escape inside double quotes stands for; any other escaped character stands for itself. */
/** @type {Record<string, string>} */
const PS_ESCAPES = { 0: '\0', a: '\x07', b: '\b', e: '\x1b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v' };

/**
 * Walks a PowerShell command, calling `escape` for each backtick escape outside
 * single quotes (with the escaped text and the quote it sits in) and `plain`
 * for every other character (with the quote it leaves open and its offset). A
 * `<#…#>` block comment outside quotes, the rest of the text when unclosed, is
 * passed to `comment`.
 * @param {string} src
 * @param {{ escape: (text: string, quote: string) => string, plain: (c: string, quote: string, at: number) => string, comment: () => string }} on
 */
function psWalk(src, on) {
  let out = '';
  let quote = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (!quote && c === '<' && src[i + 1] === '#') {
      const close = src.indexOf('#>', i + 2);
      i = close < 0 ? src.length : close + 1;
      out += on.comment();
      continue;
    }
    if (c === '`' && quote !== "'" && i + 1 < src.length) {
      const text = src.startsWith('\r\n', i + 1) ? '\r\n' : src[i + 1];
      i += text.length;
      out += on.escape(text, quote);
      continue;
    }
    if (quote) { if (c === quote) quote = ''; }
    else if (c === "'" || c === '"') quote = c;
    out += on.plain(c, quote, i);
  }
  return out;
}

// A variable assignment at a statement's start, glued to what follows: `$c=`, `$env:X+=`, `$c??=`.
const PS_ASSIGNMENT = /^\$(?:[A-Za-z]\w*:)?[A-Za-z_]\w*(?:[-+*/%]|\?\?)?=/;

/** @param {string} text */
const isLineEnd = (text) => text === '\n' || text === '\r\n';

/**
 * A PowerShell command rewritten for parseShell. A backslash is a literal
 * character in PowerShell, so it is doubled outside single quotes. A backtick
 * escape becomes the POSIX escape for the character it stands for (`` `n `` a
 * newline, `` `t `` a tab inside double quotes, the character itself elsewhere),
 * a backtick before a line end continues the line, and a `<#…#>` block comment
 * becomes a blank. A `(` or an array expression's `@(` that opens an argument
 * -- after a blank, `,` or a parameter's `:` -- becomes `$(`, so the group
 * stays one of the command's words and its text is a nested command:
 * `gc (Join-Path . x)`, `gc @('x')`. Nothing glued to a command word hides it:
 * an assignment that opens a statement (`$c=`, `$c+=`, `[int]$c=`, each of a
 * chain `$a=$b=`) is split off the word after it, and a script block's braces
 * become tabs (`& {gc x}`, `% {gc x}`), a braced variable's (`${env:A}`)
 * excepted; a tab rather than a space, so a reader of the words can tell
 * where one block ends and the next begins.
 * @param {string} src
 */
export function psForPosix(src) {
  let assignmentEnd = -1;
  let bracedVariable = false;
  return psWalk(src, {
    comment: () => ' ',
    plain: (c, quote, at) => {
      if (c === '\\' && quote !== "'") return '\\\\';
      if (quote) return c;
      if (bracedVariable) { bracedVariable = c !== '}'; return c; }
      if (c === '(' && /[ \t,:]/.test(src[at - 1] ?? '')) return '$(';
      // The `(` after it then follows an `@`, and stays as written.
      if (c === '@' && src[at + 1] === '(' && /[ \t,:]/.test(src[at - 1] ?? '')) return '$';
      if (c === '{') { bracedVariable = src[at - 1] === '$'; return bracedVariable ? c : '\t'; }
      if (c === '}') return '\t';
      // An assignment opens a statement, so a chained one starts right after the previous `=`.
      if (c === '$' && (/^$|[\s;|&({\]]/.test(src[at - 1] ?? '') || at - 1 === assignmentEnd)) {
        const m = PS_ASSIGNMENT.exec(src.slice(at));
        if (m) assignmentEnd = at + m[0].length - 1;
      }
      return at === assignmentEnd ? `${c} ` : c;
    },
    escape: (text, quote) => {
      if (quote === '"') {
        const c = isLineEnd(text) ? '\n' : PS_ESCAPES[text] ?? text;
        return '"\\$`'.includes(c) ? `\\${c}` : c;
      }
      if (isLineEnd(text)) return ' ';
      return text === "'" ? "\\'" : `'${text}'`;
    },
  });
}

/**
 * A cmd command rewritten for parseShell. A backslash, `'`, `$` and a backtick
 * are literal characters in cmd, so each is escaped; outside double quotes a
 * `^` escapes the character after it (`.e^nv` is `.env`).
 * @param {string} src
 */
export function cmdForPosix(src) {
  let out = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '"') quoted = !quoted;
    else if (!quoted && c === '^' && i + 1 < src.length) { out += `\\${src[++i]}`; continue; }
    out += (quoted ? '\\$`' : "\\'$`").includes(c) ? `\\${c}` : c;
  }
  return out;
}

/**
 * A PowerShell command's text with its escapes resolved, for the hooks' text
 * scans: inside double quotes `` `n `` and `` `r `` are a newline and `` `t `` a
 * blank, any other escaped character stands for itself, a backtick before a
 * line end continues the line, and a `<#…#>` block comment becomes a blank.
 * @param {string} src
 */
export function psUnescape(src) {
  return psWalk(src, {
    comment: () => ' ',
    plain: (c) => c,
    escape: (text, quote) => {
      if (isLineEnd(text)) return quote === '"' ? '\n' : ' ';
      if (quote === '"' && (text === 'n' || text === 'r')) return '\n';
      if (quote === '"' && text === 't') return ' ';
      return text;
    },
  });
}
