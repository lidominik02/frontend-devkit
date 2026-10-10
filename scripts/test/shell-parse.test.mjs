// The shared shell reader names a command the same way however Windows spells
// it, and finds the script each shell runs, so a guard built on it cannot be
// sidestepped by an extension, a case change or another shell.

import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, test } from 'node:test';
import { pathToFileURL } from 'node:url';

import { REPO_ROOT } from './helpers.mjs';

const { commandName, envSplitString, parseShell, shellInput } = await import(
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
  ];
  for (const [words, expected] of cases) {
    test(words.join(' '), () => assert.deepEqual(shellInput(words), expected));
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
