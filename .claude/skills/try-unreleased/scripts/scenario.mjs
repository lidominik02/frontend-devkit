// Reads a /try-unreleased scenario file and judges its expectations against a finished run.
//
// A scenario is Markdown, so it reads without a dependency:
//
//   # bounded-change
//
//   Free text before the first section is a description and is not read.
//
//   ## Fixture
//   ### src/a.js
//   ```js
//   export const a = 1;
//   ```
//
//   ## Prompt
//   Rename a to b.
//
//   ## Answers
//   - Which language? → English
//
//   ## Expect
//   - file-exists src/a.js
//   - file-absent src/old.js
//   - file-matches src/a.js /export const b/
//   - tool-called Edit
//   - skill-called clarifying-features
//   - hook-blocked Stop /lint/
//   - form-asked /language/i
//
//   ## Options
//   - model: sonnet
//   - budget: 2
//   - packs: core, vue
//
// A fixture block's fence may be longer than three backticks, so a file holding a fence of its
// own fits. An answer matches a question whose text, header or one of whose option labels
// contains it, ignoring case, and applies only when that question offers its label.

import fs from 'node:fs';
import path from 'node:path';

const SECTIONS = ['Fixture', 'Prompt', 'Answers', 'Expect', 'Options'];
export const KINDS = {
  'file-exists': ['path'],
  'file-absent': ['path'],
  'file-matches': ['path', 'regex'],
  'tool-called': ['name'],
  'skill-called': ['name'],
  'hook-blocked': ['name', 'regex'],
  'form-asked': ['regex'],
};

export class ScenarioError extends Error {
  constructor(line, message) {
    super(`line ${line}: ${message}`);
    this.line = line;
  }
}

function parseRegex(text, line) {
  const m = /^\/(.+)\/([a-z]*)$/.exec(text);
  if (!m) throw new ScenarioError(line, `expected a /regex/, got "${text}"`);
  try {
    return new RegExp(m[1], m[2]);
  } catch (e) {
    throw new ScenarioError(line, `invalid regex ${text}: ${e.message}`);
  }
}

// The driver writes fixture files and the checks read expectation paths, so neither may leave the repo.
function relativePath(text, line) {
  const p = text.replace(/\\/g, '/');
  if (!p || p.startsWith('/') || /^[a-zA-Z]:/.test(p) || p.split('/').includes('..')) {
    throw new ScenarioError(line, `"${text}" is not a path inside the scratch repository`);
  }
  return p;
}

function parseExpect(text, line) {
  const kind = text.split(/\s+/, 1)[0];
  const rest = text.slice(kind.length).trim();
  const shape = KINDS[kind];
  if (!shape) return { kind, args: rest ? rest.split(/\s+/) : [], text };

  const args = [];
  let tail = rest;
  for (const [i, part] of shape.entries()) {
    const last = i === shape.length - 1;
    // A regex is always last and may hold spaces; a path or a name is one word.
    const word = last ? tail : tail.split(/\s+/, 1)[0];
    tail = tail.slice(word.length).trim();
    if (!word) throw new ScenarioError(line, `${kind} expects: ${shape.join(' ')}`);
    if (part === 'regex') args.push(parseRegex(word, line));
    else if (/\s/.test(word)) throw new ScenarioError(line, `${kind} expects: ${shape.join(' ')}`);
    else args.push(part === 'path' ? relativePath(word, line) : word);
  }
  return { kind, args, text };
}

function items(lines, section) {
  const out = [];
  for (const { text, line } of lines) {
    if (!text.trim()) continue;
    const m = /^-\s+(.+)$/.exec(text.trim());
    if (!m) throw new ScenarioError(line, `## ${section} holds only "- " items, got "${text.trim()}"`);
    out.push({ text: m[1].trim(), line });
  }
  return out;
}

const opens = (text) => /^(`{3,}|~{3,})/.exec(text)?.[1] ?? null;

function closes(fence, text) {
  const f = /^(`{3,}|~{3,})\s*$/.exec(text)?.[1];
  return Boolean(f) && f[0] === fence[0] && f.length >= fence.length;
}

function parseFixture(lines) {
  const files = [];
  let i = 0;
  while (i < lines.length) {
    const { text, line } = lines[i];
    if (!text.trim()) { i++; continue; }
    const head = /^###\s+(.+)$/.exec(text);
    if (!head) throw new ScenarioError(line, `## Fixture holds "### <path>" headings, each followed by a code block, got "${text.trim()}"`);
    const file = relativePath(head[1].trim(), line);
    if (files.some((f) => f.path === file)) throw new ScenarioError(line, `${file} is in the fixture twice`);
    i++;
    while (i < lines.length && !lines[i].text.trim()) i++;
    const fence = i < lines.length ? opens(lines[i].text) : null;
    if (!fence) throw new ScenarioError(line, `### ${file} has no code block`);
    const body = [];
    i++;
    while (i < lines.length && !closes(fence, lines[i].text)) {
      body.push(lines[i].text);
      i++;
    }
    if (i >= lines.length) throw new ScenarioError(line, `### ${file}: the code block is not closed`);
    i++;
    files.push({ path: file, content: body.length ? body.join('\n') + '\n' : '' });
  }
  return files;
}

/**
 * @param {string} text
 * @returns {{ name: string, prompt: string, fixture: {path: string, content: string}[],
 *   answers: {match: string, label: string}[], expect: {kind: string, args: (string|RegExp)[], text: string}[],
 *   model?: string, budgetUsd?: number, packs: string[] }}
 */
export function parseScenario(text) {
  const all = text.replace(/\r\n/g, '\n').split('\n').map((t, i) => ({ text: t, line: i + 1 }));
  let name = null;
  const sections = {};
  let current = null;
  let fence = null;

  for (const entry of all) {
    const t = entry.text;
    // A heading inside a code block is file content, not structure.
    if (fence) {
      if (closes(fence, t)) fence = null;
    } else if (opens(t)) {
      fence = opens(t);
    } else if (/^#\s/.test(t)) {
      if (name !== null) throw new ScenarioError(entry.line, 'a scenario has one "# <name>" heading');
      name = t.slice(2).trim();
      continue;
    } else if (/^##\s/.test(t)) {
      const title = t.slice(3).trim();
      if (!SECTIONS.includes(title)) throw new ScenarioError(entry.line, `unknown section "## ${title}"; the sections are ${SECTIONS.join(', ')}`);
      if (sections[title]) throw new ScenarioError(entry.line, `"## ${title}" appears twice`);
      sections[title] = { line: entry.line, lines: [] };
      current = sections[title];
      continue;
    }
    if (current) current.lines.push(entry);
  }

  const end = all.length;
  if (!name) throw new ScenarioError(1, 'no "# <name>" heading');
  if (!sections.Prompt) throw new ScenarioError(end, 'no "## Prompt" section');
  const prompt = sections.Prompt.lines.map((l) => l.text).join('\n').trim();
  if (!prompt) throw new ScenarioError(sections.Prompt.line, '"## Prompt" is empty');
  const fixture = parseFixture(sections.Fixture?.lines ?? []);

  const answers = items(sections.Answers?.lines ?? [], 'Answers').map(({ text: a, line }) => {
    const at = a.indexOf('→');
    const match = at < 0 ? '' : a.slice(0, at).trim();
    const label = at < 0 ? '' : a.slice(at + 1).trim();
    if (!match || !label) throw new ScenarioError(line, `an answer reads "- <question or header> → <label>", got "${a}"`);
    return { match, label };
  });

  // With nothing to check, every run would report every expectation met.
  const expect = items(sections.Expect?.lines ?? [], 'Expect').map(({ text: e, line }) => parseExpect(e, line));
  if (!expect.length) throw new ScenarioError(sections.Expect?.line ?? end, 'a scenario needs at least one "## Expect" item');

  const scenario = { name, prompt, fixture, answers, expect, packs: ['core'] };
  for (const { text: o, line } of items(sections.Options?.lines ?? [], 'Options')) {
    const m = /^(\w+):\s*(.+)$/.exec(o);
    if (!m) throw new ScenarioError(line, `an option reads "- <key>: <value>", got "${o}"`);
    const [, key, value] = m;
    if (key === 'model') scenario.model = value.trim();
    else if (key === 'budget') {
      const usd = Number(value);
      if (!(usd > 0)) throw new ScenarioError(line, `budget is a positive number of USD, got "${value}"`);
      scenario.budgetUsd = usd;
    } else if (key === 'packs') {
      const packs = value.split(',').map((p) => p.trim()).filter(Boolean);
      const bad = packs.find((p) => !/^[a-z][a-z0-9-]*$/.test(p));
      if (!packs.length || bad !== undefined) throw new ScenarioError(line, `packs is a comma-separated list of pack names, got "${value}"`);
      scenario.packs = packs;
    } else throw new ScenarioError(line, `unknown option "${key}"; the options are model, budget, packs`);
  }
  return scenario;
}

const bare = (label) => label.replace(/\s*\(recommended\)\s*$/i, '').trim().toLowerCase();

/**
 * The answer to one AskUserQuestion question: the scenario's, when the question offers its label,
 * else the first, recommended option. A scripted label goes back as the option's own label, so a
 * "(Recommended)" suffix need not be scripted; one the question does not offer is never sent,
 * because the session would read it as a free-text answer no form asked for.
 * @param {{ answers: {match: string, label: string}[] }} scenario
 * @param {{ question?: string, header?: string, options?: {label: string}[] }} question
 * @returns {{ label: string, scripted: boolean, offScript?: string }}
 */
export function answerFor(scenario, question) {
  const options = (question.options ?? []).map((o) => o.label);
  const haystacks = [question.question, question.header, ...options].filter(Boolean).map((s) => s.toLowerCase());
  const hits = scenario.answers.filter((a) => haystacks.some((h) => h.includes(a.match.toLowerCase())));
  for (const hit of hits) {
    const offered = options.find((o) => bare(o) === bare(hit.label)) ?? options.find((o) => bare(o).startsWith(bare(hit.label)));
    if (offered) return { label: offered, scripted: true };
  }
  const fallback = { label: options[0] ?? '', scripted: false };
  return hits.length ? { ...fallback, offScript: hits[0].label } : fallback;
}

const toolUses = (events) =>
  events
    .filter((e) => e?.type === 'assistant' && Array.isArray(e.message?.content))
    .flatMap((e) => e.message.content.filter((b) => b?.type === 'tool_use'));

function askedQuestions(events) {
  const fromTools = toolUses(events).filter((b) => b.name === 'AskUserQuestion').map((b) => b.input);
  const fromRequests = events
    .filter((e) => e?.type === 'control_request' && e.request?.subtype === 'can_use_tool' && e.request.tool_name === 'AskUserQuestion')
    .map((e) => e.request.input);
  return [...fromTools, ...fromRequests].flatMap((input) => input?.questions ?? []);
}

// Observed on Claude Code 2.1.283: a blocking Stop hook reports exit_code 0 and outcome "success",
// with {"decision":"block","reason":…} in its stdout. Exit code 2 blocks with stderr as the reason.
function blockReason(event) {
  if (event.exit_code === 2) return String(event.stderr ?? '');
  let out;
  try {
    out = JSON.parse(event.stdout || event.output || '');
  } catch {
    return null;
  }
  if (out?.decision === 'block') return String(out.reason ?? '');
  if (out?.hookSpecificOutput?.permissionDecision === 'deny') return String(out.hookSpecificOutput.permissionDecisionReason ?? '');
  return null;
}

/**
 * @param {ReturnType<typeof parseScenario>} scenario
 * @param {{ events: object[], repoDir: string }} run  every parsed stream line, and the scratch repository
 * @returns {{ text: string, result: 'met' | 'not-met' | 'unverifiable', detail: string }[]}
 */
export function checkExpectations(scenario, { events, repoDir }) {
  const hooks = events.filter((e) => e?.type === 'system' && e.subtype === 'hook_response');
  const check = ({ kind, args, text }) => {
    const verdict = (met, detail) => ({ text, result: met ? 'met' : 'not-met', detail });
    const unverifiable = (detail) => ({ text, result: 'unverifiable', detail });
    const file = typeof args[0] === 'string' ? path.join(repoDir, args[0]) : null;
    const streamed = ['tool-called', 'skill-called', 'hook-blocked', 'form-asked'].includes(kind);
    if (streamed && !events.length) return unverifiable('the run recorded no stream events');

    switch (kind) {
      case 'file-exists':
        return verdict(fs.existsSync(file), fs.existsSync(file) ? `${args[0]} exists` : `${args[0]} does not exist`);
      case 'file-absent':
        return verdict(!fs.existsSync(file), fs.existsSync(file) ? `${args[0]} exists` : `${args[0]} does not exist`);
      case 'file-matches': {
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return verdict(false, `${args[0]} is not a file`);
        const ok = args[1].test(fs.readFileSync(file, 'utf8'));
        return verdict(ok, ok ? `${args[0]} matches ${args[1]}` : `${args[0]} does not match ${args[1]}`);
      }
      case 'tool-called': {
        const n = toolUses(events).filter((b) => b.name === args[0]).length;
        return verdict(n > 0, `${args[0]} called ${n} time(s)`);
      }
      case 'skill-called': {
        const want = args[0];
        const called = toolUses(events).filter((b) => b.name === 'Skill').map((b) => String(b.input?.skill ?? ''));
        const hit = called.find((s) => s === want || (!want.includes(':') && s.endsWith(`:${want}`)));
        return verdict(hit !== undefined, hit ? `Skill ${hit} called` : `skills called: ${called.join(', ') || 'none'}`);
      }
      case 'hook-blocked': {
        if (!hooks.length) return unverifiable('the stream holds no hook events; the run needs --include-hook-events');
        const reasons = hooks.filter((e) => e.hook_event === args[0]).map(blockReason).filter((r) => r !== null);
        const hit = reasons.some((r) => args[1].test(r));
        if (hit) return verdict(true, `a ${args[0]} hook blocked with a reason matching ${args[1]}`);
        return verdict(false, reasons.length ? `${reasons.length} ${args[0]} block(s), no reason matches ${args[1]}` : `no ${args[0]} hook blocked`);
      }
      case 'form-asked': {
        const asked = askedQuestions(events);
        const hit = asked.find((q) => args[0].test(q.question ?? '') || args[0].test(q.header ?? ''));
        return verdict(hit !== undefined, hit ? `asked: "${hit.question}"` : `${asked.length} question(s) asked, none matches ${args[0]}`);
      }
      default:
        return unverifiable(`unknown expectation kind "${kind}"; the kinds are ${Object.keys(KINDS).join(', ')}`);
    }
  };
  // A file the run left unreadable fails its own expectation, not the whole report.
  return scenario.expect.map((e) => {
    try {
      return check(e);
    } catch (err) {
      return { text: e.text, result: 'unverifiable', detail: `could not be checked: ${err.message}` };
    }
  });
}
