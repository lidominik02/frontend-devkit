// commit-hygiene keeps out of a commit message what another developer cannot see
// (an attribution trailer, a session, a handoff or roadmap artifact), and denies
// every push, merge and merging pull, since the user does those.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { pathToFileURL } from 'node:url';

import { REPO_ROOT, gitRepo, hookEvent, runScript, tempDir, write } from './helpers.mjs';

const HOOK = path.join(REPO_ROOT, 'plugins', 'core', 'scripts', 'commit-hygiene.mjs');

const DENY = 2;
const ALLOW = 0;

function expectExit(input, expected) {
  const res = runScript(HOOK, { input });
  assert.equal(res.code, expected, `exit=${res.code} expected=${expected}; stderr: ${res.stderr.trim()}`);
}

const expectBash = (command, expected) => expectExit(hookEvent('Bash', { command }), expected);

function cases(rows) {
  for (const [expected, command, label] of rows) {
    test(label, () => expectBash(command, expected));
  }
}

function table(prefix, expected, commands) {
  for (const command of commands) {
    test(`${prefix}: ${command}`, () => expectBash(command, expected));
  }
}

const TRAILER = 'Co-Authored-By: y <y@example.com>';

describe('commit-hygiene: no attribution trailer in a commit message', () => {
  // A multi-line -m is usually composed with a heredoc substitution.
  cases([
    [
      DENY,
      "git commit -m \"$(cat <<'EOF'\nfix: correct the thing\n\nCo-Authored-By: someone <x@example.com>\nEOF\n)\"",
      'trailer inside a heredoc-built -m argument',
    ],
    [DENY, 'git commit -m "fix: done, Generated with a tool"', '"Generated with" line'],
    [DENY, 'git commit --amend -m "fix: same, Co-Authored-By: x <x@example.com>"', 'trailer on an amend'],
  ]);
});

describe('commit-hygiene: nothing only Claude and the user can see', () => {
  cases([
    [DENY, 'git commit -m "fix: as decided in this claude session"', 'a Claude session reference'],
    [DENY, 'git commit -m "fix: per our chat session notes"', 'a chat session reference'],
    [DENY, 'git commit -m "docs: update HANDOFF.md with the next step"', 'a planning-artifact filename'],
    [DENY, 'git commit -m "feat: add the endpoint CONTRACT-GAPS.md asked for"', 'the contract-gaps artifact filename'],
    [ALLOW, 'git commit -m "docs: update SPEC.md with the new rate limits"', "a repository's own SPEC.md must pass"],
    [DENY, 'git commit -m "chore: bump temp/feature-x/planning/notes"', 'a path into a planning-artifacts directory'],
    [DENY, 'git commit -m "fix: see the handoff notes for context"', 'a handoff reference'],
    [DENY, 'git commit -m "feat: implement phase 3 of the roadmap"', 'a roadmap-phase reference'],
    [DENY, 'git commit -m "docs: add the roadmap artifact for this feature"', 'a roadmap-artifact reference'],
  ]);
});

// Each leak word collides with a common, legitimate phrase in ordinary engineering commits.
describe('commit-hygiene: false positives it must not produce', () => {
  cases([
    [ALLOW, 'git commit -m "fix: expire the session cookie after logout"', 'an ordinary session-cookie fix must pass'],
    [ALLOW, 'git commit -m "feat: get the current session from the store"', '"the current session" must pass'],
    [ALLOW, 'git commit -m "fix: this session leaks a socket on reconnect"', '"this session" with no AI qualifier must pass'],
    [ALLOW, 'git commit -m "docs: update the public roadmap page for Q3"', 'a bare mention of a product roadmap must pass'],
    [ALLOW, 'git commit -m "feat: ship phase 2 of the onboarding rollout"', 'a bare phase number outside a roadmap must pass'],
    [ALLOW, 'git commit -m "fix: apply ADR-0010 pagination adapter, closes #42"', 'a real ADR citation must pass'],
    [ALLOW, 'git commit -m "chore: bump decision-tree dependency to 2.1.0"', '"decision" as an ordinary word must pass'],
  ]);
});

// git commit-graph is a real subcommand, not "git commit" with a suffix.
describe('commit-hygiene: ordinary work and the subcommand-name trap', () => {
  cases([
    [ALLOW, 'git commit -m "fix: correct the off-by-one in pagination"', 'an ordinary commit message must pass'],
    [ALLOW, 'git commit-graph write', 'commit-graph must not match as git commit'],
    [ALLOW, 'git -C /r commit-graph write', 'commit-graph behind a global option must not match either'],
    [ALLOW, 'git log --oneline -20', 'a non-commit git command must pass untouched'],
  ]);
});

// A plumbing commit runs neither the repository's hooks nor these message checks.
describe('commit-hygiene: commit-tree is denied whatever its message', () => {
  cases([
    [DENY, 'git commit-tree HEAD^{tree} -m "x"', 'commit-tree with -m must be denied outright'],
    [DENY, 'echo x | git commit-tree HEAD^{tree}', 'commit-tree reading its message from stdin must be denied'],
    [DENY, 'git -C /r commit-tree HEAD^{tree} -F /tmp/msg.txt', 'commit-tree with -F behind a global option must be denied'],
  ]);
});

describe('commit-hygiene: a global option that takes a value does not hide the subcommand', () => {
  cases([
    [DENY, `git -C /r commit -m "fix: x, ${TRAILER}"`, 'a trailer behind git -C <path> must be caught'],
    [DENY, 'git -c user.name=x commit -m "fix: see the handoff notes"', 'a leak word behind git -c <k=v> must be caught'],
    [ALLOW, 'git -c user.name=x commit -m "fix: ok"', 'a clean message behind git -c <k=v> must pass'],
    [
      DENY,
      'git --git-dir /r/.git --work-tree /r commit -m "docs: update HANDOFF.md"',
      'space-separated --git-dir/--work-tree must not hide the subcommand',
    ],
    [DENY, 'git --config-env foo.bar=HOME commit-tree HEAD^{tree} -m x', 'commit-tree behind --config-env <name=var> must be denied'],
    [DENY, 'git --attr-source HEAD commit-tree HEAD^{tree} -m x', 'commit-tree behind --attr-source <tree> must be denied'],
    [DENY, `git --config-env foo.bar=HOME commit -m "fix: x, ${TRAILER}"`, 'a trailer behind --config-env must be caught'],
    [DENY, `git --attr-source HEAD commit -m "fix: x, ${TRAILER}"`, 'a trailer behind --attr-source must be caught'],
    [
      DENY,
      'echo "unterminated\ngit --config-env foo.bar=HOME commit-tree HEAD^{tree} -m x',
      'the plain-text fallback must skip the same value-taking options',
    ],
  ]);
});

// A leak word in an option value or a pathspec is part of the command, not of what another developer reads.
describe('commit-hygiene: only the message is checked', () => {
  cases([
    [ALLOW, 'git -C /home/me/work/handoff-service commit -m "fix: correct the rounding"', 'a leak word in a global option value is not the message'],
    [ALLOW, 'git commit -m "feat: panel" -- src/handoffs/Panel.vue', 'a leak word in a pathspec is not the message'],
  ]);
});

// git accepts bundled and abbreviated option spellings, and a --trailer lands in the message.
describe('commit-hygiene: every message source is read', () => {
  cases([
    [DENY, `git commit -am "fix: x, ${TRAILER}"`, 'a trailer in a bundled -am must be caught'],
    [DENY, `git commit --mess "fix: x, ${TRAILER}"`, 'a trailer behind an abbreviated --message must be caught'],
    [DENY, `git commit -m "fix: x" --trailer "${TRAILER}"`, 'an attribution --trailer must be caught'],
    // git 2.43.0 writes a --trailer key=value as "key: value".
    [
      DENY,
      'git commit -m "fix: x" --trailer "Co-authored-by=y <y@example.com>"',
      'an attribution --trailer with = as its separator must be caught',
    ],
    [ALLOW, 'git commit -m "fix: x" --trailer "Reviewed-by=y <y@example.com>"', 'a --trailer with = and a non-attribution key must pass'],
    [
      DENY,
      'echo "unterminated\ngit commit -m x --trailer=Co-authored-by=y',
      'the plain-text fallback must read a --trailer key=value the same way',
    ],
  ]);
});

// Quoting cannot hide a subcommand, and naming one inside a message or a heredoc is not running it.
describe('commit-hygiene: the command is read the way a shell reads it', () => {
  cases([
    [DENY, 'git "commit-tree" HEAD^{tree} -m "x"', 'a quoted commit-tree must be denied'],
    [DENY, "git comm''it-tree HEAD^{tree} -m x", 'a commit-tree assembled from quoted pieces must be denied'],
    [DENY, `git "commit" -m "fix: x, ${TRAILER}"`, 'a quoted commit must still get the message checks'],
    [ALLOW, 'git commit -m "docs: mention git commit-tree in the guide"', 'a message naming commit-tree is not a commit-tree call'],
    [
      ALLOW,
      "cat > /tmp/notes.md <<'EOF'\nnever run git commit-tree directly\nEOF",
      'a heredoc body naming commit-tree is data, not a command',
    ],
    [ALLOW, 'git add HANDOFF.md && git commit -m "fix: ok"', 'a leak word in another command is not the commit message'],
  ]);
});

// A heredoc body is not shell syntax, so an odd apostrophe must not send the command to the fallback.
describe('commit-hygiene: an apostrophe in a heredoc-built message', () => {
  cases([
    [
      ALLOW,
      "git add HANDOFF.md && git commit -m \"$(cat <<'EOF'\nfix: don't drop the last row\nEOF\n)\"",
      'an apostrophe in a heredoc-built -m keeps the leak-word check on the message',
    ],
    [
      DENY,
      `git add HANDOFF.md && git commit -m "$(cat <<'EOF'\nfix: don't drop the last row\n\n${TRAILER}\nEOF\n)"`,
      'a trailer in a heredoc-built -m with an apostrophe must be caught',
    ],
    [
      ALLOW,
      "git commit -m \"$(cat <<'EOF'\ndocs: explain why git commit-tree isn't allowed\nEOF\n)\"",
      'a heredoc-built message naming commit-tree is not a commit-tree call',
    ],
  ]);
});

// Inside $(...), a << with no delimiter line is an arithmetic shift, and bash
// 5.2.21 ends a heredoc body at a line that starts with its delimiter and ")".
describe('commit-hygiene: arithmetic shifts and heredocs inside $(...)', () => {
  cases([
    [ALLOW, 'git add HANDOFF.md && git commit -m "fix: shift $(echo $((1<<2))\n)"', 'an arithmetic shift inside $(...) is not a heredoc'],
    [ALLOW, 'git add HANDOFF.md && git commit -m "fix: shift $((1<<(2)))"', 'a shift of a parenthesised operand inside $(...) is not a heredoc'],
    [
      ALLOW,
      "git add HANDOFF.md && git commit -m \"$(cat <<'EOF'\nfix: x\nEOF)\"",
      'a heredoc delimiter line that closes its $(...) ends the body',
    ],
    [
      DENY,
      `git commit -m "$(cat <<'EOF'\nfix: x\n\n${TRAILER}\nEOF)"`,
      'a trailer in a heredoc whose delimiter line closes its $(...) must be caught',
    ],
    [
      DENY,
      'echo "$(echo $((1<<2))\ngit commit-tree HEAD^{tree} -m x\n)"',
      'a command on the line after a shift inside $(...) must still be judged',
    ],
  ]);
});

// A heredoc or here-string fed to a shell is its script, and a script piped or
// redirected into one can come from anywhere in the command.
describe('commit-hygiene: scripts fed to a shell, and substitutions', () => {
  cases([
    [
      DENY,
      `bash <<'EOF'\ngit add -A\ngit commit -m "feat: x\n\n${TRAILER}"\nEOF`,
      'a commit in a heredoc script fed to bash must be judged',
    ],
    [DENY, "bash -s <<'EOF'\ngit commit-tree HEAD^{tree} -m x\nEOF", 'commit-tree in a heredoc read by bash -s must be denied'],
    [DENY, "bash <<< 'git commit-tree HEAD^{tree} -m x'", 'commit-tree in a here-string fed to bash must be denied'],
    [DENY, "echo 'git commit-tree HEAD^{tree} -m x' | sh", 'commit-tree piped into sh must be denied'],
    [DENY, "bash < <(echo 'git commit-tree HEAD^{tree} -m x')", 'commit-tree redirected into bash must be denied'],
    [ALLOW, "bash <<'EOF'\necho git commit-tree\nEOF", 'a heredoc script is judged as commands, so echo in it stays text'],
    // A process substitution is one word and a substitution, not a separator.
    [
      DENY,
      String.raw`git commit -F <(printf 'fix: x\n\nCo-Authored-By: y <y@example.com>\n')`,
      'a message read from -F <(...) must be scanned',
    ],
    [DENY, 'cat <(git commit-tree HEAD^{tree} -m x)', 'commit-tree inside a process substitution must be denied'],
    [DENY, "bash -c 'git commit-tree HEAD^{tree} -m x'", 'commit-tree inside bash -c must be denied'],
    [
      DENY,
      'git update-ref HEAD "$(git commit-tree HEAD^{tree} -p HEAD -m x)"',
      'commit-tree inside a command substitution must be denied',
    ],
    [DENY, `GIT_DIR=/r/.git git commit -m "fix: x, ${TRAILER}"`, 'a leading assignment must not hide the commit'],
    [DENY, `command git commit -m "fix: x, ${TRAILER}"`, 'a command prefix must not hide the commit'],
    [DENY, String.raw`printf "fix: x\n\nCo-Authored-By: y\n" | git commit -F -`, 'a message piped into commit -F - must be scanned'],
    [
      DENY,
      `git commit -F - <<'EOF'\nfix: x\n\n${TRAILER}\nEOF`,
      'a heredoc message read by commit -F - must be scanned',
    ],
    [
      DENY,
      `git commit -aF - <<'EOF'\nfix: x\n\n${TRAILER}\nEOF`,
      'a heredoc message read by a bundled -aF - must be scanned',
    ],
    [
      DENY,
      String.raw`printf "fix: x\n\nCo-Authored-By: y\n" | git commit -F /dev/fd/0`,
      'a message piped into a /dev/fd stdin alias must be scanned',
    ],
  ]);
});

// The whole-command scan reads a --trailer key=value as the "key: value" git
// interpret-trailers writes (git 2.43.0), whichever command carries it.
describe('commit-hygiene: a key=value trailer in the whole-command scan', () => {
  cases([
    [
      DENY,
      String.raw`printf 'fix: x\n' | git interpret-trailers --trailer "Co-authored-by=X" | git commit -F -`,
      'a key=value attribution trailer piped into commit -F - must be caught',
    ],
    [
      DENY,
      String.raw`git commit -F <(printf 'fix: x\n' | git interpret-trailers --trailer Co-authored-by=X)`,
      'a key=value attribution trailer read from -F <(...) must be caught',
    ],
    [
      ALLOW,
      String.raw`printf 'fix: x\n' | git interpret-trailers --trailer "Reviewed-by=X" | git commit -F -`,
      'a key=value non-attribution trailer piped into commit -F - must pass',
    ],
    [DENY, `git commit -m "fix: x, ${TRAILER}`, 'an unterminated quote must fall back to the plain-text scan'],
  ]);
});

describe('commit-hygiene: the plain-text fallback cannot be stalled', () => {
  // A hook that outlives its timeout lets the call through unjudged, so a failed
  // plain-text match must not backtrack exponentially over repeated options.
  test('the plain-text fallback finishes fast on 40 quoted -c values', () => {
    const command = `echo "unterminated\ngit ${'-c "a=b" '.repeat(40)}status`;
    const res = spawnSync(process.execPath, [HOOK], {
      input: hookEvent('Bash', { command }),
      encoding: 'utf8',
      timeout: 5000,
    });
    assert.equal(res.status, 0, `status=${res.status} signal=${res.signal}`);
  });
});

// Unknown heads fail closed rather than depending on a list of wrappers.
describe('commit-hygiene: a head that may run its arguments cannot hide a git invocation', () => {
  table('deny', DENY, [
    'sudo git commit -m "fix: x, Co-Authored-By: y <y@example.com>"',
    'sudo -u root git commit -m "fix: x, Co-Authored-By: y <y@example.com>"',
    'doas git commit -m "fix: x, Co-Authored-By: y <y@example.com>"',
    'nice git commit -m "fix: x, Co-Authored-By: y <y@example.com>"',
    'timeout 5 git commit -m "fix: x, Co-Authored-By: y <y@example.com>"',
    'ionice -c3 git commit -m "fix: x, Co-Authored-By: y <y@example.com>"',
    'stdbuf -oL git commit -m "fix: x, Co-Authored-By: y <y@example.com>"',
    'xargs -I{} git commit-tree {} <<< tree',
    "sudo bash -c 'git commit-tree HEAD^{tree} -m x'",
  ]);
});

describe('commit-hygiene: a head that never runs its arguments leaves git commit-tree as text', () => {
  table('allow', ALLOW, [
    'echo git commit-tree',
    `printf '%s' "git commit-tree"`,
    "printf '%s\\n' git commit-tree",
    'grep -rn git commit-tree docs/',
    'egrep git commit-tree notes.txt',
    'fgrep git commit-tree notes.txt',
    'rg git commit-tree',
    'ag git commit-tree',
    'cat git commit-tree',
    'less git commit-tree',
    'man git commit-tree',
    'which git commit-tree',
    'type git commit-tree',
    'command -v git commit-tree',
    'test -e git commit-tree',
    '[ -e git commit-tree ]',
    'true git commit-tree',
    'false git commit-tree',
    ': git commit-tree',
    'git log --grep commit-tree',
  ]);
});

describe('commit-hygiene: a message read from a file', () => {
  test('a bare git commit (no message text to inspect) must pass', () => expectBash('git commit', ALLOW));

  // Forward slashes: an unquoted backslash is a shell escape, and Node reads a drive path either way.
  const files = (t) => {
    const dir = tempDir(t);
    fs.writeFileSync(path.join(dir, 'msg.txt'), 'fix: normal title\n\nCo-Authored-By: someone <x@example.com>\n');
    fs.writeFileSync(path.join(dir, 'clean.txt'), 'fix: an ordinary message with nothing wrong in it\n');
    const at = (name) => path.join(dir, name).split(path.sep).join('/');
    return { msg: at('msg.txt'), clean: at('clean.txt'), fresh: at('new.txt') };
  };

  test('a trailer inside a -F message file must be caught', (t) => expectBash(`git commit -F ${files(t).msg}`, DENY));
  test('a clean -F message file must pass, --file= spelling', (t) =>
    expectBash(`git commit --file=${files(t).clean}`, ALLOW));
  test('a trailer in a file named by a bundled -sF must be caught', (t) =>
    expectBash(`git commit -sF ${files(t).msg}`, DENY));
  test('a readable message file is judged on its own text', (t) =>
    expectBash(`git add HANDOFF.md && git commit -F ${files(t).clean}`, ALLOW));

  // The hook runs before the command, so a file the same call writes is not there yet, or is stale.
  test('a message file written earlier in the same call must be scanned', (t) => {
    const { fresh } = files(t);
    expectBash(`cat > ${fresh} <<'EOF'\nfeat: x\n\n${TRAILER}\nEOF\ngit commit -F ${fresh}`, DENY);
  });
  test('a stale clean message file the same call rewrites must not hide the new text', (t) => {
    const { clean } = files(t);
    expectBash(`cat > ${clean} <<'EOF'\nfeat: x\n\n${TRAILER}\nEOF\ngit commit -F ${clean}`, DENY);
  });
});

// A message file is often kept beside the plan it belongs to, so its path is never
// message text; the hook runs in its own directory, so a relative path needs a base.
describe('commit-hygiene: a relative -F path and an unreadable message file', () => {
  const MSG = 'temp/feat/planning/msg/01.txt';
  const repo = (t, text = 'fix: an ordinary message\n') => {
    const dir = gitRepo(t);
    write(dir, { [MSG]: text, 'sub/.keep': '' });
    return dir;
  };
  // The hook's own cwd is outside the repository, and the base comes from the event or the env.
  const run = (t, command, { cwd, projectDir = '' }) =>
    runScript(HOOK, { input: hookEvent('Bash', { command }, cwd ? { cwd } : {}), cwd: tempDir(t), env: { CLAUDE_PROJECT_DIR: projectDir } });
  const expectRun = (res, code, stderr) => {
    assert.equal(res.code, code, `stderr: ${res.stderr.trim()}`);
    if (stderr) assert.match(res.stderr, stderr);
  };

  test('a clean relative -F file under a planning path passes, resolved against the event cwd', (t) =>
    expectRun(run(t, `git commit -F ${MSG}`, { cwd: repo(t) }), ALLOW));
  test('a clean relative -F file passes, resolved against CLAUDE_PROJECT_DIR', (t) =>
    expectRun(run(t, `git commit --file=${MSG}`, { projectDir: repo(t) }), ALLOW));
  test('CLAUDE_PROJECT_DIR wins over the event cwd', (t) =>
    expectRun(run(t, `git commit -F ${MSG}`, { projectDir: repo(t), cwd: tempDir(t) }), ALLOW));
  test('a relative -F file is read, so a trailer in it is caught', (t) =>
    expectRun(run(t, `git commit -aF ${MSG}`, { cwd: repo(t, `fix: x\n\n${TRAILER}\n`) }), DENY));
  test('a bundled -aF path is left out of the scan when the file cannot be read', (t) =>
    expectRun(run(t, 'git commit -aF temp/x/planning/gone.txt', { cwd: repo(t) }), ALLOW, /gone\.txt/));
  test('an abbreviated --fi path is left out of the scan when the file cannot be read', (t) =>
    expectRun(run(t, 'git commit --fi temp/x/planning/gone.txt', { cwd: repo(t) }), ALLOW, /gone\.txt/));
  // The hook does not follow `cd`, so the path resolves outside the base and is unreadable.
  test('cd sub && git commit -F ../<planning path> passes, naming the unread file', (t) =>
    expectRun(run(t, `cd sub && git commit -F ../${MSG}`, { cwd: repo(t) }), ALLOW, /not judged/));

  test('a planning path written in a heredoc body of the same command is denied', (t) =>
    expectRun(run(t, "cat > m.txt <<'EOF'\nfeat: x\n\nsee temp/x/planning/a\nEOF\ngit commit -F m.txt", { cwd: repo(t) }), DENY));
  test('a clean message written by a heredoc to a planning path, then committed with -F, passes', (t) =>
    expectRun(run(t, "cat > temp/x/planning/m.txt <<'EOF'\nfix: ok\nEOF\ngit commit -F temp/x/planning/m.txt", { cwd: repo(t) }), ALLOW));
  test('a clean message printf writes to a planning path, then committed with -F, passes', (t) =>
    expectRun(run(t, "printf 'fix: ok\\n' > 'temp/x/planning/m.txt' && git commit --file=temp/x/planning/m.txt", { cwd: repo(t) }), ALLOW));
  test('a heredoc written to a planning path still denies a planning path in its body', (t) =>
    expectRun(run(t, "cat > temp/x/planning/m.txt <<'EOF'\nfix: see temp/y/planning/notes\nEOF\ngit commit -F temp/x/planning/m.txt", { cwd: repo(t) }), DENY));
  test('a heredoc written to a planning path still denies a trailer in its body', (t) =>
    expectRun(run(t, `cat > temp/x/planning/m.txt <<'EOF'\nfix: ok\n\n${TRAILER}\nEOF\ngit commit -F temp/x/planning/m.txt`, { cwd: repo(t) }), DENY));
  test('a one-letter -F path does not cut that letter out of a -m value', (t) =>
    expectRun(run(t, 'git commit -F n -m "see temp/x/planning/a"', { cwd: repo(t) }), DENY));
  test('a planning path in a heredoc read by -F - is denied', (t) =>
    expectRun(run(t, "git commit -F - <<'EOF'\nfeat: x\n\nsee temp/x/planning/a\nEOF", { cwd: repo(t) }), DENY));
  test('a planning path in a heredoc-built -m is denied', (t) =>
    expectRun(run(t, "git commit -m \"$(cat <<'EOF'\nfeat: x\n\nsee temp/x/planning/a\nEOF\n)\"", { cwd: repo(t) }), DENY));

  test('an unreadable -F file is named in the deny reason', (t) => {
    const res = run(t, `git commit -F gone.txt -m "fix: x, ${TRAILER}"`, { cwd: repo(t) });
    expectRun(res, DENY, /Blocked by devkit: .*Co-Authored-By.* The message file 'gone\.txt' could not be read, so its content was not judged\./);
  });
  test('an unreadable -F file is named on stderr when the command passes', (t) =>
    expectRun(run(t, 'git commit -F gone.txt', { cwd: repo(t) }), ALLOW,
      /devkit commit-hygiene: The message file 'gone\.txt' could not be read, so its content was not judged\./));
  test('stdin given as -F - is not reported as an unreadable file', (t) => {
    const res = run(t, "git commit -F - <<'EOF'\nfix: x\nEOF", { cwd: repo(t) });
    expectRun(res, ALLOW);
    assert.doesNotMatch(res.stderr, /could not be read/);
  });
});

// The win32 branch is a pure function of its platform argument, so it runs on every OS.
describe('commit-hygiene: the -F path on each platform', () => {
  // Imported in a child, which exits before the hook's stdin handler could run.
  const resolve = (p, cwd, platform) => {
    const script = `import { messageFilePath } from ${JSON.stringify(pathToFileURL(HOOK).href)};
process.stdout.write(JSON.stringify(messageFilePath(${JSON.stringify(p)}, ${JSON.stringify(cwd)}, ${JSON.stringify(platform)})));
process.exit(0);`;
    const res = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
    assert.equal(res.status, 0, res.stderr);
    return JSON.parse(res.stdout);
  };

  test('win32 reads a Git Bash drive path as a drive path', () =>
    assert.equal(resolve('/c/Users/me/msg.txt', 'C:/repo', 'win32'), 'C:/Users/me/msg.txt'));
  test('win32 upper-cases the drive letter of a bare drive', () => assert.equal(resolve('/d', 'C:/repo', 'win32'), 'D:/'));
  test('win32 cannot read another POSIX-absolute path', () => assert.equal(resolve('/tmp/msg.txt', 'C:/repo', 'win32'), null));
  test('win32 resolves a relative path against the base', () =>
    assert.equal(resolve('temp/msg.txt', 'C:\\repo', 'win32'), 'C:\\repo\\temp\\msg.txt'));
  test('elsewhere a /c/ path stays as written', () => assert.equal(resolve('/c/msg.txt', '/repo', 'linux'), '/c/msg.txt'));
  test('elsewhere a relative path resolves against the base', () =>
    assert.equal(resolve('../m.txt', '/repo/sub', 'darwin'), '/repo/m.txt'));
});

// The user pushes and merges: every form the parser follows must deny a push, a
// merge and a pull that merges, whatever wraps or nests it.
describe('commit-hygiene: push, merge and a merging pull are denied', () => {
  table('deny', DENY, [
    'git push',
    'git push --force-with-lease origin feat',
    'git push --dry-run',
    'git -C /r push origin HEAD',
    'git -c push.default=current push',
    'git --no-pager push',
    '"git" push',
    'git "pu""sh"',
    '/usr/bin/git push',
    'GIT_TRACE=1 git push',
    'env GIT_TRACE=1 git push',
    'command git push',
    'exec git push',
    'nohup git push',
    'time git push',
    'sudo git push',
    'sudo -u me git push',
    'timeout 30 git push',
    'nice git push',
    'xargs git push <<< origin',
    "bash -c 'git push'",
    'sh -c "git -C /r push origin HEAD"',
    `bash -c "sh -c 'git push'"`,
    "sudo bash -c 'git push'",
    "bash <<< 'git push'",
    "echo 'git push' | sh",
    "bash < <(echo 'git push')",
    'echo "$(git push)"',
    'echo `git push`',
    'cat <(git push)',
    'git fetch && git push',
    'git rebase main; git push',
    'git status || git push',
    'git merge feat',
    'git merge --no-ff feat',
    'git merge --continue',
    'git merge --quit',
    'git merge -- --abort',
    'git -C /r merge feat',
    'sudo git merge feat',
    "bash -c 'git merge feat'",
    "echo 'git merge feat' | sh",
    'git pull',
    'git pull origin main',
    'git pull --ff-only',
    'git pull --no-rebase',
    'git pull --rebase=false',
    'git pull --rebase --no-rebase',
    'git pull --rebase --no-reb',
    'git pull -r --reb=false',
    'git -C /r pull',
    'timeout 30 git pull',
    "bash -c 'git pull origin main'",
    'git merge -m --abort feat',
    'git merge --abort feat',
    'git $X push',
    'git ${X} push',
    'git $GIT_OPTS push origin',
    'git "$@"',
    'git -C /r $CMD',
    'git $(echo push)',
    'git `echo push`',
    'env -S "git push"',
    "env -S 'git push'",
    "env -S 'git -c a.b=c;d push'",
    "env -S'git push'",
    'env --split-string="GIT_TRACE=1 git push"',
    'env -i -S "git merge feat"',
    'git send-pack origin main',
    'git http-push https://example.com/r.git main',
    'git subtree push -P lib origin main',
    'git subtree pull --prefix=lib origin main',
    'git subtree merge -P lib feat',
    'git subtree add -P lib origin main',
    'git svn dcommit',
    'git svn set-tree HEAD',
    'git svn commit-diff a b https://example.com/svn',
    'git p4 submit',
  ]);

  cases([
    [DENY, 'git $X status', 'an expanded subcommand is denied even when it would be harmless: the cost the header names'],
    [DENY, "bash <<'EOF'\ngit fetch\ngit push --force-with-lease\nEOF", 'a push in a heredoc script fed to bash must be denied'],
    [DENY, "bash -s <<'EOF'\ngit merge feat\nEOF", 'a merge in a heredoc read by bash -s must be denied'],
    [DENY, 'git fetch\ngit push', 'a push on the line after another command must be denied'],
    [DENY, 'echo "unterminated\ngit push', 'the plain-text fallback must deny a push'],
    [
      DENY,
      'echo "unterminated\ngit -C /r push;',
      'the plain-text fallback must deny a push behind a global option and before a separator',
    ],
    [DENY, 'echo "unterminated\ngit merge feat', 'the plain-text fallback must deny a merge'],
    [DENY, 'echo "unterminated\ngit pull origin main', 'the plain-text fallback must deny a pull that merges'],
    [DENY, 'echo "unterminated\ngit $X push', 'the plain-text fallback must deny an expanded subcommand'],
    [DENY, 'echo "unterminated\ngit subtree push -P lib origin main', 'the plain-text fallback must deny a subtree push'],
    [DENY, 'echo "unterminated\ngit merge -m --abort feat', 'the plain-text fallback must deny --abort as an option value'],
  ]);
});

describe('commit-hygiene: every git command a skill runs itself, and text naming a push, passes', () => {
  table('allow', ALLOW, [
    'git fetch',
    'git fetch origin main',
    'git merge-base main HEAD',
    'git merge-base --is-ancestor main HEAD',
    'git merge --abort',
    'git -C /r merge --abort',
    'git merge-file a base b',
    'git merge-tree main feat',
    'git mergetool',
    'git rebase main',
    'git -c merge.conflictStyle=zdiff3 rebase --no-update-refs --onto main old feat',
    'git rebase --continue',
    'git rebase --abort',
    'git pull --rebase',
    'git pull -r',
    'git pull --rebase origin main',
    'git pull --rebase=merges',
    'git pull --no-rebase --rebase',
    'git cherry-pick abc123',
    'git cherry-pick --continue',
    'git stash push -m wip',
    'git branch backup/feat/20260929-1200',
    'git reset --hard backup/feat/20260929-1200',
    'git switch feat',
    'git help push',
    'git log --grep push',
    'echo git push',
    'grep -rn "git merge" docs/',
    'git commit -m "docs: never git push or git merge from a hook"',
    "bash -c 'git rebase main'",
    "echo 'git merge-base main HEAD' | sh",
    "echo 'git merge --abort' | sh",
    "echo 'git pull --rebase' | sh",
    'git log $REV',
    'git show "$SHA"',
    'git -C "$ROOT" status',
    'git diff "$BASE"...HEAD',
    'git log "$(git merge-base main HEAD)"..HEAD',
    'env -S "git fetch"',
    'git subtree split -P lib',
    'git svn rebase',
    'git svn fetch',
    'git p4 sync',
    'git p4 rebase',
  ]);

  cases([
    [ALLOW, "cat > /tmp/notes.md <<'EOF'\nthe user runs git push and git merge\nEOF", 'a heredoc body naming a push is data, not a command'],
    [ALLOW, 'echo "unterminated\ngit merge --abort', 'the plain-text fallback must pass a merge --abort'],
    [ALLOW, 'echo "unterminated\ngit pull --rebase origin main', 'the plain-text fallback must pass a pull --rebase'],
    [ALLOW, 'echo "unterminated\ngit merge-base main HEAD', 'the plain-text fallback must pass a merge-base'],
  ]);
});

// Each is named in commit-hygiene.mjs's header as the complete list of what is let through.
describe('commit-hygiene: out of reach, and let through', () => {
  table('out of reach', ALLOW, [
    `python3 -c "import os; os.system('git push')"`,
    `node -e "require('child_process').execSync('git push')"`,
    'make push',
    'npm run release',
    'sh ./push.sh',
    'source push.sh',
    '. push.sh',
    'git submodule foreach git push',
    "git rebase --exec 'git push' main",
    'git bisect run git push',
    'git -c help.autocorrect=immediate psuh',
    'git submodule update --remote --merge',
    'git submodule update --remote --rebase',
    'git p4 commit',
    'git svn branch feat',
    'git svn tag v1',
    'gh pr merge 12',
    'glab mr merge 12',
    'eval "git push"',
    'g=git; $g push',
  ]);
});

// On Windows the command name arrives with an extension, in any case, or as a
// backslash path, and the script may go to pwsh, powershell or cmd.
describe('commit-hygiene: Windows spellings of git and of a shell', () => {
  table('deny', DENY, [
    'git.exe push',
    'GIT.EXE push',
    '/c/Program\\ Files/Git/cmd/git.exe push',
    'C:\\Progra~1\\Git\\cmd\\git push',
    'bash.exe -c "git push"',
    'pwsh -Command "git push"',
    'powershell -Command "git push"',
    'cmd /c git push',
    'cmd /cgit push',
    'cmd /c"git push"',
    'powershell git push',
    'pwsh git push',
    'powershell -NoProfile git push',
    'powershell -ExecutionPolicy Bypass git push',
  ]);
  table('allow', ALLOW, ['git help push']);
});

// Garbage stdin must fail open, never take the tool call down with it.
describe('commit-hygiene: fails open, and inspects Bash only', () => {
  test('a missing lib/ fails open with the designed message, not a raw trace', (t) => {
    const dir = tempDir(t);
    const copy = path.join(dir, 'commit-hygiene.mjs');
    fs.copyFileSync(HOOK, copy);
    const res = runScript(copy, { input: hookEvent('Bash', { command: 'git push' }), cwd: dir });
    assert.equal(res.code, ALLOW, `stderr: ${res.stderr.trim()}`);
    assert.match(res.stderr, /could not evaluate, allowing through/);
  });
  test('fails open on unparseable stdin', () => expectExit('not json at all', ALLOW));
  test('passes an empty payload through', () => expectExit('{}', ALLOW));

  for (const [tool, file] of [
    ['Write', '/tmp/HANDOFF.md'],
    ['Read', '/tmp/roadmap-notes.md'],
  ]) {
    test(`a non-Bash tool is never inspected: ${tool} ${file}`, () => expectExit(hookEvent(tool, { file_path: file }), ALLOW));
  }
});
