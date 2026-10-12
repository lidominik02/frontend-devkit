# Végrehajtási terv: a frontend-devkit minimális architektúrája (2. kiadás)

Ez a terv egy **másik** Claude Code session számára készült, amely nem látta az auditot és a
Codex-review-t. Az indoklás `docs/plans/2026-10-12-architecture-audit.md`-ben van; ez a fájl
csak azt mondja, mit, milyen sorrendben, és mikor kész. Ahol választás lenne, a terv megadja.

Három döntés, amit a felhasználó hozott, és a terv nem nyit újra: **nincs hook** (a védelem
natív beállítás); **`run-gates.mjs` és `project-facts.mjs` törlődik**; **a skill-réteg is
egyszerűsödik** — protokoll nélküli artifact-fájlok, egy reviewer + verify, az
`optimizing-prompts` megszűnik. A skillek egyébként **maradnak**: `clarifying-features` külön
skill, `designing-architecture` "senior architect" szerepben; `DECISIONS.md` és
`CONTRACT-GAPS.md` külön fájl marad, mert egy feature 60+ döntést hordhat.

## 0. Alapfeltételek, kiindulás, munkamód

**Környezet.** A `dev` ág. Node 22.18+, a `claude` CLI 2.1.292 vagy újabb a `PATH`-on, git.
Nincs `package.json`, nincs `npm install` (ADR 0002). A parancsok shell-semlegesek: `node -e`
és `git`; ahol egy parancs csak Bash-ben fut, a terv megmondja.

**Kiindulás rögzítése, mielőtt bármihez nyúlsz.** A munkafa nem üres: `.gitignore` módosítva
(a `tmp/` sor), `docs/plans/` követetlen (három fájl). Ezeket nem eldobni, hanem rögzíteni:

```
git add .gitignore docs/plans
git commit -m "docs: architecture audit, Codex review and the minimal-architecture plan"
git tag min-0
node scripts/validate.mjs                       # 10 check zöld
node --test "scripts/test/*.test.mjs"           # 1733 teszt, 0 fail (4 skipped Windowson)
claude plugin validate . --strict
claude plugin validate plugins/core --strict
```

Ha bármelyik piros, előbb azt kell rendbe tenni. A `min-0` tag lokális, sosem pusholjuk; a
visszaállítás horgonya.

**Alapmérés, egyszer, a `temp/plan-baseline.md` fájlba** (a `temp/` gitignored), ezzel a
shell-semleges paranccsal, amelynek a kimenetét a fájlba másolod:

```
node -e "const {execSync:x}=require('child_process');const fs=require('fs');const f=x('git ls-files',{encoding:'utf8'}).split('\n').filter(Boolean);const g=(re)=>f.filter(p=>re.test(p));const lines=(ps)=>ps.reduce((n,p)=>n+fs.readFileSync(p,'utf8').split('\n').length-1,0);const rep=(k,ps)=>console.log(k.padEnd(34),String(ps.length).padStart(4),String(lines(ps)).padStart(7));rep('mjs total',g(/\.mjs$/));rep('shipped scripts',g(/^plugins\/core\/scripts\/.*\.mjs$/));rep('repo tooling',g(/^scripts\/(ci\/|hooks\/)?[^/]+\.mjs$/));rep('skill-local scripts',g(/^\.claude\/skills\/.*\.mjs$/));rep('tests',g(/^scripts\/test\/.*\.mjs$/));rep('shipped prose (no evals)',g(/^plugins\/.*\.md$/).filter(p=>!/\/evals\//.test(p)));rep('core skill prose',g(/^plugins\/core\/skills\/.*\.md$/));rep('core evals',g(/^plugins\/core\/evals\//));rep('docs+adr',g(/^(docs\/|README|CONTRIBUTING|CLAUDE)/).filter(p=>/\.md$/.test(p)&&!/docs\/plans/.test(p)))"
```

Mellé a tesztsuite `# duration_ms` sora. A várt értékek az audit 5. fejezetének "Most"
oszlopa (44 / 14 169; 11 / 5 003; 21 / 6 857; 8 789 szállított próza; 68,8 s).

**Munkamód.** Hét fázis, mindegyik egy commit a `dev` ágon, a commit után egy lokális tag
`min-<N>`. A fázis végén a 10. fejezet parancsai zöldek. Semmit nem pusholunk és nem tagelünk
`v*`-gal; a release a `/release` dolga a végén, és a 9. fejezet feltételéhez kötött.

**Visszaállítás.** A fázisok egymásra épülnek, ezért egy fázis önálló `git revert`-je nem
mindig tiszta. A szabály: visszaállítás **fordított sorrendben** (`git revert min-7..min-6`
előbb, aztán tovább), vagy a felhasználó kifejezett döntésére `git reset --hard min-<N-1>`,
ami csak azért biztonságos, mert semmit nem pusholtunk. A reset destruktív: csak a felhasználó
mondhatja ki.

**Szabály minden fázisra.** Amit egy fázis töröl, azt egyetlen fájl sem építi újra más néven.
Tilos: új hook, `guard.mjs`, `shell-parse`-utód, `facts`/`gates` segédscript, `*-v2`, új
`lib/`, új scenario-formátum, új CLI-driver, SDK-függőség, új ledger-alak, új archívum- vagy
mozgatási szabály, új reviewer-lencse, új planning-fájl a négyen felül.

## 1. fázis — Fogyasztó nélküli tooling és a CI

A consumer-viselkedés nem változik.

### 1.1 Törlés

```
git rm -r .claude/skills/try-unreleased .claude/skills/windows-check
git rm .claude/skills/release/scripts/release-check.mjs
git rm scripts/ci/release-warning.mjs scripts/ci/plugin-validate.mjs
git rm scripts/test/try-unreleased-driver.test.mjs scripts/test/try-unreleased-scenario.test.mjs
git rm scripts/test/fixtures/fake-claude.mjs scripts/test/windows-check-probes.test.mjs
git rm scripts/test/release-check.test.mjs scripts/test/parse.test.mjs
```

### 1.2 `.github/workflows/validate.yml`

- Az `Install Claude Code` lépés: `npm install -g @anthropic-ai/claude-code@2.1.292`.
- A `Validate marketplace and plugins` lépés shell (a runner Bash):

  ```yaml
  - name: Validate marketplace and plugins
    run: |
      set -e
      claude plugin validate . --strict
      for src in $(node -e 'for (const p of JSON.parse(require("fs").readFileSync(".claude-plugin/marketplace.json","utf8")).plugins) console.log(p.source)'); do
        claude plugin validate "$src" --strict
      done
  ```

  Az exit code a kapu; kimeneti karakterre nem szűrünk (2.1.292-n `--strict` warningra exit 1,
  megfigyelve 2026-10-12).
- A `Release warning` lépés és a `fetch-depth: 0` ki, ha más nem használja.
- **Nincs** canary job ebben a fájlban.

### 1.3 Új `.github/workflows/canary.yml` (≤ 25 sor)

Trigger: `schedule` (hetente egyszer) és `workflow_dispatch`. Egy job, `ubuntu-latest`,
`npm install -g @anthropic-ai/claude-code@latest`, majd az 1.2 validate-lépése szó szerint.
**`continue-on-error` nincs**: a job hibája piros workflow-futás, ami a repo Actions-listájában
és az értesítésekben látszik. A fájl fejléc-kommentje: "the merge gate (`validate.yml`) runs a
pinned CLI; this run watches the latest release; a red run is the signal to run
`/cli-upgrade-check`".

### 1.4 `.github/workflows/release.yml`

A `Marketplace checks` elé:

```yaml
- name: Tag matches every plugin version
  run: |
    v="${GITHUB_REF_NAME#v}"
    for m in plugins/*/.claude-plugin/plugin.json; do
      pv=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).version)' "$m")
      [ "$pv" = "$v" ] || { echo "::error::$m is $pv, tag is $v"; exit 1; }
    done
- name: Install Claude Code
  run: npm install -g @anthropic-ai/claude-code@2.1.292
```

és a `Test suite` után az 1.2 validate-lépése. A rögzített verzió így **két helyen** él
(`validate.yml`, `release.yml`); a `cli-upgrade-check` 1.5 szerint mindkettőt emeli.

### 1.5 `scripts/validate.mjs`

- `checkDocsLinks` és segédei (`proseLines`, `anchors`, `LINK`, `DEFINITION`, `linkTargets`),
  `checkMcpNames` ki; a `CHECKS` térképből `'docs-links'` és `'mcp-names'` ki.
- `scriptRoots`: csak `plugins` és `scripts` (a `.claude/skills/*/scripts` ág ki).
- `IGNORED_IN_PLUGIN_AGENT = ['permissionMode', 'hooks', 'mcpServers', 'initialPrompt']`,
  komment: "documented on the plugins/components page, read 2026-10-12; the CLI 2.1.292
  validator does not flag them".
- A `devkit.config.json` `docs` kulcsának olvasása ki.

### 1.6 Tesztek

- `scripts/test/validate.test.mjs`: a `docs-links`, `mcp-names` esetei ki; a "the scripts check
  parses a repo-local skill's own scripts" `describe` blokk (292–309) ki; új eset: plugin-agent
  fixture `hooks:` mezővel → finding "ignored in a plugin agent"; új eset: a core `hooks.json`
  létezik és minden `args`-eleme fájl (a törölt `parse.test.mjs:43-47` assertionja; **a 5.
  fázis ezt az esetet törli** a hookkal együtt).
- `scripts/test/helpers.mjs`: a `runScript`/`runScriptAsync` előzetes `node --check` lépése ki.

### 1.7 Próza

- `.claude/skills/release/SKILL.md`: `allowed-tools`-ból a `release-check.mjs` és
  `release-warning.mjs` grantok ki. 1. lépés: a release-warning hívás helyett
  `git diff --quiet <tag> HEAD -- plugins .claude-plugin` (exit 0 = semmi szállított nem
  változott). A `/windows-check` és `/try-unreleased` kérdés helyett: "a kézi release-smoke
  lefutott-e" — a skill végén "Kézi release-smoke" cím alatt két forgatókönyv (a mai
  `bounded-change.md` és `open-task-continue.md` tartalmából, 10–15 sor egyenként, scenario-
  szintaxis nélkül). 3. lépés: `node scripts/validate.mjs` a munkafán, az előfeltétel: `git
  status --porcelain` csak `CHANGELOG.md`-t és `plugins/*/.claude-plugin/plugin.json`-t mutat.
- `.claude/skills/cli-upgrade-check/SKILL.md` → három lépés: (1) `claude plugin validate
  --strict` a rögzített és a legfrissebb CLI-n, a három packra; (2) a frontmatter-próba egy
  scratch fixture-ön (egy `.claude-plugin/plugin.json` + egy `skills/x/SKILL.md` elgépelt
  mezővel, `--strict` a könyvtárra és a `skills/` könyvtárra); (3) a verified-on jegyzetek és a
  **két** pin-hely (`validate.yml`, `release.yml`) emelése. A "What is actually load-bearing"
  lista két tételre: strict exit; a frontmatter-claim és az allowlistek.
- `.claude/skills/new-pack/SKILL.md:74`: a `docs-links` mondat ki (a skill a 6. fázisban
  törlődik; addig ne hivatkozzon törölt checkre).
- `CLAUDE.md`: a Repo-local tooling táblából a `/try-unreleased` és `/windows-check` sor ki; a
  Gates szakaszban egy mondat: "CI runs a pinned CLI; `canary.yml` watches the latest weekly".
- `CONTRIBUTING.md`: a "Which tool when" tábla két sora ki; a "Trying an unreleased change"
  szakasz a `--plugin-dir` kézi módszert tartja, a `/try-unreleased` mondat ki; a "Tests"
  szakaszból a `parse.test.mjs` és a `--check` mondat ki.
- `docs/contributing/validation.md`: a `docs-links` és `mcp-names` sor ki; a `docs.roots` sor ki.
- `docs/adr/0011-cross-platform-and-observed-platform-claims.md`: a "CI installs the latest CLI
  rather than a pinned one" döntés helyett: "the gate runs a pinned CLI; `canary.yml` watches
  the latest; a red canary is the `/cli-upgrade-check` signal". Egy "Amended 2026-10-xx" sor.
- `docs/adr/0010-shared-version-and-release-branch-model.md:32`: a `/try-unreleased` hivatkozás
  ki.

### 1.8 Definition of Done

- `node scripts/validate.mjs` **8** checket jelent, zöld; a 10. fejezet parancsai zöldek.
- `git grep -n -e release-check -e release-warning -e plugin-validate.mjs -e try-unreleased -e windows-check -e docs-links -e mcp-names -e fake-claude -e parse.test -- ':!CHANGELOG.md' ':!docs/plans'` → 0 találat.
- `.github/workflows/canary.yml` létezik, `continue-on-error` sztring nincs benne.
- `git tag min-1`.

## 2. fázis — Az artifact-modell és a lánc (clarifying, designing, planning, executing, reviewing, finishing)

Csak próza és eval. A scriptek még léteznek, de ettől a fázistól egyetlen itt átírt fájl sem
hívja a `project-facts.mjs`-t vagy a `run-gates.mjs`-t.

### 2.1 Az új referencia: `plugins/core/skills/planning-features/references/project.md` (≤ 40 sor)

Címe "Reading the project". Négy szabály, pontosan ezzel a tartalommal:

```
## Package manager
The lockfile names it: pnpm-lock.yaml → pnpm · yarn.lock → yarn · bun.lock or bun.lockb → bun ·
otherwise npm. A `packageManager` field in package.json wins. Run scripts as `<pm> run <script>`.

## Framework packs
Read the workspace's package.json — the root, or the workspace the task names in a monorepo
(`workspaces` in package.json, or pnpm-workspace.yaml). dependencies + devDependencies:
`nuxt` present → call the Skill tool with "vue:vue-engineering", then "nuxt:nuxt-engineering";
else `vue` present → "vue:vue-engineering"; else none — say so, follow the codebase's conventions.
A later pack wins every conflict. Each dispatch to a worker names the packs it found.

## Gates
Read package.json `scripts`. The fast gates are typecheck (`typecheck`, `type-check` or `tsc`)
and lint (`lint`); test (`test`) and build (`build`) are held until the user releases them.
Run each as `<pm> run <script>` from the workspace's directory, read the exit code and the last
40 lines. Report each gate as exactly one of: `pass` (exit 0) · `FAIL` (non-zero, the error
lines quoted) · `NOT RUN (<reason>)` — no such script, held, a script that watches, a
package.json that is not valid JSON. NOT RUN is never a pass, and a gate that did not run is
never implied passed. Never run a script whose body contains --watch, --fix, --write or --apply.

## Base branch
`git symbolic-ref --quiet --short refs/remotes/origin/HEAD` → `origin/<base>`. Without a
remote HEAD, `main` or `master` if it exists locally; otherwise ask. The diff base of a branch
is `git merge-base HEAD origin/<base>` (or the local base).
```

Minden skill, amely eddig a két scriptet hívta, egy mondattal erre mutat: "Read
`../planning-features/references/project.md` first: the package manager, the framework packs,
the gates and the base branch come from there."

### 2.2 `plugins/core/skills/planning-features/references/artifacts.md` → teljes újraírás (≤ 130 sor)

```
temp/<feature>/
├── PLAN.md            always
├── STATUS.md          always
├── DECISIONS.md       always; open questions at the top, decisions below
├── CONTRACT-GAPS.md   only when the feature involves the API
├── research/          one cited note per question (shape below)
├── review/            NN-review.md, NN-re-review.md (reviewing-changes writes them)
└── qa/                TEST-LIST.md, REPORT.md (testing-changes writes them)
```

Olvasási szabály, egy bekezdés: `STATUS.md` és `PLAN.md` egészben; `DECISIONS.md` és
`CONTRACT-GAPS.md` **id szerint, greppel** — egy lépés a megnevezett `D<n>`/`OQ<n>`/`CG<n>`
bejegyzést olvassa, soha az egész fájlt; egy research-note `Answer:` sora először. Nincs
"Reading the artifacts" táblázat ezen felül.

`PLAN.md` szakaszai, ebben a sorrendben, mind jelen ("none" ahol üres):

```
# Plan: <feature-slug>

## Outcome · ## Sources · ## Constraints
## Success criteria        one per line, tagged SAID | ASSUMED | EXTRA
## User flow · ## Business rules (each with its rationale) · ## States (loading, empty, error, permission)
## Design                  type, location, coverage | not applicable
## Global constraints      exact values, copied into every task that uses them
## Review focus            failure modes no acceptance criterion covers, each → task name
## Architecture fit        existing assets to reuse, each with its path
## Out of scope · ## Deferred (each with its trigger)
## Tasks
### Task: <name>
Files: create <path> · modify <path>
Interfaces: consumes <exact names> · produces <exact names>
Design: <screens and states, or none>
Acceptance criteria: - <observable, from a success criterion>
Steps: 1. <what to decide or produce, and where>
Done when: <the fast gates by name, or "no gates declared"> pass, and <the observation that proves the criteria>
Blocked by: <task names | OQ<n> | none>
Tier: mechanical | judgment
```

`DECISIONS.md` (append-only; semmi nem mozog, semmi nem törlődik):

```
# Decisions: <feature-slug>

## Open questions
- OQ<n> · <question> · owner: user | product owner | designer | backend | client · blocks: <task> | nothing
  (answered: D<n> is appended to the line when a decision settles it; the line stays)

## Decisions
- D<n> · <date> · <decision>
  - Rejected: <the alternative>
  - Source: <a PLAN section, a research note, the user's words quoted>
  (a later decision that replaces this one appends `· superseded by D<m>` to this first line
  and names `supersedes D<n>` on its own; both stay where they are)
```

`CONTRACT-GAPS.md` (only when the feature involves the API; append-only):

```
# Contract gaps: <feature-slug>
- CG<n> · <endpoint, field, event or behaviour> · missing | differs | unconfirmed
  - Needed for: <success criterion, task, or the fix of <slug>>
  - Blocks: <task> | nothing
```

`STATUS.md`:

```
# Status: <feature-slug>

Stage: clarify | plan (awaiting approval) | execute (task N/M, <mode>) | review | user reads code + findings | fix findings | QA list (awaiting approval) | testing | user's check | finish — owner: <skill or the user>
Rules: the default rules block | the user's own: <verbatim>
Mode: subagent per task | inline | not chosen

## Tasks
| Task | Status | Gates | Review |
| --- | --- | --- | --- |
| <name> | not started · in progress · done · blocked (OQ<n>) | <gate> pass · <gate> NOT RUN (<reason>) | <verdict line> |

## Verified
<each gate with its latest result; a pre-execution tree id; what was observed by hand>

## Closed findings
- <report path> <id> — deferred | kept as designed (<reason>) | not ours (<owner>)

## Log
- <date> · <one free line per event: execution start, task done, review written, sync, fix, finish>

## Next action
<one action, and who takes it>

## Kickoff prompt
Resume the feature <slug> with the planning-features skill, in resume mode. Read first:
temp/<slug>/STATUS.md, then temp/<slug>/PLAN.md, the task "<name>", then <any file the next
action needs>. Next action: <the action>. Rules: <the rules line>.
```

Szabályok a fájl végén, hat mondat: a Log append-only, szabad soros, alak nélkül; a Tasks tábla
az egyetlen hely, ahol egy task Done; a Closed findings sor zár egy findingot; egy nyitott
finding az, ami a legfrissebb `review/` reportban szerepel és nincs itt lezárva; DECISIONS és
CONTRACT-GAPS sosem mozgat és nem töröl, egy új id a legmagasabb után következik; a
research-note alak változatlan (`Date`, `Answer:` ≤ 5 sor, `Evidence`, `Unsettled`). Régi
feature-ök: "A feature written under the six-file layout is carried over by hand once: paste
SPEC.md into PLAN.md's spec sections and PLAN.md's tasks after them, OPEN-QUESTIONS.md above
DECISIONS.md's entries, HANDOFF.md and PROGRESS.md's task table into STATUS.md, and move
`planning/archive/*` entries back into their files; the old files stay as the user's archive."
Semmi más kompatibilitás.

Törlés: `handoff-format.md`, `plan-format.md`. `rules-block.md` marad (≤ 30 sor).

### 2.3 `plugins/core/skills/planning-features/SKILL.md` → újraírás (body ≤ 180)

Frontmatter: a mai `description` marad (a `clarifying-features` felé mutató mondattal);
`argument-hint: "[plan|resume|checkpoint] [feature]"`; `allowed-tools`: `Bash(git status *)
Bash(git log *) Bash(git rev-parse *) Read Grep Glob Skill AskUserQuestion`.

Mód `plan`: (1) a PLAN.md spec-szakaszai és a DECISIONS.md nyitott kérdései; egy hiányzó spec
vagy egy nem kérdezett termékkérdés → hand-back a `core:clarifying-features` `gap` módjának;
(2) a Tasks szakasz megírása (vertikális szeletek, `Done when` a `project.md` gate-neveivel; egy
meglévő Tasks szakasz esetén csak az érintett taskok átírása, a Done taskok érintetlenül);
(3) önellenőrzés (coverage, interfaces, review focus, proportion); (4) STATUS `plan (awaiting
approval)`; (5) jóváhagyás + mód egy formmal (Subagent per task / Inline / Approve, choose
later / Change), és a `core:executing-plans` hívása vagy a kickoff prompt. Plan mode alatt: a
fájlírás a plan mode kilépése után.

Mód `resume`: a STATUS és a PLAN olvasása; `git status --short --branch`, `git log --oneline
-20` összevetés; drift jelentése; a Stage és a Next action kimondása; várakozás; egy resumen
túli kérés routingja (`clarifying-features gap`, `plan`, `executing-plans`). Egy archivált
feature: "`temp/archive/<feature>/` — move it back by hand (it is untracked) and resume again."

Mód `checkpoint`: `temp/handoffs/<slug>.md` a mai checkpoint-alakkal (Done / Verified / Left /
Pick up / Kickoff prompt), ≤ 10 sor a bodyban.

Megy: `save` mód, a régi formátumú feature felvétele, az archívum-keresés, a 60-bejegyzéses
szabály, a `run-gates --list` hívás, a `designing-architecture`-re mutató "Research and
decision forms" szakasz két mondatra (a `## Guards` hivatkozás marad).

### 2.4 `plugins/core/skills/clarifying-features/SKILL.md` (body ≤ 170), `references/sources.md` (≤ 110), `references/question-rounds.md` (≤ 90)

Külön skill marad. `allowed-tools`: a `project-facts` és `run-gates` grant ki; `snapshot`
marad (bounded route); + `Bash(npm run *) Bash(pnpm run *) Bash(yarn run *) Bash(bun run *)`.
Módok változatlanul: `new`, `gap`, `continue`, `research`. Round 1: a `project-facts`
hívás és a `designReference`/`userStoryPath` mondat helyett "a story the user names, or the
files under `requirements/`"; a bounded route 2. lépése a `project.md` packjai, 5. lépése a
`project.md` gate-jei. A feature route: `temp/<feature>/` + PLAN.md spec-szakaszai + DECISIONS.md
+ STATUS.md (`clarify`); minden válasz egy DECISIONS-bejegyzés ugyanabban a turnben; egy
felülírt döntés helyben jelölve. A `gap` ág: "move the earlier entry to planning/archive" ki.
Az exit gate és a SPEC-írás → "write PLAN.md's spec sections in full", majd
`core:planning-features plan`. Megy: a questionnaire-fájl (a harmadik félnek szóló kérdés egy
OQ-sor, a felhasználó továbbítja ahogy akarja), a régi formátumú feature bekezdése, az
archívum-mozgatások. `sources.md`: a `project-facts` bekezdések ki; a research-dispatch és a
note-alak marad. `question-rounds.md`: a questionnaire-szakasz ki; az exit self-check egy
mondat szakaszonként; az authority order marad.

### 2.5 `plugins/core/skills/designing-architecture/SKILL.md` (body ≤ 180), `references/codebase-design.md` marad; `alternatives.md`, `survey.md` DELETE

A "senior architect". Frontmatter: `disable-model-invocation: true` marad; `description`:
"Settles a hard decision from what the codebase already has — an architectural question, a
library or approach choice, where something belongs, whether an abstraction is worth it — or
critically evaluates a design the user proposes: evidence, two or three options with their
cost, a recommendation, the user's decision, a record, and a handoff to clarifying-features
to build it. Writes no code. Use when the user types /core:designing-architecture with a
question, or with their own proposal to evaluate." `allowed-tools`: a `project-facts` grant
ki; `Bash(git log *) Bash(git rev-parse *) Bash(git check-ignore *) Read Grep Glob Agent Skill
AskUserQuestion`.

Két bemenet: **a kérdés** (a mai 1–7. lépés) és **a felhasználó saját terve** — új, a 2. lépés
előtt egy bekezdés: a terv a nulladik opció; a bizonyíték-lépés ugyanúgy fut (létező
mechanizmus, a projekt természete, a history); a 3. lépés a terv mellé legalább egy
lényegesen más opciót tesz; a 4. lépés ajánlása kimondja, mi gyengíti a felhasználó tervét
(a `codebase-design.md` három tünete: change amplification, cognitive load, unknown unknowns)
és mi szól mellette; a döntés a felhasználóé. A "hard decision" ág: a három párhuzamos
draftoló ágens helyett a főszál ír két lényegesen különböző opciót és a `codebase-design.md`
"Design it twice" táblájával hasonlít (az `alternatives.md` táblája ≤ 8 sorban a bodyba). A
kérdés nélküli survey-mód megy: "No question: ask for one in a sentence, with an example;
nothing is surveyed." A rekord (`ARCHITECTURE-<slug>.md` a scratchpadban, majd `temp/`-ben
vagy a feature `temp/<feature>/`-jében), a repo-rekord kérdése és a `clarifying-features`
átadás marad. A `PM's spec` pont: `temp/<feature>/PLAN.md` és `requirements/`.

### 2.6 `optimizing-prompts` törlése — a 3. fázisban (3.1 tábla).

### 2.7 `plugins/core/skills/executing-plans/SKILL.md` (body ≤ 200) és `references/dispatch.md` (≤ 120)

`allowed-tools`: `Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs *) Bash(git check-ignore *)
Bash(git cat-file -e *) Bash(git rev-parse *) Bash(npm run *) Bash(pnpm run *) Bash(yarn run *)
Bash(bun run *) Read Grep Glob Agent Skill AskUserQuestion SendMessage`.

Pre-flight: feature; STATUS és PLAN olvasása, a DECISIONS.md-ből csak a taskok `Blocked by`
sorai által nevezett `OQ<n>` bejegyzések (greppel: egy `answered: D<n>` nélküli OQ blokkol);
mód; **baseline**: a fast gate-ek a `project.md` szerint, az eredmény a STATUS `Verified`
szakaszába (nincs `baseline-*.json` fájl); `snapshot.mjs take` → a pre-execution tree a
`Verified`-be; inline módban a packok betöltése.

Subagent per task, taskonként: (1) `snapshot take` → task base; STATUS Stage és a sor `in
progress`; (2) brief `temp/<feature>/tasks/<NN>-<slug>-brief.md` a `dispatch.md` sablonjával
(a mai mezők, a `Report:` és `Baseline:` sorok nélkül; `Decisions:` a task által nevezett
`D<n>` bejegyzések szó szerint, nem a fájl; `Packs:` sor a `project.md` szerint;
`Gates:` sor a baseline-eredménnyel); (3) `core:implementer` foreground, `sonnet`
mechanikusra, különben a session modellje; (4) státusz-tábla (DONE / DONE_WITH_CONCERNS /
NEEDS_CONTEXT / BLOCKED, a mai négy sor); (5) `snapshot diff <base> --out
temp/<feature>/tasks/<NN>-<slug>.diff`, a stat-sorok a brief Files-ával összevetve; (6) a fast
gate-ek futtatása, minden hiba összevetve a baseline `Verified` soraival: a taské / előzetes /
eldöntetlen (a mai három definíció, ≤ 8 sor); (7) `core:reviewer` foreground, `Role: two-axis`,
a dispatch-alak a `reviewing-changes/references/formats.md`-ből; (8) fix-roundok ≤ 3 (a mai
szabály: 1–2 ugyanannak az implementernek `SendMessage`-dzsel, 3. friss implementer; minden
round után diff + gate + `re-review`); (9) a task zárása: STATUS sor `done` a gate-ekkel és a
review-verdikttel, egy Log-sor; (10) pause-form (Continue / Continue without pausing / Stop).

Inline: open → implement (Edit/Write; shell-szerkesztés után a projekt formattere a megérintett
fájlokon) → gate-ek → close.

Run vége: `snapshot take` → a tree a `Verified`-be; minden task done → `core:reviewing-changes`
a pre-execution tree-vel; ha a rules holdolja a review-t → STATUS `user reads code + findings`,
"no review ran", stop; blokkolt taskok → egy form (Review now / Wait).

`fix-findings`: a legfrissebb `review/` report nyitott findingjai (a `Closed findings` sorok
nélkül); formok ≤ 4 finding/kérdés: Fix / Defer / Keep as designed; Defer és Keep → egy
`Closed findings` sor; egy döntést megváltoztató válasz → új DECISIONS-bejegyzés `supersedes
D<n>`-nel; Fix → a rögzített módban (egy implementer egy fix-brieffel, vagy inline); utána
`core:reviewing-changes` `re-review`. Nincs triage-küszöb, nincs batch-investigation, nincs
remit-form: egy finding, amelynek az oka nem a frontendé, `Keep as designed (not ours:
<owner>)`-ként záródik, és a felhasználó az `investigating-bugs`-t hívja, ha akarja.

Törlés a bodyból: conflict table, `baseline retaken`, a git history/index task szakasz (a
PLAN-ban egy task, amely rebase-t nevez, a `core:syncing-branches`-hez megy, mielőtt bármi más
fut), a report-fájlok. `dispatch.md`-ből: a format pass szakasz, a fix brief `Baseline:` sora,
a troubleshooting-tábla három sorra (`snapshot.mjs` exit 1; a tree elveszett → `Review from the
merge-base` form; a felhasználó commitolt taskok között → semmi teendő).

### 2.8 `plugins/core/agents/implementer.md` (≤ 110)

2. lépés: "Read `${CLAUDE_PLUGIN_ROOT}/skills/planning-features/references/project.md`; the
brief's `Packs:` line names the packs — call each engineering skill in that order." 7. lépés
indoka: "Write files only with Edit and Write: a shell write is not formatted and is harder to
review." 9. lépés: a fast gate-ek a `project.md` szerint, a brief `Gates:` sorával összevetve.
11–12. lépés összevonva: **nincs report-fájl**; a visszatérő üzenet ≤ 20 sor: `STATUS`,
`Files`, `Acceptance` (criterion — met | not met — evidence), `Gates`, `Concerns`, `Question`.
A `Report:` említések ki. `tools` változatlan.

### 2.9 `plugins/core/agents/reviewer.md` (≤ 130)

Frontmatter: `tools: Read, Grep, Glob, Skill`. Inputs: a role (`two-axis`, `verify`,
`re-review`), a diff file, az intent sources, a `Packs:` sor, a `Gates:` blokk (már futott),
released. 2. lépés: "Load the framework lens: for each pack the dispatch names, call the Skill
tool with it and apply its review checklist." 3. lépés: "Gates: report the dispatch's block as
given; run nothing." A `lens` szerep, a `typescriptTooNewForVueTsc`/`typecheckVacuous`
említés, a "rule you hold, not a wall" bekezdés ki. "What this must NOT do" első pontja: "Edit,
write or run anything — `Write`, `Edit` and `Bash` are not in this agent's tool set."

### 2.10 `plugins/core/skills/reviewing-changes/SKILL.md` (≤ 150) és `references/formats.md` (≤ 90)

`allowed-tools`: `Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs *) Bash(git rev-parse *)
Bash(git merge-base *) Bash(git symbolic-ref *) Bash(git check-ignore *) Bash(npm run *)
Bash(pnpm run *) Bash(yarn run *) Bash(bun run *) Read Grep Glob Agent Skill AskUserQuestion`.

Scope: feature; base (a hívóé → a `project.md` base-szabálya → kérdés); review folder
(`temp/<feature>/review/` vagy `temp/reviews/`), `<NN>` számozás; `snapshot diff <base> --out
<folder>/<NN>-review.diff`; üres diff → stop. Intent sources, útvonalként: `temp/<feature>/PLAN.md`,
`temp/<feature>/DECISIONS.md`, `requirements/` ha van, az in-chat design szó szerint. Gates
egyszer, a `project.md` szerint, a blokk minden dispatchbe.
**Dispatch: egy `core:reviewer` `Role: two-axis`, majd egy `Role: verify` a jelöltekkel** —
modellparaméter nélkül. Report a `formats.md` alakjával (a mai, a `Tier`, `Reviewers` és
`Conflicts with a decision` sorok nélkül; a finder findingja, amely egy `D<n>` döntésnek
ellentmond, a `verify` verdikt mellett egy `conflicts with D<n>` jelölést kap). STATUS: Stage
`user reads code + findings`, Next action, egy Log-sor. Feature nélkül: csak a diff és a
report. `re-review`: a legfrissebb report snapshot-fája → fix diff → gate-ek → a nyitott
findingok (a STATUS `Closed findings` nélkül) → egy `core:reviewer` `Role: re-review`.

Törlés: `references/lenses.md`; a tier, a gap sweep, a dedupe, a `## Guards` beillesztés a
dispatchbe (a two-axis szerep "Reuse" és "Deletion test" pontjai lefedik), a `model: opus`.

### 2.11 `plugins/core/skills/finishing-features/SKILL.md` (≤ 110); `references/menu.md` törlés

`allowed-tools`: `Bash(git status *) Bash(git log *) Bash(git diff *) Bash(git rev-parse *)
Bash(git rev-list *) Bash(git symbolic-ref *) Bash(git fetch origin *) Bash(git branch --list *)
Bash(git add -- *) Bash(git commit -F *) Read Write Grep Glob Skill AskUserQuestion`.

1. Set up: feature; base branch a `project.md` szerint; STATUS és PLAN olvasása.
2. Completeness check, egy sor forrásonként: a Tasks tábla (minden done vagy blocked); a
   legfrissebb `review/` report nyitott findingjai; `qa/REPORT.md` findings nélkül, vagy a
   felhasználó skipje; a DECISIONS.md `answered:` nélküli, blokkoló OQ-sorai; a CONTRACT-GAPS.md
   sorai emlékeztetőnek.
   Gate-ek: a STATUS `Verified` legutóbbi eredménye, újra nem fut.
3. "Are we done?" form: Done (→ 4), Found something (→ `core:executing-plans fix-findings`
   vagy `core:fixing-bugs`), Want something more (→ `core:clarifying-features gap` a feature-re).
   QA nélkül második kérdés: run the QA list (`core:testing-changes`) / skip.
4. Három lépés, mindegyik a saját formjával: **Commit** — `git status --porcelain`; a
   `core:describing-changes` hívása "Text only. Use these gate results and run no gate: …"
   szöveggel, az alakja a `shaping-commits.md` szerint; elfogadott üzenet → `git add -- <files>`,
   `git commit -F <message file> -- <files>` (az üzenet a Write-tal egy temp-fájlba, sosem
   idézőjelben). **MR description** — `git fetch origin <base>`; `git rev-list --count
   HEAD..origin/<base>` > 0 → figyelmeztetés és `core:syncing-branches` ajánlat; a szöveg a
   repo sablonjával. **Open items** — open questions, contract gaps, nyitott findingok, NOT RUN
   gate-ek, `git branch --list 'backup/*'`.
5. Close: STATUS Stage `finish`, Status (a commitok hash + subject), Next action "the user
   pushes and opens the merge request"; egy Log-sor; egy form: Archive now (recommended, ha
   nincs blokkolt task) / Leave it — Archive: `mkdir -p temp/archive && mv temp/<feature>
   temp/archive/<feature>` (ütköző név → `-<YYYYMMDD-HHMM>`); Leave: semmi mozog. Chat brief:
   a commitok, a szövegek copyable blokkban, az open items, a mappa helye. Push, merge, MR:
   a felhasználóé.

Törlés: held archive, a "nothing changed since the last finish" anchor-logika, project-docs
update, team summary, tidy `temp/`, a menü visszatérése.

### 2.12 Evalok ebben a fázisban

- Törlés: `plugins/core/evals/finishing-held-archive`, `resume-reopen`.
- Átírás `designing-architecture`: a survey-mód helyett a saját-terv értékelése. Prompt: a
  felhasználó egy egyfogyasztós absztrakciót javasol (egy wrapper egy meglévő composable köré)
  `/core:designing-architecture`-rel; a kritérium: a létező mechanizmus megnevezve útvonallal és
  hívásszámmal; legalább egy lényegesen más opció; a terv költsége kimondva; nincs kódírás; a
  döntés a felhasználóé (egy form). Baseline-elvárás: a bare modell általában egyetért a
  tervvel és nem keres létező mechanizmust.
- Átírás (fixture és kritérium a PLAN/STATUS/DECISIONS alakra): `planning-from-spec`,
  `planning-default-rules`, `checkpoint-kickoff` (csak a HANDOFF-említések), `executing-pause`
  (a hat planning-fájl helyett PLAN/STATUS/DECISIONS; a `snapshot.mjs` említés marad),
  `finishing-features`. A kritériumok **kimenetet** mérnek, nem mechanizmust: egy "ledger
  entry" sor helyett "STATUS.md's Log gains a line that names the finish and the commit".
- Szerkesztés (csak artifact-nevek; az invokáció változatlan): `clarifying-conflicting-sources`,
  `clarifying-frontier`, `clarifying-rule-rationale` — `SPEC.md` → PLAN.md spec-szakaszai,
  `OPEN-QUESTIONS.md` → DECISIONS.md teteje, "moves the earlier entry to the archive" sorok ki.
- A `reviewing-changes-trigger` és `review-spec-axis` kritériumában a "verify pass" sor marad.
- `plugins/core/evals/README.md`: a tábla sorai a törölt esetek nélkül, a `designing-architecture`
  sor az új claimmel; a "removes the four hooks" bekezdés "the plugin ships no hook"-ra (előre,
  mert a 5. fázis törli őket; itt még igaz: "the hooks still shipped at this commit are
  irrelevant to every case").

### 2.13 Definition of Done

- `node scripts/validate.mjs` zöld (a `references` check minden hivatkozást felold).
- `git grep -n -e project-facts -e run-gates -e "planning/archive" -e "60 entries" -e MASTER-PLAN -e handoff-format -e plan-format -- plugins/core/skills/clarifying-features plugins/core/skills/designing-architecture plugins/core/skills/planning-features plugins/core/skills/executing-plans plugins/core/skills/reviewing-changes plugins/core/skills/finishing-features plugins/core/agents` → 0 találat.
- `references/lenses.md`, `menu.md`, `handoff-format.md`, `plan-format.md`, `batch.md`,
  `alternatives.md`, `survey.md` nem léteznek; `clarifying-features/`, `designing-architecture/`
  és `codebase-design.md` léteznek.
- Minden érintett body a 2.3–2.11 sorplafonja alatt (`wc -l`, vagy a Read utolsó sorszáma).
- `component-reviewer` lefuttatva a fázis diffjén (`git diff min-1`), a leletek rendezve vagy
  a `temp/plan-baseline.md`-be jegyezve okkal.
- `claude plugin validate plugins/core --strict` zöld.
- `git tag min-2`.

## 3. fázis — A többi fogyasztó (testing, verifying, preparing, describing, syncing, bugs, packok)

Csak próza és eval.

### 3.1 Fájlonként

| Fájl | Változás |
| --- | --- |
| `testing-changes/SKILL.md` (≤ 130) | `allowed-tools`-ból a `project-facts` grant ki. `plan` 1. lépés: SPEC helyett `temp/<feature>/PLAN.md` `Success criteria`; `requirements/`; a felhasználó által megnevezett story; PLAN `Tasks` + diff. `run` 2. lépés: Storybook = `package.json` `scripts.storybook` léte (Read). Lifecycle: három STATUS-írás helyett egy: Stage + egy Log-sor minden ponton (három sor összesen). 8. lépés (batch investigation) ki: "Findings are the user's to rule on; `investigating-bugs` diagnoses one when asked." |
| `testing-changes/references/design-intent.md` (≤ 80) | A `designReference` bekezdés ki ("Never require a project-local design skill" marad egy mondatban); a toolkey-megfigyelések ≤ 6 sorra. |
| `testing-changes/references/storybook-check.md` | `project-facts` → "package.json's `storybook` script". |
| `testing-changes/references/qa-test-list.md` | Az `artifacts.md` authority-order hivatkozás a `question-rounds.md`-re. |
| `verifying-ui/SKILL.md` (≤ 160) | Az `!project-facts` injektálás és a `browserTools` bekezdés ki; `allowed-tools`-ból a grant ki, `Read` marad. 2. lépés: "`package.json`'s `dev` (or `serve`, `start`) script, run as `<pm> run <script>`; in a monorepo the workspace's" — a `declaredPort` mondat helyett "the script may name a port; the URL is the one the server printed". |
| `verifying-ui/references/browser-tools.md` (≤ 150) | A `project-facts`/`browserTools`/`toolPrefix` bekezdések ki; a "This repo already pins the Claude CLI in CI" mondat → "pin for the same reason CI pins its CLI"; a `block-secrets` hivatkozás → "no deny rule covers an MCP upload tool, so the tool is removed". |
| `preparing-a-repo/SKILL.md` (≤ 150) | `allowed-tools`: a két grant ki, `Bash(cat *) Bash(ls *) Bash(grep *) Read Grep Glob`. 2. lépés: `cat package.json` és a `project.md` négy szabálya; 3. lépés: a `scripts` blokk gate-jei (`--list` ki); 4. lépés: a `browserTools` bekezdés helyett egy kérdés; **új 6b. lépés "Settings the devkit recommends"**: a 5.1 snippet szó szerint, és egy mondat: "The devkit ships no hook: without these rules nothing stops a credential read or a push." |
| `describing-changes/SKILL.md` (≤ 130) | Az `!project-facts` injektálás ki; `allowed-tools`: a két grant ki, + `Bash(git remote *) Bash(npm run *) Bash(pnpm run *) Bash(yarn run *) Bash(bun run *)`. 1. lépés: commitlint config Glob-bal (`commitlint.config.*`, `.commitlintrc*`, `package.json` `commitlint` kulcs) — megléte a konvenció, "enforced" szó nélkül; a host `git remote -v`-ből; sablonok Glob-bal (`.gitlab/merge_request_templates/*.md`, `.github/PULL_REQUEST_TEMPLATE*`, `.github/pull_request_template.md`); base a `project.md` szerint. 4. lépés: a hívó gate-eredménye, különben a `project.md` szerint futtatva. 5. lépés: a `glab mr create`/`gh pr create` ajánlat ki; a szöveg copyable blokkban. |
| `syncing-branches/SKILL.md` (≤ 220) | `allowed-tools`: a két grant ki, `snapshot` marad, + `Bash(npm run *)` stb. 1. lépés: `project.md`. 4. lépés: a snapshot "the review's base" — a "restore's source" mondat ki. A három helyzet: a "Mid-work" bekezdésben az `--autostash` helyett "the plan asks the user to commit the uncommitted work first; with it uncommitted the plan stops". 3. szakasz: `--autostash` ki; 4.8 (autostash conflict) ki. 7. szakasz: "Restoring the backup" = új backup ref a synced tipnél + `git reset --hard <backup ref>`; a 4. lépés (uncommitted munka visszaállítása) ki. |
| `syncing-branches/references/conflicts.md` (≤ 160) | "The autostash" szakasz ki; "Restoring the backup" 2. és 4. pontja ki; `project-facts` → `project.md`. |
| `investigating-bugs/SKILL.md` (≤ 140) | A "Batch mode" szakasz és `references/batch.md` ki; a "Choosing the next step" marad. |
| `fixing-bugs/SKILL.md` (≤ 170) | `allowed-tools`: a két grant ki, `snapshot` marad, + `Bash(npx vitest run *) Bash(pnpm exec vitest run *) Bash(yarn vitest run *) Bash(bunx vitest run *) Bash(npx jest *) Bash(pnpm exec jest *) Bash(yarn jest *) Bash(bunx jest *)` és a `<pm> run` grantok. 1. lépés: `project.md`. "A list of findings" bekezdés ki. 3. szakasz (hipotézis-loop) ki: diagnózis nélkül "ask for one: call the Skill tool with core:investigating-bugs, then return". 4.4 (cleanup tagek) ki. 5.4: a CONTRACT-GAPS.md egy `CG<n>` sora marad, az "across the live file and its archive" mellékmondat ki. 7. szakasz ki. 8.2: egy STATUS Log-sor. |
| `fixing-bugs/references/loop.md` (≤ 120) | "Instrumentation tags" ki; "The triage threshold" ki; FIX.md alakból a `Hypotheses` és `Tag` sorok ki; `project-facts` → `project.md`. |
| `optimizing-prompts/` | `git rm -r plugins/core/skills/optimizing-prompts`; evalok: `optimizing-prompts`, `anchoring-a-rewrite` törlés. |
| `vue-engineering/SKILL.md`, `nuxt-engineering/SKILL.md` | A `node -p` blokk helyett: "Read the workspace's `package.json` (`dependencies` and `devDependencies`) with the Read tool and note the majors of …". "Before reporting done": a `run-gates.mjs` bekezdés helyett "Run the project's own gates as `core`'s `project.md` describes; a gate you did not run is NOT RUN." A `typecheckVacuous` flag mondata ki (a Nuxt solution-tsconfig tanács marad). "Invent a gate command" pont: "Read `package.json`'s scripts instead." |
| `nuxt-engineering/references/versions.md`, `nuxt-review-checklist.md`, `vue-engineering/references/versions.md` | `run-gates`/`typecheckVacuous`/`typescriptTooNewForVueTsc` említések ki (grep). |
| `plugins/core/README.md`, `plugins/vue/README.md`, `plugins/nuxt/README.md` | A skill-táblák a 13 skillre (a `designing-architecture` sora az új szerepével); a Hooks szakasz és a Scripts hivatkozás ki (a 5. fázis zárja). |
| Evalok | `describing-changes`, `qa-list-without-a-spec`, `verifying-ui` kritériumából a `project-facts`/`snapshot` említés ki (a snapshot a verifying-ui-ban nem szerepelhet). `fixing-bugs` eval: a kritérium "red before, green after, red reverted, green restored, one file" marad; egy "hypotheses" vagy "tag" sor, ha van, ki. |

### 3.2 Definition of Done

- `git grep -n -e project-facts -e run-gates -e typecheckVacuous -e typescriptTooNewForVueTsc -e browserTools -e declaredPort -e designReference -e userStoryPath -- plugins .claude ':!plugins/core/scripts' ':!plugins/core/hooks' ':!docs/plans'` → 0 találat.
- `node scripts/validate.mjs` zöld; `claude plugin validate plugins/{core,vue,nuxt} --strict` zöld.
- `component-reviewer` a fázis diffjén (`git diff min-2`); a vue/nuxt delta-szerződés (2. pont) rendben.
- `git tag min-3`.

## 4. fázis — A két script és a két hook törlése; a snapshot szűkítése

### 4.1 Törlés

```
git rm plugins/core/scripts/run-gates.mjs plugins/core/scripts/project-facts.mjs
git rm plugins/core/scripts/verify-before-done.mjs plugins/core/scripts/format-on-write.mjs
git rm scripts/test/run-gates.test.mjs scripts/test/project-facts.test.mjs
git rm scripts/test/verify-before-done.test.mjs scripts/test/format-on-write.test.mjs
```

`plugins/core/hooks/hooks.json`: a `PostToolUse` és `Stop` blokk ki; a két `PreToolUse`
bejegyzés marad (a 5. fázisig). A `description` mező: "Two PreToolUse guards remain until the
native permission settings replace them; see docs/installation.md."

### 4.2 `plugins/core/scripts/snapshot.mjs` (~230 sor)

- `lib/credential-paths.mjs` tartalma beolvad: `normalizePath`, `isCredentialPath` és a három
  konstans a fájl tetejére, ~30 sor; `git rm plugins/core/scripts/lib/credential-paths.mjs`
  és a `lib/` könyvtár (a `shell-parse.mjs` a 5. fázisban megy; addig a `lib/` marad). **Ha a
  `lib/` a 5. fázisig nem üríthető, a beolvasztás a 5. fázisban történik**; a döntés itt: a
  beolvasztás a 5. fázisban, hogy a `lib/` egyszer tűnjön el.
- `--feature` opció és a `temp/<slug>/tasks` default ki; a default `temp/snapshots/<name>.diff`.
- `writeDiff`: `openSync(file, 'wx')`; az `EEXIST` hibát egy mondattal jelenti ("`--out` names
  an existing file; choose a new path") és exit 1.
- Fejléc-komment (≤ 15 sor): "A review base, not a backup: the tree is reachable from no ref,
  so `git gc` can prune it; it leaves out credential paths, `temp/`, ignored files and
  submodule work trees; staged and unstaged versions of one file are not told apart. Recovery
  of committed work is a backup ref's job; uncommitted work is the user's to commit."
- `scripts/test/snapshot.test.mjs`: +2 eset (`--out` létező fájlra exit 1 és a tartalom
  változatlan; ugyanez alkönyvtári cwd-ből relatív `--out`-tal).

### 4.3 Próza

- `docs/scripts.md` → egyetlen szakasz, "`snapshot.mjs`" (≤ 40 sor): `take`, `diff <base>
  --out`, mit zár ki, mit nem ígér. A `project-facts`, `run-gates`, `env-names`, "Per-project
  override" szakaszok ki. A `.claude/project.json` sehol nem említődik többé.
- `docs/hooks.md`: a `format-on-write` és `verify-before-done` szakaszok és tábla-sorok ki (a
  teljes törlés a 5. fázisban).
- `docs/architecture.md` "Facts are read at the moment of use": "by the skill that needs them,
  with the four rules in `project.md`" — a script-említés ki.
- `README.md:26-29`: a Stop hook és a formázó mondatai ki.
- `docs/adr/0003-facts-read-at-moment-of-use.md`: Amended sor: "the reader is the skill, not a
  script; the rules are in planning-features/references/project.md".
- `CLAUDE.md` Invariants: a "Packs are framework-level" bekezdés `project-facts.mjs` mondata →
  "read at the moment of use by the skill, with the rules in `project.md`".

### 4.4 Definition of Done

- `git grep -n -e run-gates -e project-facts -e verify-before-done -e format-on-write -e verifyOnStop -e "project.json" -- ':!CHANGELOG.md' ':!docs/plans'` → 0 találat.
- `hooks.json` két `PreToolUse` bejegyzést tartalmaz, semmi mást.
- `node --test "scripts/test/*.test.mjs"` zöld; a suite futásideje mérve (`temp/plan-baseline.md`).
- `git tag min-4`.

## 5. fázis — A védelem natív; a két őr és a hook-réteg megszűnik

### 5.1 A consumer-snippet (`docs/installation.md`, új szakasz "Permissions and attribution", az "Add the marketplace" után)

```json
{
  "attribution": { "commit": "", "pr": "", "sessionUrl": false },
  "permissions": {
    "deny": [
      "Read(.env)", "Read(.env.*)", "Read(!.env.example)",
      "Read(~/.ssh/**)", "Read(~/.aws/**)", "Read(~/.gnupg/**)",
      "Edit(package-lock.json)", "Edit(pnpm-lock.yaml)", "Edit(yarn.lock)", "Edit(bun.lock)", "Edit(bun.lockb)",
      "Edit(.git/**)",
      "Bash(git push:*)", "Bash(git pull:*)", "Bash(git merge:*)", "Bash(git commit-tree:*)",
      "Bash(gh pr merge:*)", "Bash(glab mr merge:*)",
      "PowerShell(git push:*)", "PowerShell(git pull:*)", "PowerShell(git merge:*)", "PowerShell(git commit-tree:*)",
      "PowerShell(gh pr merge:*)", "PowerShell(glab mr merge:*)"
    ]
  }
}
```

A szakasz szövege (≤ 50 sor), pontosan ezekkel az állításokkal, mindegyik "docs, read
2026-10-12" vagy "observed on 2.1.x" jelöléssel:

- A plugin nem tud permission-szabályt telepíteni (plugin-settingsből csak `agent` és
  `subagentStatusLine` érvényesül). A devkit **nem szállít hookot**: e szakasz nélkül semmi
  nem állít meg egy credential-olvasást vagy egy pusht.
- A `Read` deny a fájleszközökre, a Grep/Glob-ra, az `@file`-ra, és a Bash felismert
  fájlparancsaira (`cat`, `head`, `tail`, `sed`, `tee`) és redirect-céljaira is érvényes. Nem
  érvényes a fájlt nem megnevező parancsra (`grep -r KEY .`) és a fájlt maga megnyitó
  scriptre; ezekre a sandbox (macOS/Linux/WSL2) és az OS.
- `Edit(...)` fedi a `Write`-ot is; `Write(...)` szabályt a CLI nem olvas.
- `attribution: false` a 2.1.281-nél újabb CLI-n ugyanezt egy értékkel adja.
- A `git -C . push` alakot a deny nem fogja; a devkit skilljei nem írnak ilyet.
- Feltöltés (`curl -d @.env`), környezet-dump (`printenv`) és letöltés shellbe (`curl | sh`)
  ellen nincs natív szabály; a sandbox a hálózatot fedi, natív Windowson semmi.
- A PowerShell `Get-Content`/`gc`/`type` lefedése a `Read` deny által: az 5.4 mátrix
  eredménye szerint "observed" vagy "not covered".

### 5.2 Törlés

```
git rm plugins/core/scripts/block-secrets.mjs plugins/core/scripts/commit-hygiene.mjs
git rm plugins/core/scripts/lib/shell-parse.mjs plugins/core/scripts/lib/credential-paths.mjs
git rm plugins/core/scripts/env-names.mjs plugins/core/scripts/run.mjs
git rm -r plugins/core/hooks
git rm scripts/test/block-secrets.test.mjs scripts/test/commit-hygiene.test.mjs
git rm scripts/test/shell-parse.test.mjs scripts/test/env-names.test.mjs scripts/test/run.test.mjs
git rm docs/hooks.md
```

A 4.2 beolvasztás itt: `credential-paths.mjs` tartalma a `snapshot.mjs`-be, a `lib/` könyvtár
megszűnik. `scripts/test/validate.test.mjs`: a `hooks.json`-létezés esete (1.6) ki; a `scripts`
check hook-ága (`validate.mjs:388-420` környéke) ki — a check a `${CLAUDE_PLUGIN_ROOT}/scripts/`
prózahivatkozások feloldását és a `node --check`-et tartja.

### 5.3 Próza

- `plugins/core/skills/preparing-a-repo/SKILL.md` 6b (a 3. fázisban már létrehozva): a snippet
  szó szerint egyezzen az `installation.md`-vel — a `validate.mjs` nem ellenőrzi; a
  `component-reviewer` 7. pontja (6. fázis) igen.
- `.claude/settings.json`: a `deny` lista + `Edit(.git/**)`; nincs hook (6. fázis).
- `docs/architecture.md` "Where a guardrail is enforced": a hook-pont ki; "4. The user's
  permission and attribution settings, which installation.md recommends".
- `docs/contributing/authoring.md` "Tool grants" (57–64): a `commit-hygiene.mjs`-re épülő
  mondatok helyett egy mondat a settingsre.
- `docs/adr/0001-node-hooks-with-version-gate.md`: Status "Superseded by ADR 0013". A szöveg
  marad történetnek.
- `docs/adr/0006-guardrails-enforced-where-stated.md`: Amended; a Decision 4. pontja (hook) ki,
  helyette a settings.
- Új `docs/adr/0013-no-hooks-no-facts-service-artifacts-without-a-protocol.md`: Context (a két
  őr 3 112 sora és +2 163 sor négy nap alatt; a plugin nem szállíthat deny-t; a `Read`/`Edit`
  deny a shell-fájlparancsokat is fedi; a facts/runner heurisztikái hamis zöldet adtak; a
  hatfájlos állapotgép 348 soros szerződés archívum-protokollal); Decision (nincs hook; a tények
  a skillé; PLAN/STATUS/DECISIONS/CONTRACT-GAPS mozgatás és alak-katalógus nélkül; egy reviewer
  + verify); Consequences (a snippet nélkül nincs védelem; feltöltés/env-dump/download-to-shell
  nem fedett; régi feature-t kézzel kell átvinni; a review olcsóbb és kevesebbet lát).
- `docs/adr/README.md`: 0013 sor; 0001, 0009 státusza.
- `.claude-plugin/marketplace.json` core leírása: "four deterministic hooks" ki;
  `plugins/core/.claude-plugin/plugin.json` leírása: "deterministic hooks" ki;
  `plugins/core/README.md`: a Hooks szakasz ki, egy mondat a settingsre; `README.md:26-29,85,100`:
  a hook-sorok ki, a Hooks doc-link ki, "You push and merge; your permission settings deny
  Claude the push (see Installation)".
- `plugins/core/evals/README.md`: "the plugin ships no hook"; a `--bare` bekezdésből a "turns
  the core hooks off" mellékmondat ki.
- `CLAUDE.md`: a "Hooks are Node, never bash" invariáns helyett az audit 7. fejezetének 1.
  invariánsa ("A devkit nem szállít hookot…", angolul).
- `CHANGELOG.md`: még nem (a `/release` írja); a commit-üzenet nevezze meg a négy megszűnő hookot
  és a snippetet.

### 5.4 VERIFY FIRST — a release előfeltétele (quota; a felhasználó jóváhagyásával)

A fázis commitja megtörténhet a session előtt (a `dev`-et senki nem telepíti), de a 9. fejezet
szerint **nincs release, amíg ez a mátrix nincs megfigyelve** és az eredmény verzióval az
`installation.md` szakasz végén nincs. Egy eldobható repó, a snippet a user settingsben,
`.env` és `.env.example` fájlokkal, egy `package-lock.json`-nal:

| # | Próba | Elvárt |
| --- | --- | --- |
| 1 | `Read .env` | tiltva |
| 2 | `Read .env.example` | engedve (carve-out) |
| 3 | `Grep` glob `.env*`, `@.env` a promptban | tiltva |
| 4 | Bash `cat .env`, `head -1 .env`, `< .env` | tiltva |
| 5 | Bash `grep KEY .env` | eredmény rögzítve (a docs szerint felismert parancs-e: nem ígért) |
| 6 | PowerShell `Get-Content .env`, `gc .env`, `type .env` | eredmény rögzítve; "not covered" → az `installation.md` kimondja |
| 7 | `Write package-lock.json`, `Edit package-lock.json` | tiltva (az `Edit` szabály fedi a `Write`-ot) |
| 8 | Bash `git push`, `npm test && git push`, PowerShell `git push` | tiltva |
| 9 | Bash `git merge-base HEAD main` | eredmény rögzítve; tiltva → a `git merge:*` sorok ki a snippetből, a merge-tiltás próza |
| 10 | Bash `git pull --rebase` | tiltva (a `syncing-branches` `git rebase`-t ír, nem `pull`-t) |
| 11 | `node plugins/core/scripts/snapshot.mjs take` a snippet alatt | fut (az `Edit(.git/**)` nem érinti a git-folyamatot) |
| 12 | egy `git commit` az objektumformájú `attribution`-nel | nincs `Co-Authored-By` trailer |

Az `installation.md` szakasz vége: "Observed on 2.1.x, <date>: rows 1–12 …"; egy "not
observed" sor, ha a session elmarad — és akkor a `/release` a 9. fejezet szerint megáll.

### 5.5 Definition of Done

- `plugins/core/hooks/` nem létezik; `plugins/core/scripts/` egyetlen fájl: `snapshot.mjs`.
- `git grep -n -e block-secrets -e commit-hygiene -e shell-parse -e env-names -e "run.mjs" -e credential-paths -e "hooks.json" -e "docs/hooks.md" -- ':!CHANGELOG.md' ':!docs/plans'` → 0 találat.
- `claude plugin validate plugins/core --strict` zöld hook nélkül.
- `node --test "scripts/test/*.test.mjs"` zöld, futásidő mérve.
- Az `installation.md` szakasz a 12 sor eredményével vagy "not observed" jelöléssel.
- `git tag min-5`.

## 6. fázis — A repo saját hookjai, konfigja, `pack-graph`, repo-local komponensek

### 6.1 Törlés és settings

```
git rm -r scripts/hooks scripts/test/repo-hooks.test.mjs
git rm scripts/pack-graph.mjs scripts/test/pack-graph.test.mjs
git rm devkit.config.json .mcp.json
git rm -r .claude/skills/eval-case .claude/skills/new-pack .claude/skills/pack-parity .claude/skills/body-vs-reference-audit
git rm .claude/agents/trigger-tester.md .claude/agents/contract-auditor.md
```

`.claude/settings.json`: a `hooks` blokk és a `$hooks_comment` ki; az `allow` listából a
`claude plugin validate`, `node scripts/validate.mjs`, `node --test` és a git-sorok maradnak.

### 6.2 `scripts/validate.mjs` (~480)

- A `pack-graph.mjs` import ki; a `packs()` manifest-követése (a marketplace `plugins[].source`
  → `plugin.json` olvasás, ~25 sor) a fájlba; a `families()` nem kell.
- `BUDGET_CEILING = 6500` konstans a fájl tetején, kommenttel: "repo policy, see ADR 0007; the
  only machine check on the always-on tier; query it with `--checks=budget`". A
  `devkit.config.json` olvasása ki.
- `skill-dirs` + `plugin-root` → egy `structure` check. A `CHECKS` térkép 7 kulcs:
  `frontmatter`, `structure`, `budget`, `references`, `scripts`, `versions`, `changelog`.
- `scripts/ci/release-notes.mjs`: `import { runAsEntry }` helyett `if (import.meta.main) cli();`.
- `scripts/test/validate.test.mjs`: a `pack-graph.test.mjs` "marketplace it cannot follow"
  esetei ide; a `skill-dirs`/`plugin-root` esetek `structure` néven; `release-notes.test.mjs`:
  a `pack-graph` másolás ki.

### 6.3 Próza

- `.claude/agents/component-reviewer.md` (≤ 80): 7. pont "Prose contracts": a PLAN/STATUS
  szakasznevek, a dispatch-mezők (`Role:`, `Diff file:`, `Intent sources:`, `Packs:`, `Gates:`,
  `Released:`), a report-mezők írója és olvasói egyeznek; az `installation.md` és a
  `preparing-a-repo` snippetje azonos. A `validate.mjs` futtatás mondatából a "blocked MCP
  names" ki.
- `docs/contributing/authoring.md`: három új szakasz, ≤ 25 sor egyenként: "Adding a pack" (a
  `new-pack` táblája a `project-facts` és `pack-graph` sorai nélkül; a packokat a `project.md`
  2. szabálya ismeri fel — egy új pack ott egy sor); "Body versus reference" (a mai skill
  "What must stay in the body" és "What is a candidate to move" listája); "The delta contract"
  (a `pack-parity` négy drift-fajtája és a "read the two checklists as a pair" módszer).
  "Descriptions" szakasz + 8 sor: a `trigger-tester` négy sávja (must/should/must-not/boundary)
  mint a szerző saját ellenőrzése; a mérés a natív eval `tool_used` gradere.
- `plugins/core/evals/README.md` "Writing a case": az `eval-case` négy kérdése (claim, capability
  or efficiency, expected baseline, where it lives) és "scaffold with `claude plugin eval init
  --bare <name>`".
- `CLAUDE.md`: Gates blokk két parancs (`validate.mjs`, `node --test`); a `pack-graph` sorok ki;
  a "A specialised pack is a delta" invariánsban "`node scripts/pack-graph.mjs` reports the
  current shape" → "the manifests' `dependencies` are the shape; read them"; a "Values the
  tooling reads live in `devkit.config.json`" invariáns → "A value the tooling reads lives in
  the script that reads it, and the documentation says how to query it, never the number
  (ADR 0012)"; a Stop-hook bekezdés ki; a Repo-local tooling tábla 5 sorra (`/release`,
  `/cli-upgrade-check`, `/diagnosing-sessions`, `component-reviewer`, `eval-grader`); az audit
  7. fejezetének 2. és 3. invariánsa angolul.
- `CONTRIBUTING.md`: "The repository's hooks" szakasz ki; "Gates" két parancs; "Which tool
  when" tábla 5 sorra; a `pack-graph` bekezdés ki.
- `docs/contributing/validation.md`: 7 check; a `devkit.config.json` tábla ki; "and two
  PostToolUse hooks" ki.
- `docs/adr/0012-tooling-values-in-config-not-prose.md`: Amended: a konfigfájl megszűnt, az
  érték a scriptben, a doc a lekérdezést mondja. `docs/adr/0004`: a `pack-graph` mondat ki.
- `docs/adr/0005-browser-mcp-not-bundled.md`: egy mondat, hogy a repo saját `.mcp.json`-ja is
  megszűnt (user-scope a telepítés).

### 6.4 Definition of Done

- `node scripts/validate.mjs` **7** checket jelent, zöld; `--checks=budget` kiírja a plafont.
- Egy Edit ebben a repóban semmilyen Node-folyamatot nem indít (`settings.json`-ban nincs
  `hooks` kulcs).
- `git grep -n -e pack-graph -e devkit.config -e stopHook -e testWatch -e frontmatter-on-write -e budget-on-write -e on-stop -e trigger-tester -e contract-auditor -e pack-parity -e body-vs-reference -e new-pack -e eval-case -e "\.mcp\.json" -- ':!CHANGELOG.md' ':!docs/plans'` → 0 találat (a `docs/adr/0005` egy történeti említése megengedett, ha "removed" szóval áll).
- `scripts/` tartalma: `validate.mjs`, `ci/release-notes.mjs`, `test/{validate,snapshot,release-notes}.test.mjs`, `test/helpers.mjs`, `test/fixtures/` ha kell.
- `git tag min-6`.

## 7. fázis — Dokumentáció-zárás, mérés, release-előkészítés

### 7.1 Dokumentáció

- `docs/feature-lifecycle.md` → ≤ 100 sor: mit ír a devkit a repóba (`temp/`), a lánc
  (clarifying → planning → executing → reviewing → testing on request → finishing), a
  `designing-architecture` mint belépés egy nehéz döntésre, a négy fájl és az egysoros olvasási
  szabály, a két mód, a
  review (egy reviewer + verify, re-review), a bugok (diagnózis → ruling → fix, revert-proof), a
  sync (backup ref, commit first), a finish (commit, MR text, open items, archive `mv`), a
  resume. A "Reading the artifacts" szakasz ki.
- `docs/adr/0009-feature-lifecycle-as-skill-chain.md`: Amended (a lánc marad; az
  artifact-modell protokoll nélküli, a review egy reviewer + verify; ADR 0013).
- `docs/README.md`: a térkép a törölt oldalak nélkül (`hooks.md`), a `scripts.md` egy sora.
- `README.md`: a packs tábla "lifecycle, bugs, review" (hooks nélkül); a "Working on the devkit"
  lista a maradó eszközökre.
- `docs/installation.md` "Node" szakasz: a `run.mjs` bekezdés helyett egy mondat: "Node 22 or
  newer on `PATH`; the one shipped script, `snapshot.mjs`, needs nothing else."
- `CHANGELOG.md`: nem itt; a `/release` írja: "Removed" (a négy hook, a két script, a három
  skill, a repo-tooling), "Changed" ("protection moved to your permission and attribution
  settings; see Installation — without them the devkit guards nothing"; "a feature's state is
  PLAN.md and STATUS.md; carry an older feature over by hand as artifacts.md says"; "review is
  one reviewer and a verify pass").

### 7.2 Mérés

Az 0. fejezet mérőparancsa újra, a `temp/plan-baseline.md` "Cél" oszlopa mellé; a tesztsuite
ideje; `node scripts/validate.mjs` ideje. Az audit 5. fejezetének minden sora kitöltve.

### 7.3 Definition of Done

- A 10. fejezet parancsai zöldek.
- `git grep -n -e "2\.1\.[0-9]\{3\}" -- plugins docs/*.md README.md CONTRIBUTING.md CLAUDE.md ':!docs/plans'` minden találata egy megfigyelt viselkedés mellett áll (nem törölt mechanizmus leírásában); a CHANGELOG és az ADR-ek történeti említése nem számít.
- `component-reviewer` a `git diff min-0` teljes diffjén lefuttatva; a leletek rendezve.
- `git tag min-7`.

## 8. Regressziós kockázatok és triggerek

Egy trigger **vizsgálatot** indít (`/diagnosing-sessions`, vagy egy eval futtatása a
felhasználó jóváhagyásával), nem automatikus visszaépítést. A 9. fejezet tilalmai a trigger
után is állnak; egy visszaépítés a felhasználó külön döntése.

| Kockázat | Mi mutatja | Ellenőrzés | Trigger |
| --- | --- | --- | --- |
| A snippet nélkül telepítő fogyasztó védelem nélkül marad | Jelentett credential-olvasás vagy push | `installation.md` és `preparing-a-repo` | Bejelentett eset → a `preparing-a-repo` 6b lépése kötelező gap-reportból "first thing"-gé; nem hook |
| A PowerShell `Get-Content .env` natívan nem fedett | 5.4 6. sor | Egy session | "Not covered" → `installation.md` kimondja; WSL2 ajánlása Windowson |
| `Bash(git merge:*)` tiltja a `merge-base`-t | 5.4 9. sor | Egy parancs | A merge-sorok ki a snippetből |
| A skill rosszul olvassa a package managert vagy a packot | Implementer-dispatch rossz packkal; rossz `<pm> run` | `component-reviewer`; 10 implementer-dispatch átnézése | A `project.md` egy sorának javítása; nem script |
| Egy gate NOT RUN helyett pass-ként jelenik meg | Záró üzenet pass futtatás nélkül | 20 session átnézése (`/diagnosing-sessions`) | > 2 eset a 20-ból → vizsgálat; a `project.md` Gates-bekezdés szigorítása; **nem** runner, nem Stop hook |
| A STATUS Log vagy a DECISIONS túl hosszú egy nagy feature-nél | STATUS Log > 150 sor; egy lépés az egész DECISIONS-t olvassa | 3 feature átnézése | A `resume` a Log utolsó 30 sorát olvassa; a DECISIONS id szerinti olvasási szabálya egy mondattal szigorítva; nem archívum-protokoll, nem mozgatás |
| Egy reviewer kevesebbet talál, mint a lencsék | A `reviewing-changes-trigger` eval két futása refutált finding nélkül, vagy a felhasználó több missed defectet jelent | Eval (jóváhagyással) | Vizsgálat; a `two-axis` szerep szövegének bővítése; nem fan-out |
| Formázatlan kód a review-diffben | Lint-FAIL vagy reviewer-finding | 10 dispatch | Az implementer 7. lépésének szigorítása; nem hook |
| A snapshot "backup"-ként használva | Egy skill prózája | `component-reviewer` 7. pont | Szövegjavítás |
| Rögzített CLI mellett upstream változás | Piros `canary.yml` futás | Heti | `/cli-upgrade-check` |
| Régi feature-t senki nem visz át kézzel | `resume` hibát jelent a hat fájlon | — | Az `artifacts.md` egy mondata elég; nem konverter |
| Valaki visszaépíti a törölt réteget | Új `hooks/`, `lib/`, facts/gates script, lencse, ledger-alak | `component-reviewer`; a `CLAUDE.md` invariánsai | PR-elutasítás |

## 9. Végső architektúra, anti-komplexitás korlátok, release-feltétel

Lásd az audit 4. és 7. fejezetét. Ami ezután **nem** kerülhet be:

- hook bármilyen eseményre; automatikus projektkód-futtatás turn végén vagy írás után;
- facts-service, gate-runner, override-séma, `.claude/project.json`;
- saját shell-parser, CLI-driver, scenario-DSL, fake CLI;
- ötödik planning-fájl, ledger-alak-katalógus, archívum- vagy mozgatási protokoll, formátum-
  kompatibilitási réteg;
- reviewer-lencsék, fix modell a dispatchben, kötelező sokágensű review;
- `package.json`, lockfile, npm-függőség; saját Markdown-link-ellenőrző; konfigfájl egy értékért.

Új script, hook, skill vagy agent befogadásának feltétele (a `CLAUDE.md`-ben, ADR 0013-ra
hivatkozva): melyik bejelentett hibát előzi meg; miért nem natív beállítás; miért nem elég egy
mondat egy meglévő skillben; mi a törlési feltétele.

**Release-feltétel.** A `/release` csak akkor futhat, ha (a) a 7. fázis DoD-ja zöld, (b) az
5.4 mátrix megfigyelve és az `installation.md`-ben rögzítve, (c) a 2.12 átírt evaljai
közül legalább a `planning-from-spec`, `executing-pause` és `finishing-features` egy-egy
with-plugin futása zöld (quota, jóváhagyással). Bármelyik hiányzik: a `/release` NOT RUN-ként
nevezi meg, és a felhasználó dönt.

## 10. Ellenőrző parancsok minden fázis végén (shell-semleges)

```
node scripts/validate.mjs
node --test "scripts/test/*.test.mjs"
claude plugin validate . --strict
claude plugin validate plugins/core --strict
claude plugin validate plugins/vue --strict
claude plugin validate plugins/nuxt --strict
node -e "console.log(require('child_process').execSync('git status --porcelain',{encoding:'utf8'})||'clean')"
```

A `git status` a fázis commitja után `clean`-t ír. A `git grep` DoD-parancsok a fázisoknál
vannak; a `':!CHANGELOG.md' ':!docs/plans'` pathspec Bashben és PowerShellben is működik
idézőjelben. Egy fázis commitja csak akkor készül, ha mind zöld; egy piros parancs a fázison
belül javítandó.

## 11. Útvonalak

- Audit (2. kiadás): `docs/plans/2026-10-12-architecture-audit.md`
- Codex-review: `docs/plans/CODEX-REVIEW.md`
- Ez a terv: `docs/plans/2026-10-12-minimal-architecture-plan.md`
