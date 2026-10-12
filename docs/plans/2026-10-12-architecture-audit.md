# frontend-devkit — architektúra-audit, 2. kiadás (a Codex-review után)

Dátum: 2026-10-12. Alap: a `dev` ág `ae673d4` commitja (0.1.2 + két commit), a telepített Claude
Code `2.1.292`, Node `22.23.3`, Windows 10 Pro 19045. Előzmények: a `tmp/` alatti négy audit
(Astra/Fable, `main` és `dev`), az első kiadás (ugyanez a fájl, 2026-10-12 reggel), és a
`docs/plans/CODEX-REVIEW.md` független felülvizsgálata (REJECT, 15 lelet). A végrehajtási terv:
`docs/plans/2026-10-12-minimal-architecture-plan.md`.

Ez a kiadás három, a felhasználó által meghozott döntésre épül:

1. **A védelem teljesen natív.** A plugin nem szállít hookot. A határ a fogyasztó
   `permissions.deny` és `attribution` beállítása, a sandbox és az OS.
2. **`run-gates.mjs` és `project-facts.mjs` törlés**, nem szűkítés. A skillek a projekt saját
   scriptjeit futtatják, a tényeket a feladat pillanatában olvassák.
3. **A skill-réteg a körben van.** A prózai állapotgép (hat planning-fájl, ledger, archívum,
   review-fan-out) ugyanazon a szükségességi vizsgálaton megy át, mint a scriptek.

És négy pontosítás a felhasználótól a második körben, amelyeket ez a kiadás tart:

- **A skillek nem törlődnek**, az `optimizing-prompts` kivételével. `clarifying-features` külön
  marad (az összevont body átlépte volna a ~200 soros body-invariánst, ami a repo saját szabálya;
  ez az érv, nem az, hogy más pluginok is így csinálják). `designing-architecture` marad, és
  "senior architect" szerepet kap: nehéz döntés bármiről — architektúra, technika, megközelítés —,
  code-design javaslat, és a felhasználó saját tervének kritikus értékelése.
- **`DECISIONS.md` és `CONTRACT-GAPS.md` külön fájl marad**, mert egy feature 60+ döntést és
  sok contract gapet hord; egy PLAN.md-be olvasztva a resume minden alkalommal mindent
  beolvasna. Ami megy: az archívum-protokoll és a mozgatás — egy felülírt döntés helyben kap
  `superseded by D<m>` jelölést, az olvasó id szerint greppel.

## 0. Bizonyítéki szintek

| Címke | Jelentés |
| --- | --- |
| **(E)** | Verified through execution: ebben vagy az előző sessionben lefuttatva |
| **(S)** | Verified through source inspection: a repo fájljaiból, sor szerint |
| **(D)** | Verified through official documentation: `code.claude.com/docs`, 2026-10-12 |
| **(I)** | Reasonable inference |
| **(H)** | Unverified hypothesis |

Ami nincs jelölve, az (S).

## 1. A Codex-review leleteinek egyeztetése

### 1.1 Elfogadva, és javítva ebben a kiadásban

| Lelet | Igazolás | Következmény |
| --- | --- | --- |
| F01 — a consumer-snippet csak `Bash(...)` deny-t ír, a PowerShell eszközt nem fedi | (D) "PowerShell permission rules use the same shape as Bash rules"; a `Bash(git push:*)` nem illeszkedik PowerShell-hívásra | A snippet minden git-sora két alakban: `Bash(...)` és `PowerShell(...)`. A védelmi migráció a **release** előfeltétele, nem a commité; "nem futott" eredménnyel nem jelölhető késznek. |
| F02 — az új `guard.mjs` R4–R7 szabályai parser-utód | (S) heredoc-törlés, szegmentálás, wrapper-levágás nyelvtani döntés | A felhasználó 1. döntése: nincs guard. Lásd 2.1. |
| F03 — `run-gates` heurisztikái hamis zöldet adnak | (S) `fixerIn` csak a script szövegét és egy `run-s` szintet néz, az npm `pre*` lifecycle-t nem; `typecheckVacuous` a `facts.dir` root tsconfigját olvassa, a `cd apps/web &&` parancshoz nem igazodik | 2. döntés: törlés. |
| F04 — `project-facts` következtetéseket szállít | (S) `workspacePackages` a `.`, `packages`, `apps` mappákat járja, a deklarált `workspaces` listát nem; `commitlint.config.js` léte `enforced: true` hook és CI nélkül; az első kiadás "13 `!`-injektálás" állítása hamis: 3 skill injektál `!`-tal, 13 fájl Bash-ből hívja | 2. döntés: törlés. |
| F05 — a snapshot "recovery point" ígérete túl széles | (S) `executing-plans:215` recovery point; `syncing-branches:74` "the restore's source" | A snapshot review-alap. A helyreállítás backup refre épül; uncommitted munkát a sync előtt a felhasználó commitolja. |
| F06 — a `--out` védelem rossz szinten | (S) `path.resolve(top, out)` után `openSync(file, 'w')` | `openSync(file, 'wx')` a feloldott útvonalon; egy teszteset. |
| F07 — a prózai állapotgép kimaradt a vizsgálatból | (S) `artifacts.md` 348 sor, 6 planning-fájl, 25 ledger-entry-alak, 60-bejegyzéses archívumszabály, régi formátum olvasása; `reviewing-changes` 400 sor/15 fájl felett lencsénként egy reviewer, fix `opus` | 3. döntés: a 3. fejezet diszpozíciója. |
| F08 — a repo Stop hookja is törlendő | (S) a `validate.mjs`-t a fázisvégi parancs és a CI is futtatja | Mindhárom repo-hook törlés; nincs `on-stop.test.mjs`. |
| F09 — kihagyott fogyasztók | (S) `validate.test.mjs:292-309`, `pack-graph.test.mjs:90-112`, `parse.test.mjs:43`, `new-pack/SKILL.md:74`, ADR 0010/0011/0012 jelen idejű sorai, `browser-tools.md:56,107`, `.mcp.json` | Fázisonként név szerinti fogyasztólista a tervben. |
| F10 — a reviewer Bash nélkül nem futtathatja a packok `node -p` parancsát | (S) `vue-engineering:39`, `nuxt-engineering:39` | A packok a `package.json`-t `Read`-del olvassák; a dispatch adja a packokat és a gate-eredményt. |
| F11 — `continue-on-error: true` elrejti a canaryt | (D) GitHub Actions: a job hibája nem bukatja a workflow-t | Külön `canary.yml` workflow `schedule` + `workflow_dispatch` triggerrel, `continue-on-error` nélkül: a piros futás látható. Két pin-hely dokumentálva. |
| F12 — a bizalmi határ indoklása hibás | (D) a hook nem megy át tool-permission ellenőrzésen; a modell Bash-hívása igen | Az indoklás javítva (1.4). A Stop- és formázóhook törlése marad. |
| F13 — az eval betölti a tesztelt plugin hookjait | (D) "`claude plugin eval` loads the target plugin's skills, hooks, and agents"; csak a user/projekt szintű hook, settings, más plugin hiányzik | Az első kiadás 75. sora javítva. Tárgytalanná válik: nem marad hook. Az eval nem igazolja a consumer settings-et. |
| F14 — belső ellentmondások | (S) `reviewer.md` 198 soros, a `:557`/`:687-689` hivatkozás hibás; 12 vs 14 kulcs; §7 "Stop hook vissza" vs §9 tilalom; §10 Bash-ciklus PowerShellben; a tiszta munkafa követelése a `docs/plans/` mellett; ≤ 25 verzióemlítés a CHANGELOG-ot is bünteti | Mind javítva a tervben: shell-semleges `node -e` parancsok, forráshelyek szakasznévvel, a `docs/plans/` előbb commit, a §7 trigger vizsgálatot indít és nem visszaépítést, a verziószámláló helyett "aktív utasítás nem hivatkozik törölt mechanizmusra" grep. |
| F15 — `pack-graph` a jövőbeli családokat modellezi | (S) a fájl fejléce React/Next-tel indokol; `packs()` referenciákat és eval-mappákat is bejár | A CLI, a családmodell és a referenciapárosítás törlés; a manifest-olvasás a `validate.mjs`-be költözik, egyetlen fogyasztójához. `/pack-parity` törlés (3.5). |

### 1.2 Amit a Codex nem bizonyított, vagy ahol a docs mást mond

| Állítás | Valóság |
| --- | --- |
| "A natív deny nem fedi a shell-olvasást, ezért a nulla hook a shell-szintű secret-védelem feladása" (az első kiadás és a Codex F02 közös feltevése) | **(D) Pontatlan.** A permissions oldal: "Read and Edit deny rules apply to Claude's built-in file tools, **to file commands Claude Code recognizes in Bash, such as `cat`, `head`, `tail`, `sed`, and `tee`, and to the targets of Bash redirections** such as `> file` and `< file`." Nem fedi: a fájlt nem megnevező parancs (`grep -r pattern .`), és a fájlt maga megnyitó alfolyamat (Node/Python script). A sandbox fedi az OS-szinten. Tehát a natív `Read(.env)` deny a `cat .env`, `head .env`, `< .env` alakokat is tiltja; a PowerShell `Get-Content .env` lefedése nem dokumentált — VERIFY FIRST. |
| Két teszt hibás volt a Codex sandboxában | A Codex maga zárta le sandbox-műterméknek (2/2 pass sandboxon kívül). Nem termékhiba. |
| "`Write(path)` deny szükséges a lockfile-okra" (implicit) | **(D)** "Claude Code checks file permissions against `Edit(path)` and `Read(path)` rules only. If you write a path rule for `Write` ... Claude Code accepts the rule but never consults it." Tehát `Edit(package-lock.json)` fedi a `Write`-ot is; `Write(...)` sor nem kell. |
| Az attribution szintaxisának ellenőrzése | A Codex nem tudta lekérni; nálunk (D) + bináris string (E). Marad VERIFY FIRST a release előtt. |

### 1.3 Amiben a Codex és az első kiadás egyetért, és ez a kiadás is tartja

Törlés: `run.mjs`, `shell-parse`, `block-secrets`, `commit-hygiene`, `env-names`,
`format-on-write`, `verify-before-done`, `release-check`, `release-warning`, `plugin-validate`,
`try-unreleased`, `windows-check`, `docs-links`, `mcp-names`, a két repo PostToolUse-hook, a
fake CLI, a scenario-DSL. Marad: `snapshot.mjs` (szűkítve), `validate.mjs` (szűkítve; a
frontmatter-check 2.1.292-n megfigyelten szükséges, E), `release-notes.mjs`, a tag = verzió =
CHANGELOG kapu, rögzített CLI a CI-ban, a platform-mátrix, nulla runtime-függőség, nincs
SDK-driver.

### 1.4 A bizalmi határ, helyesen

Három különböző dolog, amit az első kiadás összemosott:

- **OS/sandbox**: macOS/Linux/WSL2-n a Bash, PowerShell és Monitor parancsok és gyermekfolyamataik
  fájl- és hálózati elszigetelése (D). Natív Windowson nincs. Hookok és MCP-szerverek sehol
  sincsenek benne.
- **Tool permission**: minden eszközhívás átmegy rajta; a `Read`/`Edit` deny a felismert
  shell-fájlparancsokra is (D). A modell által kezdeményezett `npm run lint` tehát ellenőrzött
  végrehajtás.
- **Hook-folyamat**: automatikus, permission-ellenőrzés nélkül fut, a sandboxon kívül. Egy hook,
  amely projektkódot futtat (`verify-before-done` → `run-gates` → `npm run lint`), ezért nem
  "ugyanaz, mint a Bash-hívás": engedélyezés nélkül indít alfolyamatot. Nem minden ilyen hook
  P0, de a kockázat valós, és a döntés a törlés.

Következmény a célarchitektúrára: a devkit semmilyen automatikus projektkód-futtatást nem épít
vissza, sem hookban, sem háttérsegédben.

## 2. Három alrendszer, amely eltűnik

### 2.1 Hookok: nulla

A plugin ma négy hookot regisztrál (3 112 sor őr + 197 formázó + 285 Stop + 59 wrapper), a repo
hármat. A célban egyik sem létezik. Ami a helyükre lép:

| Mai hook-viselkedés | Natív pótlás | Szint |
| --- | --- | --- |
| Credential-fájl olvasása fájleszközzel, Grep/Glob-bal, `@file`-lal | `Read(.env)`, `Read(.env.*)`, `Read(!.env.example)`, `Read(~/.ssh/**)`, `Read(~/.aws/**)`, `Read(~/.gnupg/**)` deny | (D) |
| `cat .env`, `head .env`, `< .env`, `tee` Bash-ben | Ugyanaz a `Read` deny, a felismert fájlparancsokra | (D) |
| Lockfile és `.git/` kézi írása | `Edit(package-lock.json)`, `Edit(pnpm-lock.yaml)`, `Edit(yarn.lock)`, `Edit(bun.lock)`, `Edit(bun.lockb)`, `Edit(.git/**)` deny; `Edit` fedi a `Write`-ot | (D) |
| Push, pull, merge, plumbing commit | `Bash(git push:*)`, `Bash(git pull:*)`, `Bash(git merge:*)`, `Bash(git commit-tree:*)`, `Bash(gh pr merge:*)`, `Bash(glab mr merge:*)` + ugyanez `PowerShell(...)` alakban | (D); a `git merge-base` ütközés VERIFY FIRST |
| Trailer a commitban | `attribution: { commit: "", pr: "", sessionUrl: false }` | (D) + bináris (E); VERIFY FIRST |
| Leak-szavak a commitüzenetben | `describing-changes` próza + `commit-message-audience` eval + a felhasználó elfogadása | próza |
| Feltöltés (`curl -d @.env`), env-dump (`printenv`), letöltés shellbe (`curl \| sh`) | **Nincs pótlás.** Dokumentált garanciaveszteség. A `Read` deny a `curl -d @.env` fájlhivatkozást nem fedi (nem felismert fájlparancs), a sandbox a hálózatot fedi macOS/Linuxon. | — |
| PowerShell `Get-Content .env`, `gc`, `type` | Nem dokumentált, hogy a `Read` deny a PowerShell fájlparancsokra kiterjed. VERIFY FIRST; ha nem, dokumentált garanciaveszteség natív Windowson. | (H) |
| Formázás írás után | A projekt saját formattere, explicit lépésben; a fogyasztó saját 12 soros hookja, ha akarja (D, hooks-guide példa) | — |
| Turnvégi gate-futás | Senki automatikusan; a skillek jelentési szerződése (NOT RUN sosem pass) és a CI | — |

A snippet nélkül telepítő fogyasztó **semmilyen** devkit-védelmet nem kap. Ezt a
`docs/installation.md`, a `preparing-a-repo` gap-reportja és a CHANGELOG "Changed" szakasza
kimondja.

### 2.2 Projekt-tények és gate-futtató: a skill olvassa, a skill futtatja

`project-facts.mjs` (640 sor, 14 kulcs) és `run-gates.mjs` (557 sor, stage-modell, override,
hibaszöveg-osztályozás, folyamatfa-kezelés) törlődik. A pótlás egy ≤ 40 soros közös referencia,
`plugins/core/skills/planning-features/references/project.md`, amely kimondja, honnan olvassa egy
skill a négy tényt, amire valóban szüksége van:

| Tény | Honnan | Fogyasztók ma |
| --- | --- | --- |
| Package manager | lockfile neve (`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lock*` → bun, különben npm); `packageManager` mező, ha van | `loop.md`, `conflicts.md`, gate-parancsok |
| Framework-packok | `package.json` `dependencies`+`devDependencies`: `nuxt` → `vue:vue-engineering` majd `nuxt:nuxt-engineering`; különben `vue` → `vue:vue-engineering`; különben nincs. Monorepóban az érintett workspace `package.json`-ja; a workspace-t a feladat nevezi meg | implementer, reviewer-dispatch, 5 skill |
| Gate-ek | `package.json` `scripts`: `typecheck`/`type-check`/`tsc`, `lint`, `test`, `build` — a fast gate a typecheck és a lint. Parancs: `<pm> run <script>`. Eredmény: `pass` (exit 0), `FAIL` (exit ≠ 0, az utolsó ~40 sor idézve), `NOT RUN (<ok>)` — nincs script, nem futott, watch-módú. **NOT RUN sosem pass.** | 18 prózafogyasztó |
| Base branch | `git symbolic-ref refs/remotes/origin/HEAD` → `origin/<base>`; ha nincs, `main`/`master` létezése; különben kérdés | reviewing, finishing, syncing, describing |

Ami megszűnik vele: a `.claude/project.json` override-séma, `stages`, `timeoutMs`,
`userStoryPath`, `designReference`, `browserTools`, `storybook.configPresent`, `declaredPort`,
`typescriptRange`, `workspaceStacks`, `react-spa`/`next`, a watcher/fixer-elutasítás, a
`typecheckVacuous` flag (a Nuxt-tanács prózaként marad a `nuxt-engineering`-ben), a
`killTree`, az output-vágás, a hibaszöveg-adatbázis. A hibás `package.json` kezelése: a skill
nem tud scriptet olvasni → minden gate `NOT RUN (package.json is not valid JSON)`, ami a
szerződés szerint sosem pass.

### 2.3 A feature-lifecycle prózai állapotgépe: négy fájl, nulla protokoll

Ma (S): hat planning-fájl (`SPEC`, `DECISIONS`, `OPEN-QUESTIONS`, `PLAN`, `PROGRESS`, `HANDOFF`)
+ `CONTRACT-GAPS` + `research/` + `archive/` + `tasks/` (brief + report) + `review/` + `qa/`;
25 ledger-entry-alak; a 60 bejegyzés feletti archiválás négy kivételszabállyal; superseded
decision és answered question mozgatása; régi egysoros formátum olvasása; `MASTER-PLAN`-os
régi feature-ök felvétele; held-archive és reopen protokoll; review-chain nyitott-finding
definíció három bekezdésben; `contract-auditor` ágens, amely ezeket a szerződéseket őrzi.

Célban:

```
temp/<feature>/
├── PLAN.md           a spec és a feladatok egy fájlban: Outcome, Sources, Success criteria
│                     (SAID/ASSUMED/EXTRA), Design, Business rules (indokkal), States, Constraints,
│                     Global constraints, Review focus, Architecture fit, Out of scope, Deferred, Tasks
├── DECISIONS.md      Open questions (OQ<n>, owner, blocks, answered: D<n>) fent; Decisions (D<n>,
│                     rejected, source) alatta, append-only; felülírás helyben: "superseded by D<m>"
├── CONTRACT-GAPS.md  csak ha a feature API-t érint: CG<n>, status, blocks
├── STATUS.md         a jelen: Stage + owner, Rules, Mode, Task table, Verified (gate-enként),
│                     Closed findings, Log (szabad soros, dátumozott, append-only), Next action,
│                     Kickoff prompt
├── research/         cited notes (változatlan alak)
├── review/           NN-review.md, NN-re-review.md (változatlan report-alak; nyitott finding =
│                     a legfrissebb reportban szerepel és a STATUS "Closed findings" sora nem zárja)
└── qa/               TEST-LIST.md, REPORT.md (változatlan)
```

Olvasási szabály egy sorban: STATUS és PLAN egészben; DECISIONS és CONTRACT-GAPS id szerint,
greppel; research-note `Answer:` először. Ennyi.

Ami eltűnik: archívum-protokoll (a `finishing` egy `mv temp/<feature> temp/archive/<feature>`,
held-state és reopen nélkül; visszahozás kézzel, egy dokumentált sor), a `superseded`/`answered`
bejegyzések mozgatása, a 60-bejegyzéses ledger-szabály, régi formátumok, ledger alak-katalógus,
`tasks/` report-fájlok (az implementer visszatérő üzenete a report), `HANDOFF.md` és
`PROGRESS.md` mint két fájl (a STATUS egy), `OPEN-QUESTIONS.md` mint külön fájl (a DECISIONS
teteje), a questionnaire-fájlok.

A review-fan-out: egy `two-axis` reviewer + egy `verify` pass, modell nélkül megnevezve (a
session modellje). A `lenses.md`, a large-tier, a gap sweep, a dedupe, a fix `opus` törlődik.
A `verify` pass marad, mert ez az egyetlen mechanizmus, amely a finder állításait cáfolni
próbálja, egy dispatch az ára, és a `reviewing-changes-trigger` eval méri.

## 3. Komponensenkénti diszpozíció

Alapértelmezés a törlés. A "Mi törik nélküle" oszlop üres, ha semmi.

### 3.1 Szállított scriptek (`plugins/core/scripts/`)

| Fájl (sor) | Döntés | Mi törik nélküle; pótlás |
| --- | --- | --- |
| `run.mjs` (59) | DELETE | Semmi. |
| `lib/shell-parse.mjs` (703) | DELETE | Semmi. |
| `block-secrets.mjs` (1 292) | DELETE → natív deny | 2.1 tábla. |
| `commit-hygiene.mjs` (858) | DELETE → natív deny + attribution | 2.1 tábla. |
| `env-names.mjs` (91) | DELETE | Semmi: a tiltóüzenet a `.example` fájlra mutat. |
| `format-on-write.mjs` (197) | DELETE | Az implementer és a dispatch egy mondata: a projekt formattere a módosított fájlokon, a gate-ek előtt. |
| `verify-before-done.mjs` (285) | DELETE | Semmi gépi; a skillek jelentési szerződése. |
| `run-gates.mjs` (557) | DELETE | `project.md` referencia; a skillek a scripteket futtatják. |
| `project-facts.mjs` (640) | DELETE | `project.md` referencia. |
| `lib/credential-paths.mjs` (109) | MERGE → `snapshot.mjs` | Egy fogyasztó marad; ~30 sor olvad be. |
| `snapshot.mjs` (212) | KEEP, szűkítve (~230 a beolvasztással) | `--feature` ki; `openSync(file, 'wx')`; a fejléc kimondja: review-alap, nem backup; credential- és `temp/`-kizárás, submodule- és ignored-korlát felsorolva. |
| `hooks/hooks.json` | DELETE | A `hooks/` könyvtár megszűnik. |

### 3.2 Repo-tooling (`scripts/`), konfiguráció, CI

| Elem | Döntés | Indok |
| --- | --- | --- |
| `validate.mjs` (713) | SIMPLIFY → 7 check (~480): `frontmatter`, `structure` (a mai `skill-dirs` + `plugin-root`), `budget`, `references`, `scripts`, `versions`, `changelog` | `docs-links`, `mcp-names` ki; a `scripts` check hook-ág ki (nincs hook), marad a `${CLAUDE_PLUGIN_ROOT}/scripts/*.mjs` prózahivatkozások feloldása és a `node --check`. A `budget` marad: az always-on tier egyetlen gépi mérése (ADR 0007), a plafon konstans a scriptben. |
| `pack-graph.mjs` (171) | DELETE | `packs()` manifest-olvasása (~25 sor) a `validate.mjs`-be, egyetlen fogyasztójához; a család-CLI, `compareReferences`, `normalise`, `runAsEntry` megy. |
| `hooks/frontmatter-on-write.mjs`, `hooks/budget-on-write.mjs`, `hooks/on-stop.mjs` | DELETE | A fázisvégi parancs és a CI ugyanazt futtatja. |
| `ci/plugin-validate.mjs`, `ci/release-warning.mjs` | DELETE | Shell-lépés exit code-dal; `git diff --quiet <tag> HEAD -- plugins .claude-plugin`. |
| `ci/release-notes.mjs` (50) | KEEP, saját `import.meta.main` | Valódi CI-fogyasztó. |
| `devkit.config.json` | DELETE | Egyetlen érték maradna (`budget.ceiling`); az a `validate.mjs` `BUDGET_CEILING` konstansa, és a doc azt mondja, `node scripts/validate.mjs --checks=budget` nyomtatja. ADR 0012 amend. |
| `.claude/settings.json` | SIMPLIFY | A `hooks` blokk és a `$hooks_comment` ki; a deny-lista marad. |
| `.mcp.json` | DELETE | A repo szerzőjének böngésző-MCP-je user-scope telepítés (a `browser-tools.md` saját ajánlása); projektfájlban `@latest` indítás egy teammate gépén. |
| `.github/workflows/validate.yml` | SIMPLIFY | Rögzített CLI (`@anthropic-ai/claude-code@2.1.292`), shell validate-lépés, nincs release-warning. |
| `.github/workflows/canary.yml` | NEW (≤ 25 sor) | `schedule` heti + `workflow_dispatch`, `@latest` CLI, ugyanaz a validate-lépés, **`continue-on-error` nélkül**: a piros futás a workflow-listában látszik. |
| `.github/workflows/release.yml` | SIMPLIFY | + tag = minden `plugin.json` verzió; + `claude plugin validate --strict` a rögzített CLI-n. |

### 3.3 Tesztek (`scripts/test/`)

| Fájl (sor) | Döntés |
| --- | --- |
| `block-secrets.test` (1 308), `commit-hygiene.test` (1 015), `shell-parse.test` (209), `env-names.test` (139), `run.test` (161), `format-on-write.test` (201), `verify-before-done.test` (413), `run-gates.test` (559), `project-facts.test` (511), `release-check.test` (99), `windows-check-probes.test` (125), `try-unreleased-driver.test` (337), `try-unreleased-scenario.test` (268), `repo-hooks.test` (345), `parse.test` (59), `pack-graph.test` (148), `fixtures/fake-claude.mjs` (97) | DELETE |
| `validate.test` (574) | SIMPLIFY (~300): `docs-links`, `mcp-names`, hook-esetek, a skill-local scripts esetei (292–309) ki; a `pack-graph.test` manifest-követési esetei (`a marketplace pack-graph cannot follow`) ide; ignored plugin-agent mezők be. |
| `snapshot.test` (93) | KEEP +2: `--out` létező fájlra hiba, alkönyvtárból is. |
| `release-notes.test` (72) | KEEP; a `pack-graph.mjs` másolás ki. |
| `helpers.mjs` (124) | SIMPLIFY (~80): a `--check` előlépés ki. |

Cél: 4 tesztfájl, ~550 sor, futásidő ≤ 10 s (becslés; a mai 69 s-ból ~60 s a két őr ~800
folyamatindítása).

### 3.4 Szállított skillek és agentek

| Komponens (body + refs) | Döntés | Mi marad, mi megy |
| --- | --- | --- |
| `clarifying-features` (205 + 300) | SIMPLIFY → body ≤ 170, `sources.md` ≤ 110, `question-rounds.md` ≤ 90 | Marad külön skill: méretosztályozás (bounded/feature), forrás-leltár, kérdéskörök, SAID/ASSUMED/EXTRA, a frontier, a rationale-probe, a cross-check, az exit self-check, a háttér-research dispatch, a `new`/`gap`/`continue`/`research` módok, a bounded route. Megy: a `project-facts` hívások, a `designReference`, a `userStoryPath`, a questionnaire-fájlok, az archívum-mozgatások, a régi formátumú feature felvétele. |
| `designing-architecture` (215 + 286) | SIMPLIFY → body ≤ 180, `codebase-design.md` marad (111), `alternatives.md` és `survey.md` DELETE | "Senior architect": nehéz döntés bármiről (architektúra, könyvtárválasztás, megközelítés), code-design javaslat, és a felhasználó saját tervének kritikus értékelése — ez utóbbi új bemenet. Marad: a kérdés, a bizonyíték (létező mechanizmus keresése, a projekt természete, a history), 2–3 opció költséggel, ajánlás, döntés, rekord (`ARCHITECTURE-<slug>.md`), átadás a `clarifying-features`-nek. Megy: a kérdés nélküli survey-mód, a 3-ágenses párhuzamos alternatíva-draftolás (a "design it twice" a főszálon, a `codebase-design.md` szempontjaival), a `project-facts`. Típusos skill marad. |
| `planning-features` (240 + 600) | RADICALLY SIMPLIFY → body ≤ 180, refs ≤ 260 (`artifacts.md` ≤ 130, `project.md` ≤ 40, `rules-block.md` ≤ 30) | Módok: `plan`, `resume`, `checkpoint`. Megy: `save` (minden lépés azonnal ír), a régi formátum, az archívum, a `handoff-format.md` (a STATUS alak az `artifacts.md`-ben), a `plan-format.md` (a Tasks alak az `artifacts.md`-ben). |
| `executing-plans` (309 + 268) | RADICALLY SIMPLIFY → body ≤ 200, `dispatch.md` ≤ 120 | Marad: pre-flight (feature, STATUS, mód, baseline gate-futás a `project.md` szerint, `snapshot take`), subagent-per-task (brief → implementer → diff → gate → reviewer two-axis → ≤ 3 fix-round → pause), inline, `fix-findings` (a felhasználó dönt findingonként: fix / defer / keep; fix inline vagy implementerrel; re-review). Megy: conflict table, `baseline retaken`, a git history/index task szakasz (egy plan task, amely rebase-t nevez meg, a `syncing-branches`-hez megy), a triage-küszöb, a batch-investigation dispatch, a remit-form, a `tasks/*-report.md` fájlok, a troubleshooting-tábla (három sorra). |
| `reviewing-changes` (223 + 225) | RADICALLY SIMPLIFY → body ≤ 150, `formats.md` ≤ 90 | Marad: base-választás (`project.md`), `snapshot diff`, intent sources (PLAN, DECISIONS), gate egyszer (a skill futtatja a scripteket), egy `two-axis` + egy `verify` dispatch, report-alak, STATUS-írás, `re-review`. Megy: `lenses.md`, tier, gap sweep, dedupe, `model: opus`, a "Conflicts with a decision" külön szakasz (a finding a verdikt mellett `conflicts with D<n>` jelölést kap). |
| `finishing-features` (206 + 157) | RADICALLY SIMPLIFY → body ≤ 110, `menu.md` DELETE | Marad: completeness check (task table, a legfrissebb review nyitott findingjai, QA), "Are we done?" form, commit (`describing-changes`, elfogadott üzenet, whole-file `git add -- <files>`), MR-szöveg (behind-check `git rev-list --count HEAD..origin/<base>`), open items (open questions, nyitott findingok, NOT RUN, backup refek), `mv` az archívumba egy kérdéssel. Megy: held archive, project-docs update, team summary, tidy `temp/`, a menü-visszatérés, a skipped-menu anchor-logika. |
| `testing-changes` (168 + 255) | SIMPLIFY → body ≤ 130 | `project-facts` ki: Storybook = `package.json` `storybook` script léte (Read); user story = a felhasználó nevezi meg vagy `requirements/`. A három lifecycle-írás egy STATUS-sorra. A batch-investigation ajánlat megy; findingra a felhasználó indítja az `investigating-bugs`-t. Refs: `qa-test-list.md` marad, `design-intent.md` ≤ 80 (a `designReference` és a toolkey-megfigyelések rövidítve), `storybook-check.md` marad. |
| `verifying-ui` (196 + 424) | SIMPLIFY → body ≤ 160, `browser-tools.md` ≤ 150 | A `!project-facts` injektálás, a `browserTools` bekezdés, a `declaredPort` ki; a dev-server script a `package.json`-ból (Read). `browser-tools.md`: a `toolPrefix`/`project-facts` bekezdések, a "CI pins" hamis mondat, a `block-secrets` hivatkozás ki; a tool-nevek, grantok, caveats maradnak. `runtime-checks.md` marad. |
| `preparing-a-repo` (196) | SIMPLIFY → ≤ 150 | Facts-lépés helyett `cat package.json`; gate-lista a `scripts` blokkból; a `browserTools` lépés egy kérdésre; **új blokk**: "Settings the devkit recommends" a 2.1 snippettel és a garanciaveszteség egy mondatával. |
| `describing-changes` (166 + 57) | SIMPLIFY → ≤ 130 | Commitlint config Glob-bal (`commitlint.config.*`, `.commitlintrc*`, `package.json` `commitlint` kulcs); sablonok Glob-bal (`.gitlab/merge_request_templates/*.md`, `.github/PULL_REQUEST_TEMPLATE*`); gate-eredmény a hívótól, különben a `project.md` szerint futtatva. A `glab mr create` ajánlat megy. `shaping-commits.md` marad. |
| `syncing-branches` (277 + 284) | SIMPLIFY → body ≤ 220, `conflicts.md` ≤ 160, `stacks.md` marad | Facts ki (`project.md`); uncommitted munkával a terv a felhasználót commitra kéri (`--autostash` ág és az autostash-konfliktus megy); a snapshot csak review-alap; "Restoring the backup" 4. lépése megy. A LOG.md marad. |
| `investigating-bugs` (181 + 35) | SIMPLIFY → ≤ 140, `batch.md` DELETE | A batch-mód megy. A `disallowed-tools` és a 4 lépés marad. |
| `fixing-bugs` (252 + 215) | SIMPLIFY → body ≤ 170, `loop.md` ≤ 120 | Marad: diagnózisból repro-teszt a helyes seamnél, fix, revert-proof (eval-mérte), egyfájlos futtatás, owner report, nincs runner/seam ág, a CONTRACT-GAPS.md egy sora egy feature-ön belül. Megy: a hipotézis-loop, az instrumentation-tagek, a 3 bukott fix eszkaláció, a findinglista-mód. |
| `optimizing-prompts` (202 + 173) | DELETE | A felhasználó szerint keveset használt; általános promptátírás, frontend-többlet nélkül. Személyes skillként élhet tovább. |
| `agents/implementer.md` (142) | SIMPLIFY → ≤ 110 | Facts → `project.md`; gate-futás a scriptekkel; report = a visszatérő üzenet (≤ 20 sor), nincs report-fájl; a 7. lépés indoka: "write with Edit and Write, so the diff is reviewable; a shell write is not formatted". |
| `agents/reviewer.md` (198) | SIMPLIFY → ≤ 130, `tools: Read, Grep, Glob, Skill` | A packokat és a gate-eredményt a dispatch adja; nincs Bash; a `lens` szerep megy; a "rule you hold, not a wall" bekezdés megy. |
| `vue-engineering`, `nuxt-engineering` (+ refs, 953 + 1 046) | KEEP, −~25 sor | A `node -p` parancs helyett "read the workspace's `package.json`"; a "Before reporting done" szakasz a `project.md`-re mutat; a `typecheckVacuous` flag-említés és az "Invent a gate command / `--list`" sor ki; a Nuxt solution-tsconfig tanács prózaként marad. |

Core skillek: 14 → 13. Agentek: 2 → 2.

### 3.5 Repo-local komponensek

| Komponens | Döntés | Indok |
| --- | --- | --- |
| `try-unreleased`, `windows-check` | DELETE | 1.3. |
| `release` | SIMPLIFY | `release-check`, `release-warning`, a két NOT RUN-kérdés ki; kézi release-smoke lista a skill végén. |
| `cli-upgrade-check` | SIMPLIFY → 3 lépés | strict exit a rögzített és a legfrissebb CLI-n; frontmatter-próba scratch fixture-ön; a két pin-hely (`validate.yml`, `release.yml`) emelése. |
| `diagnosing-sessions` | KEEP | A terv 7. fejezetének mérőeszköze; a kritikus úton kívül. |
| `eval-case` + `templates/` | DELETE | `claude plugin eval init --bare` a scaffold (E); a négy kérdés a `plugins/core/evals/README.md` "Writing a case" szakaszába. |
| `new-pack` | DELETE | A "mit kell érinteni" tábla a `docs/contributing/authoring.md` "Adding a pack" szakaszába (≤ 20 sor). |
| `pack-parity` | DELETE | A `pack-graph`-ra épült; a delta-szerződés ellenőrzését a `component-reviewer` 2. pontja végzi; a módszer 4 drift-fajtája az `authoring.md`-be. |
| `body-vs-reference-audit` | DELETE | A `component-reviewer` 3. pontja; a "mi marad a bodyban" lista az `authoring.md`-be. |
| `trigger-tester` | DELETE | Egy leírást bíráló persona véleménye nem triggermérés; a natív `tool_used` grader az. A description-módszertan 8 sora az `authoring.md`-be. |
| `contract-auditor` | MERGE → `component-reviewer` 7. pontja | A családjainak négyötöde megszűnik; ami marad (PLAN/STATUS szakaszok, dispatch-mezők, report-mezők), egy ellenőrzési pont. |
| `component-reviewer` | KEEP (≤ 80) | |
| `eval-grader` | KEEP | Rubrika-dry-run, amit a natív eval nem ad; 83 sor. |

Repo-local skillek: 10 → 3; agentek: 4 → 2.

### 3.6 Evalok

| Eset | Döntés | Ok |
| --- | --- | --- |
| `optimizing-prompts`, `anchoring-a-rewrite`, `finishing-held-archive`, `resume-reopen` | DELETE | A tesztelt komponens vagy protokoll megszűnik. |
| `designing-architecture` | REWRITE | A survey-mód megszűnik; az új eset a felhasználó saját tervének értékelését méri: egy egyfogyasztós absztrakciót javasló terv, amire a skill a létező mechanizmust mutatja, a költséget nevezi, és nem ír kódot. |
| `planning-from-spec`, `planning-default-rules`, `checkpoint-kickoff`, `executing-pause`, `finishing-features` | REWRITE | A fixture-fájlok és a kritériumok a PLAN/STATUS/DECISIONS alakra. |
| `clarifying-conflicting-sources`, `clarifying-frontier`, `clarifying-rule-rationale` | EDIT | Csak az artifact-nevek (`SPEC.md` → `PLAN.md` spec-szakaszai; `OPEN-QUESTIONS.md` → `DECISIONS.md` teteje); az invokáció változatlan. |
| `describing-changes`, `qa-list-without-a-spec`, `verifying-ui` | EDIT | A `project-facts`/`snapshot` említés ki a kritériumokból. |
| A többi 13 core eset, a `vue` 7 és a `nuxt` 4 eset | KEEP | |

Core evalok: 29 → 25.

### 3.7 Dokumentáció és ADR-ek

| Fájl | Döntés |
| --- | --- |
| `docs/hooks.md` (422) | DELETE → `docs/installation.md` "Permissions and attribution" szakasz (≤ 50 sor, a snippet és a garanciaveszteség) |
| `docs/scripts.md` (163) | → `snapshot.mjs` egy szakasz (≤ 40 sor) |
| `docs/feature-lifecycle.md` (200) | REWRITE ≤ 100: a lánc, a `designing-architecture` belépés, a négy fájl és az egysoros olvasási szabály, a két végrehajtási mód, a review (egy reviewer + verify), a bugok, a sync, a finish |
| `docs/architecture.md` | "Facts are read at the moment of use" → a skill olvassa; "Where a guardrail is enforced" → nincs hook-pont |
| `docs/contributing/validation.md`, `authoring.md`, `CONTRIBUTING.md`, `README.md`, `plugins/core/README.md`, `docs/README.md`, `CLAUDE.md` | EDIT a 6. fázis listája szerint |
| ADR 0001 (hookok) | Superseded by 0013 |
| ADR 0003 (facts) | Amended: a tényt a skill olvassa a használat pillanatában, script nélkül |
| ADR 0006 (guardrails where stated) | Amended: a 4. pont (hook) ki |
| ADR 0009 (lifecycle chain) | Amended: a lánc marad, az artifact-modell négy fájl protokoll nélkül, a review egy reviewer + verify |
| ADR 0011 (platform claims) | Amended: rögzített CI + canary |
| ADR 0012 (config not prose) | Amended: az érték a scriptben, a doc a lekérdezést mondja |
| ADR 0013 (új) | "No hooks, no facts service, artifacts without a protocol": context, decision, consequences, a garanciaveszteség |

## 4. A minimális célarchitektúra

```
plugins/core/
  scripts/snapshot.mjs                 review-alap: take / diff; privát index; credential- és temp/-kizárás    [~230]
  skills/  clarifying-features  designing-architecture  planning-features  executing-plans
           reviewing-changes  finishing-features  testing-changes  verifying-ui
           preparing-a-repo  describing-changes  syncing-branches  investigating-bugs  fixing-bugs   [13]
  agents/  implementer  reviewer (Read, Grep, Glob, Skill)                                     [2]
  evals/   25 eset
plugins/vue, plugins/nuxt               változatlan tudás, facts/runner-hivatkozás nélkül

Consumer settings (docs/installation.md; preparing-a-repo ajánlja):
  attribution {commit:"", pr:"", sessionUrl:false}
  permissions.deny: Read(.env) Read(.env.*) Read(!.env.example) Read(~/.ssh/**) Read(~/.aws/**) Read(~/.gnupg/**)
                    Edit(package-lock.json) Edit(pnpm-lock.yaml) Edit(yarn.lock) Edit(bun.lock) Edit(bun.lockb) Edit(.git/**)
                    Bash(git push:*) Bash(git pull:*) Bash(git merge:*) Bash(git commit-tree:*) Bash(gh pr merge:*) Bash(glab mr merge:*)
                    PowerShell(git push:*) … PowerShell(glab mr merge:*)

temp/<feature>/   PLAN.md  STATUS.md  DECISIONS.md  CONTRACT-GAPS.md (ha API-t érint)  research/  review/  qa/

scripts/   validate.mjs (7 check, ~480)   ci/release-notes.mjs (~45)   test/ (4 fájl, ~550)
.claude/   settings.json (deny, allow; nincs hook)   skills/ release, cli-upgrade-check, diagnosing-sessions
           agents/ component-reviewer, eval-grader
CI         validate.yml (rögzített CLI)   canary.yml (heti @latest, látható piros)   release.yml (tag = verzió, --strict)
```

**Felelősségi határok:**

| Felelősség | Tulajdonos |
| --- | --- |
| Credential-fájl olvasása bármely eszközzel vagy felismert shell-parancssal | A fogyasztó `Read` deny-ja; a sandbox; az OS |
| Lockfile, `.git/` kézi írása | A fogyasztó `Edit` deny-ja |
| Push, pull, merge, plumbing commit | A fogyasztó `Bash`/`PowerShell` deny-ja; a skillek prózája |
| Attribution | Natív `attribution` |
| Commitüzenet tartalma | `describing-changes` próza + felhasználói elfogadás + eval |
| Formázás | A projekt formattere, explicit lépés |
| Lint/typecheck/test | A projekt saját scriptjei, a skill futtatja a `project.md` szerint; NOT RUN sosem pass |
| Projekt-tények | A skill olvassa a használat pillanatában a `project.md` négy szabályával |
| Review-baseline piszkos fán | `snapshot.mjs` |
| Feature-állapot sessionök között | `PLAN.md` + `STATUS.md` (+ `DECISIONS.md`, `CONTRACT-GAPS.md` id szerint olvasva) |
| Pluginforma | Natív `--strict` + `validate.mjs` 7 checkje |
| Skill-érték | `plugins/*/evals` |

## 5. Mért és becsült előtte/utána

"Most" mért (E); "Cél" a 3. fejezet tételeiből becsült, ±15 %.

| Mutató | Most (E) | Cél | Mérés |
| --- | --- | --- | --- |
| `.mjs` fájl / sor | 44 / 14 169 | 7 / ~1 300 | `git ls-files '*.mjs'`, `wc -l` |
| Szállított script fájl / sor | 11 / 5 003 | 1 / ~230 | `plugins/core/scripts/` |
| Repo-tooling sor | 1 194 | ~525 (`validate` ~480 + `release-notes` ~45) | `scripts/*.mjs scripts/ci/*.mjs` |
| Skill-lokális script sor | 1 115 | 0 | fájllista |
| Teszt fájl / sor / futásidő | 21 / 6 857 / 68,8 s | 4 / ~550 / ≤ 10 s | `node --test` |
| Szállított próza (plugins, evalok nélkül) | 8 789 sor | ~5 900 (−33 %) | `git ls-files 'plugins/*.md' \| grep -v evals \| xargs wc -l` |
| ebből core skill body+refs | 6 315 | ~3 600 | per skill |
| Core skillek / agentek | 14 / 2 | 13 / 2 | fájllista |
| Repo-local skillek / agentek | 10 / 4 | 3 / 2 | fájllista |
| Szállított hook / repo hook | 4 / 3 | 0 / 0 | `hooks.json`, `settings.json` |
| Node-indítás egy consumer `Bash` hívásra | 2 | 0 | — |
| Planning-fájl egy feature-höz | 6 (+ `CONTRACT-GAPS`, `archive/`, `tasks/*-report.md`) | 2 mindig + 2 ha van tartalma; nincs `archive/`, nincs report-fájl | `artifacts.md` |
| Ledger-entry alak / archívum-szabály | 25 / 4 | 0 (szabad sor) / 0 | `artifacts.md` |
| Review-dispatch egy nagy diffre | 5 lens + gap + verify (7+) | 2 | `reviewing-changes` |
| Script által szállított facts-kulcs | 14 | 0 | — |
| `validate.mjs` check | 10 | 7 | `--checks` |
| Konfigfájl a repo gyökerében a toolingnak | 2 (`devkit.config.json`, `.mcp.json`) | 0 | fájllista |
| `docs/hooks.md` sor | 422 | 0 | — |
| Core evalok | 29 | 25 | fájllista |
| Saját shell-parser / CLI-protokoll / scenario-DSL / facts-service / gate-runner | 1/1/1/1/1 | 0/0/0/0/0 | fájllista |
| Runtime-függőség | 0 | 0 | — |

## 6. Nyitott bizonytalanságok (H), és mi dől el rajtuk

1. **A `Read` deny a PowerShell `Get-Content`/`gc`/`type` parancsokra.** A docs csak Bash-példákat
   ad. Ha nem fedi: natív Windowson a PowerShell-eszközzel olvasott `.env` átmegy; a snippet-szakasz
   kimondja. Egy interaktív session, három parancs.
2. **`Bash(git merge:*)` és `git merge-base`.** Ha tilt, a merge-sor kikerül a snippetből, és a
   `syncing-branches`/`finishing-features` prózája marad a tiltás.
3. **`Read(!.env.example)` carve-out 2.1.292-n.** Dokumentált (D); ADR 0011 megfigyelést kér.
4. **`attribution` objektumforma 2.1.292-n.** Dokumentált (D), bináris (E); egy commit zárja le.
5. **`Edit(.git/**)` deny** nem akadályozza-e a `snapshot.mjs` privát indexét (az a `GIT_INDEX_FILE`
   környezeti változóval egy temp-fájlba ír, nem `.git/` alá — S; de a `git write-tree` objektumot
   ír `.git/objects` alá, ami nem `Edit`-eszköz, tehát a deny nem érinti — I). Egy `snapshot take` a
   snippet alatt.
6. **A PLAN/STATUS alakra átírt evalok** baseline-eredménye változhat; a retention-verdikt újra
   mérendő a 8 átírt eseten. Quota; a terv nem áll meg rajta, a `/release` NOT RUN-ként jegyzi.
7. **A `verify` pass értéke egy reviewerrel.** Ma a large-tier dedupe után fut; kis diffen egy
   finder + egy verifier. Ha a `reviewing-changes-trigger` eval két futása nem mutat refutált
   findingot, a verify is törölhető. Mérés a 3. fázis után.
8. **A session-modell a reviewerben `opus` helyett.** Nincs mérés; a terv 7. fejezete triggert ad.
9. **A `budget` check plafonja (6 500)** repo-policy, nem natív limit. Marad; ha a `/skill-doctor`
   mérés mást mutat, a konstans változik.
10. **GitHub branch protection** nem olvasható a repóból; a release-folyamat feltételezi.
11. **A snapshot és a `required` clean filter** (Git LFS) viselkedése változatlan; a troubleshooting
    sor marad.

## 7. Anti-komplexitás invariánsok (a `CLAUDE.md`-be, ADR 0013-ra hivatkozva)

1. **A devkit nem szállít hookot, és nem futtat projektkódot automatikusan.** A határ a fogyasztó
   permission- és attribution-beállítása, a sandbox és az OS; a devkit ezeket ajánlja és
   dokumentálja. Új hook csak akkor, ha egy natív beállítással nem kifejezhető, bejelentett
   incidenst előz meg, és a bejelentés a CHANGELOG-ban van.
2. **A projekt tényeit a skill olvassa a használat pillanatában, egy közös szabály szerint.** Nincs
   facts-service, nincs gate-runner, nincs override-séma. Egy tény, amit két skill másképp olvasna,
   a `project.md` egy sora, nem egy script.
3. **Egy feature állapota fájlokban él, protokoll nélkül.** `PLAN.md` mondja, mit és miért;
   `STATUS.md` mondja, hol tart; `DECISIONS.md` és `CONTRACT-GAPS.md` append-only listák, id szerint
   olvasva. Nincs bejegyzés-katalógus, nincs archívum-protokoll, nincs mozgatás, nincs formátum-
   kompatibilitási réteg: egy régi feature-t a felhasználó kézzel visz át, a terv egy mondata
   mondja, hogyan.
