// The shared shell reader names a command the same way however Windows spells
// it, and finds the script each shell runs, so a guard built on it cannot be
// sidestepped by an extension, a case change or another shell.

import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, test } from 'node:test';
import { pathToFileURL } from 'node:url';

import { REPO_ROOT } from './helpers.mjs';

const { cmdForPosix, commandName, commandWords, envSplitString, parseShell, psForPosix, psUnescape, shellArgs, shellInput, shellScriptFile, shellScripts } = await import(
  pathToFileURL(path.join(REPO_ROOT, 'plugins', 'core', 'scripts', 'lib', 'shell-parse.mjs')).href
);

describe('shell-parse: commandName', () => {
  for (const [word, expected] of [
    ['git', 'git'],
    ['git.exe', 'git'],
    ['GIT.EXE', 'git'],
    ['Git.Cmd', 'git'],
    ['/usr/bin/git', 'git'],
    ['/c/Program Files/Git/cmd/git.exe', 'git'],
    ['C:\\Progra~1\\Git\\cmd\\git', 'git'],
    ['C:\\Windows\\System32\\cmd.exe', 'cmd'],
    ['run.bat', 'run'],
    ['git.exe.bak', 'git.exe.bak'],
    ['pwsh', 'pwsh'],
  ]) {
    test(`${word} -> ${expected}`, () => assert.equal(commandName(word), expected));
  }
});

describe('shell-parse: a drive path keeps its backslashes', () => {
  test('an unquoted C:\\ path is one word, as written', () =>
    assert.deepEqual(parseShell('C:\\Progra~1\\Git\\cmd\\git push')[0].words, ['C:\\Progra~1\\Git\\cmd\\git', 'push']));
  test('any other unquoted backslash still escapes, as in a shell', () =>
    assert.deepEqual(parseShell('\\git pu\\sh')[0].words, ['git', 'push']));
});

// A hook that cuts a path out of the command text needs where each word stands.
describe('shell-parse: word offsets', () => {
  test('each word and redirect target has its offsets, quotes included; a here-string and a heredoc body do not', () => {
    const src = "printf 'a with b' > 'with' <<< here && cat <<'EOF'\nwith\nEOF";
    const spans = parseShell(src).flatMap((c) => c.spans);
    assert.deepEqual(spans.map((s) => s.value), ['printf', 'a with b', 'with', 'cat']);
    assert.deepEqual(spans.map((s) => src.slice(s.start, s.end)), ['printf', "'a with b'", "'with'", 'cat']);
  });
});

// A `<` target is a file the command reads, which a reader check must see.
describe('shell-parse: input redirects', () => {
  test('input redirect targets are collected, output targets and here-strings are not', () => {
    const [cmd] = parseShell('grep x < in.txt 0<a <>b >out 2>err <<< text');
    assert.deepEqual(cmd.words, ['grep', 'x']);
    assert.deepEqual(cmd.redirects, ['in.txt', 'a', 'b']);
    assert.deepEqual(cmd.stdin, ['text']);
  });
});

describe('shell-parse: shellInput', () => {
  const cases = [
    [['bash', '-c', 'git push'], { script: 'git push', stdin: false }],
    [['bash.exe', '-c', 'git push'], { script: 'git push', stdin: false }],
    [['bash', '-s'], { script: null, stdin: true }],
    [['bash'], { script: null, stdin: true }],
    [['bash', 'f.sh'], { script: null, stdin: false }],
    [['pwsh', '-Command', 'git push'], { script: 'git push', stdin: false }],
    [['pwsh', '-NoProfile', '-c', 'git', 'push'], { script: 'git push', stdin: false }],
    [['powershell', '-command', 'git push'], { script: 'git push', stdin: false }],
    [['powershell.exe', '-Command', '-'], { script: null, stdin: true }],
    [['pwsh', '-File', 'x.ps1', '-c', 'git push'], { script: null, stdin: false }],
    [['pwsh'], { script: null, stdin: true }],
    [['powershell', 'git', 'push'], { script: 'git push', stdin: false }],
    [['pwsh', 'git', 'push'], { script: 'git push', stdin: false }],
    [['powershell', '-NoProfile', 'git', 'push'], { script: 'git push', stdin: false }],
    [['cmd', '/cgit', 'push'], { script: 'git push', stdin: false }],
    [['cmd', '/cgit push'], { script: 'git push', stdin: false }],
    [['cmd', '/c', 'git', 'push'], { script: 'git push', stdin: false }],
    [['cmd.exe', '/C', 'git push'], { script: 'git push', stdin: false }],
    [['cmd', '//c', 'git', 'push'], { script: 'git push', stdin: false }],
    [['cmd', '/k', 'git push'], { script: 'git push', stdin: false }],
    [['cmd'], { script: null, stdin: true }],
    [['pwsh', '-Command:git push'], { script: 'git push', stdin: false }],
    [['pwsh', '-c:git', 'push'], { script: 'git push', stdin: false }],
    [['pwsh', '-EncodedCommand', Buffer.from('git push', 'utf16le').toString('base64')], { script: 'git push', stdin: false }],
    [['powershell', '-ec', Buffer.from('git push', 'utf16le').toString('base64')], { script: 'git push', stdin: false }],
    [['powershell', '-ExecutionPolicy', 'Bypass', '-e', Buffer.from('git push', 'utf16le').toString('base64')], { script: 'git push', stdin: false }],
    [['pwsh', '-NoProfile', '-ep', 'Bypass', 'git', 'push'], { script: 'git push', stdin: false }],
    [['cmd', '/d/c', 'git', 'push'], { script: 'git push', stdin: false }],
    [['cmd', '/q/d/cgit', 'push'], { script: 'git push', stdin: false }],
    [['cmd', '/t:0a/c', 'git push'], { script: 'git push', stdin: false }],
  ];
  for (const [words, expected] of cases) {
    test(words.join(' '), () => assert.deepEqual(shellInput(words), expected));
  }
});

describe('shell-parse: heredoc bodies', () => {
  test('an unquoted delimiter expands the substitutions of its body', () =>
    assert.deepEqual(parseShell('cat <<EOF\na $(date) "b" `id`\nEOF')[0].subs, ['date', 'id']));
  for (const delim of ["'EOF'", '"EOF"', '\\EOF']) {
    test(`a quoted delimiter ${delim} keeps the body literal`, () =>
      assert.deepEqual(parseShell(`cat <<${delim}\na $(date)\nEOF`)[0].subs, []));
  }
});

describe('shell-parse: shellScripts and shellScriptFile', () => {
  const [piped] = parseShell('echo x | bash').slice(1);
  test('a -c script is the one script', () =>
    assert.deepEqual(shellScripts(['bash', '-c', 'git push'], piped), { scripts: ['git push'], piped: false }));
  test('a shell reading stdin gets its heredoc bodies and the pipe', () => {
    const [cmd] = parseShell("bash <<'EOF'\ngit push\nEOF");
    assert.deepEqual(shellScripts(['bash'], cmd), { scripts: ['git push\n'], piped: false });
    assert.deepEqual(shellScripts(['bash'], piped), { scripts: [], piped: true });
  });
  test('a -c script reads the words after it as $0, $1, …', () => {
    assert.deepEqual(shellArgs(['sh', '-c', 'cat "$1"', '_', 'f']), ['_', 'f']);
    assert.deepEqual(shellArgs(['bash', 'f.sh', 'x']), []);
    assert.deepEqual(shellArgs(['pwsh', '-c', 'x', 'y']), []);
  });
  test('a script file runs nothing this reads', () =>
    assert.deepEqual(shellScripts(['bash', 'f.sh'], piped), { scripts: [], piped: false }));
  for (const [words, expected] of [
    [['bash', '-x', 'f.sh'], { file: 'f.sh', traced: true }],
    [['sh', '-ev', 'f.sh'], { file: 'f.sh', traced: true }],
    [['bash', '-o', 'xtrace', 'f.sh'], { file: 'f.sh', traced: true }],
    [['bash', 'f.sh'], { file: 'f.sh', traced: false }],
    [['bash', '-c', 'x'], null],
    [['bash', '-s', 'arg'], null],
    [['bash'], null],
    [['pwsh', '-File', 'f.ps1'], null],
  ]) {
    test(`shellScriptFile ${words.join(' ')}`, () => assert.deepEqual(shellScriptFile(words), expected));
  }
});

describe('shell-parse: commandWords reads env in any spelling', () => {
  test('env.exe -S', () => assert.deepEqual(commandWords(['env.exe', '-S', 'git push']), ['git', 'push']));
  test('/usr/bin/env', () => assert.deepEqual(commandWords(['/usr/bin/env', 'A=1', 'git', 'push']), ['git', 'push']));
});

// cmd's escape is `^`, and its backslash, `'`, `$` and backtick are plain characters.
describe('shell-parse: a cmd command rewritten for parseShell', () => {
  const words = (src) => parseShell(cmdForPosix(src)).map((c) => c.words).filter((w) => w.length > 0);
  for (const [src, expected] of [
    ['type app\\x', [['type', 'app\\x']]],
    ['type "C:\\p\\x"', [['type', 'C:\\p\\x']]],
    ['type .e^nv', [['type', '.env']]],
    ["type it's", [['type', "it's"]]],
    ['echo $x`y & type z', [['echo', '$x`y'], ['type', 'z']]],
  ]) {
    test(src, () => assert.deepEqual(words(src), expected));
  }
});

// PowerShell's escape is the backtick and its backslash a plain character; parseShell reads POSIX.
describe('shell-parse: a PowerShell command rewritten for parseShell', () => {
  // The words of each command, empty commands left out.
  const words = (ps) => parseShell(psForPosix(ps)).map((c) => c.words).filter((w) => w.length > 0);
  for (const [ps, expected] of [
    ['gc C:\\p\\x', [['gc', 'C:\\p\\x']]],
    ["gc 'C:\\p\\x'", [['gc', 'C:\\p\\x']]],
    ['git pu`sh', [['git', 'push']]],
    ['echo `$x `; y', [['echo', '$x', ';', 'y']]],
    ['echo "a`tb" "c`"d" "`$e"', [['echo', 'a\tb', 'c"d', '$e']]],
    ["echo 'a`b'", [['echo', 'a`b']]],
    ['echo a `\ngit push', [['echo', 'a', 'git', 'push']]],
    ['<##> gc x', [['gc', 'x']]],
    ['<# a\nb #> gc x; y', [['gc', 'x'], ['y']]],
    ['gc x <# unclosed', [['gc', 'x']]],
    // A group in argument position stays a word; a method call's parentheses do not.
    ['gc (Join-Path . x)', [['gc', '$(Join-Path . x)']]],
    ['gc -Path:(f),(g)', [['gc', '-Path:$(f),$(g)']]],
    ["$s.Replace('a')", [['$s.Replace'], ['a']]],
    // An assignment and a script block glued to the command word are split off it.
    ['$c=gc x', [['$c=', 'gc', 'x']]],
    ['[int]$c+=gc x', [['[int]$c+=', 'gc', 'x']]],
    ['$a=$b=gc x', [['$a=', '$b=', 'gc', 'x']]],
    ['$a=$b', [['$a=', '$b']]],
    ['& {gc x}', [['gc', 'x']]],
    ['% {gc x} | y', [['%', 'gc', 'x'], ['y']]],
    ['echo ${env:A}x', [['echo', '${env:A}x']]],
    ['git log "--format=$c=x"', [['git', 'log', '--format=$c=x']]],
  ]) {
    test(JSON.stringify(ps), () => assert.deepEqual(words(ps), expected));
  }
  for (const [ps, expected] of [
    ['git commit -m "a`nb"', 'git commit -m "a\nb"'],
    ['git log --format="%h`t%s"', 'git log --format="%h %s"'],
    ['gc .`e`n`v', 'gc .env'],
    ["echo 'a`nb'", "echo 'a`nb'"],
    ['a `\nb', 'a  b'],
    ['<# c #>git push', ' git push'],
  ]) {
    test(`psUnescape ${JSON.stringify(ps)}`, () => assert.equal(psUnescape(ps), expected));
  }
});

describe('shell-parse: envSplitString splits at blanks and quotes, not at operators', () => {
  const cases = [
    [['-S', 'git -c a.b=c;d push'], ['git', '-c', 'a.b=c;d', 'push']],
    [['-S', 'git "a b" \'c d\'\\ e'], ['git', 'a b', 'c d e']],
    [['-Sgit push'], ['git', 'push']],
  ];
  for (const [words, expected] of cases) {
    test(words.join(' '), () => assert.deepEqual(envSplitString(words, 0).words, expected));
  }
});
