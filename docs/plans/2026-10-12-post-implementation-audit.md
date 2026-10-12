# frontend-devkit — implementáció utáni független audit

Dátum: **2026-10-12**. Ág: `dev`. Vizsgált commit: **`97f44d3`**. Összehasonlítási alap: **`4f8fc37`**; ez a tervet rögzítő commit, közvetlenül az első implementációs fázis előtt. A korábbi Codex-review `ae673d4` állapotát vizsgálta; a két baseline között a tervdokumentumok és a `.gitignore` változott, nem a plugin implementációja.

Környezet: natív Windows, PowerShell, Node **22.23.3**, Claude Code **2.1.292**, Git **2.47.0.windows.1**. Implementációs fájlt nem módosítottam. Csak ezt a jelentést és elkülönített auditbizonyítékokat hoztam létre. Nem indítottam fizetős agentsessiont, evalot, alkalmazásszervert vagy valódi projektet módosító Git-műveletet. A konfliktusos Git-próbák kizárólag az audit saját fixture-repóiban futottak.

## A. Ítélet: REJECT

**A jelenlegi commit kiadását nem hagyom jóvá. Az architekturális irányt igen.** A radikális egyszerűsítés megtörtént: a runtime-rétegek valóban megszűntek, nem új néven tértek vissza. A kiadást négy konkrét probléma akadályozza: az ismételt diffírás és az új felülírásvédelem összeférhetetlensége; a textconv által módosítható review-bizonyíték; a konfliktusfolytatást blokkoló új clean-tree szabály; és a snapshotra továbbra is ráépített, hamis helyreállítási ígéret.

Ezek helyi korrekciókat igényelnek. **Nem indokolnak új hookot, parancsértelmezőt, gate-runnert, konfigurációs réteget vagy keretrendszert.** A refaktor visszafordítása rosszabb architektúrát eredményezne.

Összesen: **4 HIGH**, **5 MEDIUM**, **2 LOW** megállapítás; BLOCKER kategóriájú, általánosan működésképtelenné tevő hibát nem állapítottam meg. A HIGH leletek kiadásblokkolók. Az alacsonyabb súlyosság nem jelenti azt, hogy a megállapítás pusztán stíluspreferencia.

## B. Vezetői értékelés és bizonyítéki keret

A cél lényegi része teljesült. A saját shell-parser, a két parancsőr, a facts-service, a gate-runner, a Stop- és formázóhook, a saját CLI-driver és scenario-nyelv eltűnt. A fogyasztói és repo-hookok száma egyaránt nulla. A hét megmaradt `.mjs` fájlból csak egy kerül a fogyasztóhoz. Nulla külső runtime-függőség maradt. A két nagy prózai változás is valós: a feature-állapot három kötelező és egy feltételes fájlra csökkent, a nagy review hét vagy több dispatch helyett legfeljebb két alapdispatchet használ.

Az eredmény azonban még **nem a legkisebb védhető, helyes architektúra**. A snapshot immár központi bizonyítékforrás, ezért a kis script hibája több lifecycle-útvonalat érint. A prózai szerződések egyszerűbbek, de továbbra is valódi szerződések: fájlnév, reportazonosító, taskállapot, baseline és fixkör kapcsolja össze őket. A „protokoll nélküli” megnevezés az eltávolított ledger/archiválási protokollra igaz; minden protokoll megszűnésére nem.

Bizonyítékjelölések:

| Jel | Jelentés |
| --- | --- |
| **E** | Ebben az auditban ténylegesen lefuttatott ellenőrzés vagy izolált kísérlet. |
| **S** | Aktuális forrás és Git-diff alapján ellenőrzött állítás. |
| **D** | Az audit során megnyitott hivatalos dokumentáció. Nem automatikusan a telepített verzió futási bizonyítéka. |
| **P** | Korábbi végrehajtási napló állítása. Nem saját újramérés és nem a nyers evaltranskript önálló újragradelése. |
| **I** | A megnevezett bizonyítékból levont következtetés. |
| **U** | Nem ellenőrzött. |

Elolvasott döntési előzmények: a második kiadású architektúraaudit, a `CODEX-REVIEW.md`, a teljes második kiadású végrehajtási terv, az ADR-ek releváns módosításai és az audit kezdetén elérhető `temp/plan-baseline.md`. Utóbbi a munkamenet későbbi szakaszában már nem volt a helyén; az abból idézett eredményeket kizárólag **P** bizonyítékként használom. A mostani metrikákat ezért a Git-objektumokból újraszámoltam, nem a naplóból másoltam.

### Változások rekonstrukciója

| Commit | Tényleges változás |
| --- | --- |
| `d0e91be` | Fogyasztó nélküli tooling törlése; pinelt merge/release validáció; külön latest canary. |
| `1af0658` | PLAN/STATUS/DECISIONS/CONTRACT-GAPS; egyszerűbb lifecycle; két szerepű review; rövid implementer-válasz. |
| `b32496f` | A facts/gates fogyasztók átírása; `optimizing-prompts` és evaljai törlése. |
| `9f892ad` | Facts/gates és formázó/Stop runtime törlése; snapshot API-szűkítés és exkluzív diffírás. |
| `21ec91e` | Maradék fogyasztói hookok/parser törlése; natív settingsminta; credential-predikátum beolvasztása. |
| `b9ce864` | Repo-hookok, config, graph és további repo-local tooling törlése; hét validátorcheck. |
| `6b6c62d` | Dokumentációs zárás és mérések. |
| `feabfaf` | Jóváhagyandó szöveg form-previewban; idézőjeles snapshot-grant; rögzített permission-megfigyelések. |
| `97f44d3` | Evalok által talált prózai hibák javítása: formban látható tartalom, gate-exit, review-intent, diagnózis/fix belépés, szerverleállítás ellenőrzése. |

**162 fájl változott: 72 törölt, 87 módosított, 3 új.** A három új fájl: `.github/workflows/canary.yml`, az ADR 0013 és `planning-features/references/project.md`. Nincs új szállított script. A teljes, minden módosított/törölt/új és változatlan fájlt felsoroló leltár: [inventory.md](C:/Users/lidominik02/Desktop/frontend-devkit/temp/post-implementation-audit-2026-10-12/inventory.md). A gépi változáslista: [changes.tsv](C:/Users/lidominik02/Desktop/frontend-devkit/temp/post-implementation-audit-2026-10-12/changes.tsv).

A `min-0`–`min-7` tagek hiánya nem talált implementációs hiba: a napló utólagos, szándékos törlésüket rögzíti. A commitlánc és a baseline továbbra is azonosítható. A tageket nem állítottam vissza.

### Jelenlegi függőségi térkép

```text
marketplace → core; vue → core; nuxt → core + vue

clarifying → planning → executing → reviewing → finishing
    │                        │          │
    └─ bounded build         └─ implementer + task reviewer
testing → verifying-ui / design-intent / Storybook → finishing
investigating → felhasználói döntés → fixing → reviewing
syncing → Git + backup ref → reviewing

közös projektolvasás: planning-features/references/project.md
közös állapot: artifacts.md → PLAN / STATUS / DECISIONS / CONTRACT-GAPS
közös review-alap: snapshot.mjs → natív Git, privát index, nem tartós backup
framework-tudás: vue-engineering → nuxt-engineering delta

validate.yml → validate.mjs + 3 Node-tesztfájl + pinelt natív plugin validate
release.yml → tag/verzió + ugyanazok a kapuk → release-notes.mjs → gh release
canary.yml → latest natív plugin validate, hibánál piros workflow
validate.mjs → release-notes.mjs tiszta fejlécfüggvénye
3 tesztfájl → helpers.mjs
repo-local: release / cli-upgrade-check / diagnosing-sessions
repo-agentek: component-reviewer / eval-grader
```

A hookok lifecycle-ja, eventkezelése és hook-exitkódja jelenleg **nem alkalmazható**: nincs hookregisztráció vagy rejtett hook-frontmatter. A CLI-eszközök exitkódját és a snapshot hibautakat viszont külön ellenőriztem.

## C. Tervmegfelelési mátrix

A PASS az adott sorban megnevezett követelményt igazolja, nem az egész komponens hibamentességét. A fázisok történeti végrehajtását nem keverem a jelenlegi forrás megfelelésével.

| Terv | Érdemi követelmény | Minősítés | Bizonyíték / eltérés |
| --- | --- | --- | --- |
| §0 | Baseline megőrzése, munkafa megőrzése | PASS | `4f8fc37` elérhető; a termékkód előtti állapot rekonstruálható. |
| §0 | Hét külön fáziscommit | PASS | A hét felsorolt implementációs commit. |
| §0, fázis-DoD | Minden köztes commit után minden kapu zöld | NOT VERIFIED | Történeti napló van, az összes köztes checkoutot nem futtattam újra. |
| §0 | `min-*` tagek | PARTIAL | P: létrehozva, később szándékosan törölve; nem runtime-regresszió. |
| §0, §9 | Nincs új hook/parser/facts/gates/driver/DSL/dependency | PASS | Fájlleltár és aktívhivatkozás-scan; nulla utódmechanizmus. |
| §1.1 | try-unreleased, windows-check, release-check/warning, CLI-wrapper és tesztjeik törlése | PASS | Git D-bejegyzések, nincs aktív hivatkozás. |
| §1.2 | Pin `2.1.292`, natív strict exit a merge-kapu | PASS | `validate.yml`; a warning exit 1 saját fixture-rel is igazolt. |
| §1.2 | Nincs release-warning/felesleges fetch-depth/canary ugyanebben a workflow-ban | PASS | Aktuális YAML. |
| §1.3 | Külön heti/manuális latest canary, max. 25 sor, nincs continue-on-error | PASS | Pontosan 25 sor. Távoli lefutását nem állítom. |
| §1.4 | Tag egyezik minden manifesttel; release strict validáció | PASS | `release.yml`; a workflow futását nem hajtottam végre. |
| §1.5 | docs-links/mcp-names törlés; plugin-agent ignored mezők ellenőrzése | PASS | Hétcheckes végállapot; hooks fixture-teszt megmaradt. |
| §1.6 | Futásonkénti duplikált node --check törlés | PASS | A helperből eltűnt; egyszeri scripts check maradt. |
| §1.7 | Release working-tree precondition konzisztens | PARTIAL | A végső ellenőrzés megvan, a korábbi lépés mást ígér; F10. |
| §1.7 | Két kézi smoke, CLI-upgrade három lépés, mindkét pin emelése | PASS | A skillek tartalma megfelel. |
| §2.1 | Közös projektolvasás, workspace, packok, gate-ek, base | PASS | 31 sor; nincs facts JSON vagy override-séma. |
| §2.1, későbbi javítás | Valódi parancs-exit, NOT RUN nem pass | PASS | PIPESTATUS és missing-tool szabály jelen; LLM-követés itt nem újramért. |
| §2.2 | Négy állomány, három mindig és CG csak API-nál | PASS | `artifacts.md`; a terv részletes §2.2-ja ezt írja elő. |
| §2.2 | Nincs ledgerkatalógus, bejegyzésmozgatás, kompatibilitási réteg | PASS | Szabad Log; helyben superseded/answered; egyszeri kézi migráció. |
| §2.2 | Tasks/Closed findings egyértelmű író-olvasó szerződés | PASS | Review és re-review nyitott leletek külön meghatározva. |
| §2.2 | References és hosszkorlátok | PASS | artifacts 130, project 31, rules-block 28 sor. |
| §2.3 | plan/resume/checkpoint, save törölve, meglévő Done task megőrizve | PASS | Skill ágai megfelelnek. |
| §2.3 | Jóváhagyás, mód, teljes kickoff-rules | PASS | Későbbi javítás után a szabályok kiírva, nem csak névvel. |
| §2.4 | Clarifying külön marad, bounded route, forrás/rationale/frontier | PASS | Módok és döntési szabályok megvannak; nincs questionnaire- vagy archívummozgatás. |
| §2.5 | Saját terv kritikus értékelése; nincs survey vagy 3 draftoló | PASS | Jelenlegi designing body; a retention-következtetés külön megjegyzés alább. |
| §2.7 | Baseline, privát snapshot, implementer/task review/max. 3 fixkör | PARTIAL | Főút megvan; ismételt futás fájlnévütközéses, F01. |
| §2.7 | Félbehagyott task folytatható | FAIL | Rögzített `NN-task.diff` és exkluzív létrehozás ütközik, F01. |
| §2.7 | Inline, user-ruling, fix/defer/keep, nincs batch/triage/report-file | PASS | Az ágak és tiltások jelen vannak. |
| §2.8 | Rövid implementer-válasz, nincs report-fájl | PASS | Legfeljebb 20 soros visszatérési szerződés. |
| §2.8, audit §2.1 | Formázóhook helyett explicit projektformatter | PARTIAL | Csak shelles edit/conflict után szerepel; normál Edit/Write útvonalon hiányzik, F07. |
| §2.9 | Reviewer Read/Grep/Glob/Skill, gate nem fut benne | PASS | Frontmatter és body is így szól. Packok verzióolvasása Read-re váltott. |
| §2.10 | Egy two-axis + verify, nincs fix opus/lens/gap-sweep | PASS | Verify jelölt nélkül kihagyható; re-review egy worker. |
| §2.10 | Review-diff teljes, megbízható forrásbizonyíték | PARTIAL | Textconv és indexflag-korlát, F02/F05. |
| §2.11 | Finish: completeness, exact-message commit, MR-text, open items, archive | PASS | Nincs held archive, menü-visszatérés vagy automatikus publikálás. |
| §2.12 | Evalok átírása és két obsolete lifecycle-eval törlése | PASS | Fájlok és rubrikák új artifactnevekkel; saját modellfutás nélkül. |
| §2.13 | Body/reference sorplafonok | PASS | A body mérete frontmatter nélkül mérve mind megfelel. |
| §3.1 | testing/verifying/preparing/describing facts-migráció | PASS | Projektfájlok közvetlen olvasása; `project.md` hivatkozások. |
| §3.1 | verifying-ui nem állít leállást élő port mellett | PASS | Jelenlegi szöveg ellenőriz és őszintén jelez; a folyamatfa megszüntetése továbbra sem garantált. |
| §3.1 | syncing: commit-first, autostash törlés, konfliktusfolytatás megtartása | PARTIAL | Autostash eltűnt; az új általános stop blokkolja a folytatást, F03. |
| §3.1, §4.2 | Snapshot kizárólag review-alap, nem helyreállítási ígéret | FAIL | In-progress snapshotot a sync még visszaállítási forrásként ígéri, F04. |
| §3.1 | fixing: diagnózis, egyfájlos próba, revert-proof, owner report | PARTIAL | A szerkezet megvan; ismételt revert-proof `fix.diff`-je ütközik, F01. |
| §3.1 | investigating batch és optimizing-prompts teljes törlése | PASS | Runtime és evalfájlok eltűntek; authoringban maradt egy általános batch-utalás. |
| §3.1 | Vue/Nuxt: Read-es verzióolvasás, facts/runner flag-ek nélkül | PASS | A célzott migráció teljes. A megmaradt await-szabály külön örökölt hiba, F06. |
| §4.1 | Két script, két hook, tesztjeik törlése | PASS | Fájlszintű leltár. |
| §4.2 | snapshot --feature törlés, wx, repo-root output | PASS | Kód és két meglévő új regressziós teszt sikeres. A fogyasztói kompatibilitás FAIL. |
| §4.3 | scripts.md egyetlen szűk szakasz, nincs project.json | PASS | 37 sor; nincs aktív override-hivatkozás. |
| §5.1–5.3 | Natív snippet, PowerShell git-szabályok, attribution, garanciaveszteség | PARTIAL | Install dokumentálja a lényeges korlátokat; a rövid README/architecture állítások túl általánosak. |
| §5.2 | Nulla szállított hook, egyetlen script, credential-helper beolvasztás | PASS | Nincs lib/ vagy guardutód. |
| §5.3 | Installation és preparing snippet egyezik | PASS | JSON-tartalmuk géppel összehasonlítva azonos. |
| §5.4 | 12 soros permission-mátrix megfigyelve és rögzítve | PARTIAL | S: install verzióval rögzíti; P: kontrollos futások naplója; U: saját fizetős újramérés. |
| §5.4 | Windows PowerShell Read-védelem garantált | PASS | A terv eredményrögzítést kér; a helyes eredmény itt „nem fedett”, nem egy hamis pass. |
| §6.1 | Repo-hookok/config/MCP/graph/szerzői segédskillek törlése | PASS | Nincs helyettesítő service; consumer MCP-útmutatás jogosan megmaradt. |
| §6.2 | Inline packs olvasás, konstans budget, hét check | PASS | 540 soros validátor; natív validator hézagát saját próba igazolja. |
| §6.2 | Csak szükséges teszthelper marad | PARTIAL | Négy elárvult függvény és hozzájuk tartozó import/komment maradt, F09. |
| §6.3 | contract-auditor → component-reviewer §7 | PASS | A prózai szerződésellenőrzés beolvadt. A permission-értelmezés hibás maradt, F08. |
| §6.3 | Szerzői útmutatások rövid dokumentációba kerülnek | PASS | Adding a pack / body-reference / delta / descriptions jelen. |
| §7.1 | Docs/ADR státuszok, lifecycle max. 100 sor | PASS | lifecycle 96; ADR 0013; régi hook-ADR superseded. |
| §7.1 | CHANGELOG/verzió csak release-kor | PASS | Mindhárom pack még 0.1.2. Audit alatt nem kell verziót emelni. |
| §7.2 | Újramért before/after, suite max. 10 s | PASS | Gitből számolt metrikák; saját 4,94 s suite. |
| §7.3 | Végső component-reviewer minden lelet rendezve | NOT VERIFIED | P napló rendezéseket állít; független audit most további hibákat talált. |
| §8 | Triggerek vizsgálatot, nem automatikus visszaépítést indítanak | PASS | A terv és invariánsok ezt tartják; 10/20 session utóvizsgálat most U. |
| §9 | Új komponens felvételének négy indoka | PARTIAL | ADR 0013-ban megvan, CLAUDE.md-ben csak a hookra teljesen explicit. Nem új validator kell. |
| §9 | Kiadási feltétel: mátrix + 3 kötelező eval | PARTIAL | P szerint futottak; release skill csak általános smoke-ról kérdez. Nem állítom, hogy ténylegesen kihagyták. |
| §10 | Jelenlegi statikus kapuk, Node-tesztek és 4 strict validate | PASS | Saját futás; részletek H-ban. |

**Helyes vagy indokolt eltérések:** a `tasks/` könyvtár feltüntetése a tree-ben, mert a terv maga oda ír briefet; a régi fájlnevek kijavítása descriptionökben; batch-törlés előrehozása; consumer `.mcp.json` említések megtartása; régi-Node fail-fast a validátorban; quoted snapshot-grantok; a megjelenítendő tartalom previewba helyezése; a hiányzó CLI-bináris NOT RUN-ként jelentése. Ezeket nem kell visszacsinálni a szó szerinti terv kedvéért.

**A terv hibáit nem kérem vissza:** a fix fájlnevek `wx`-szel nem tarthatók; az általános clean-tree stop nem alkalmazható az aktív rebase konfliktusaira; az Edit/Write nem helyettesíti a formattert. A későbbi evaljavítások indokoltak. A régi sorplafonok mechanikus teljesítése nem bizonyít sem szükségességet, sem helyességet.

## D. Konkrét helyességi, biztonsági és regressziós leletek

### F01 — Az új felülírásvédelem megszakítja az ismételt munkafolyamatokat

**HIGH · új regresszió · kiadást blokkol: IGEN · E + S.**

Hely: [snapshot.mjs:171](C:/Users/lidominik02/Desktop/frontend-devkit/plugins/core/scripts/snapshot.mjs:171), [executing-plans/SKILL.md:75](C:/Users/lidominik02/Desktop/frontend-devkit/plugins/core/skills/executing-plans/SKILL.md:75), [fixing-bugs/references/loop.md:72](C:/Users/lidominik02/Desktop/frontend-devkit/plugins/core/skills/fixing-bugs/references/loop.md:72).

A script helyesen `wx` móddal nyit: létező diffet nem ír felül. A fogyasztó viszont a task tervbeli sorszámából és slugjából mindig ugyanazt az outputnevet állítja elő. Az executing 31. sora az első befejezetlen task folytatását írja elő, ezért egy diffkészítés utáni megszakításból visszatérve ütközhet a korábbi bizonyítékkal. Még közvetlenebb az ellentmondás a revert-proofban: a loop 75. sora a teszt megerősítése után visszaküld az 1. lépésre, majd a 72. sor ismét ugyanabba a `fix.diff` fájlba írna.

**Reprodukció:** külön Git-fixture-ben változtatás → `snapshot.mjs diff HEAD --out temp/f/tasks/01-task.diff` → további változtatás → ugyanaz a parancs. Az első kilépési kódja 0, a másodiké 1: `snapshot: --out names an existing file; choose a new path`. A régi fájl tartalma változatlan maradt. A scriptpróba ténylegesen futott; teljes fizetős skill-folytatás nem.

**Hatás:** a támogatott folytatás és revert-proof újrapróbálás megáll, vagy a modell improvizálva törli a korábbi review-bizonyítékot. A jelenlegi tesztek bizonyítják a felülírás megtagadását, de nem a fogyasztói szerződés kompatibilitását.

**Legkisebb javítás:** maradjon a `wx`; a hívó minden új kísérlethez szabad fájlnevet válasszon ugyanabban a könyvtárban, és a tényleges visszaadott utat adja tovább. Egy rövid sorszám-/attempt-szabály elég. Nem kell registry, archiválási protokoll vagy felülírási opció. A task- és fixkör-diffneveket egyaránt át kell nézni.

**Elfogadás:** ugyanaz a befejezetlen task és a revert-proof kétszer is lefuthat; külön diffutakat kapnak, a korábbi fájl bájtjai és a valódi Git-index nem változnak.

### F02 — A review-diff külső textconvot futtat, amely elrejtheti a változást

**HIGH · örökölt, a refaktorban megmaradt hiba · kiadást blokkol: IGEN · E + S + D.**

Hely: [snapshot.mjs:179](C:/Users/lidominik02/Desktop/frontend-devkit/plugins/core/scripts/snapshot.mjs:179), különösen a 181. sor. A credential-összehasonlítás 120. sora már használ `--no-textconv` kapcsolót; a végső review-diff nem.

A `--no-ext-diff` nem kapcsolja ki a textconv drivert. Git diff esetén az külön mechanizmus, és alapértelmezésben engedélyezett. A megjelenített transzformáció nem feltétlenül alkalmas a forrás rekonstruálására. [Hivatalos Git diff dokumentáció](https://git-scm.com/docs/git-diff).

**Reprodukció:** elkülönített repóban `*.txt diff=audit` attribútum; lokális `diff.audit.textconv` egy ártalmatlan Node-konverterre állítva. A konverter markerfájlt ír, és minden bemenetre ugyanazt a normalizált szöveget adja. Az `a.txt` tartalma `base` helyett `real changed source` lesz. A snapshot 0-val kilép, a stat egy módosított fájlt mutat, **hunk egyáltalán nincs**. A konverter markere létrejön. A kontroll `git diff --no-textconv HEAD -- a.txt` megmutatja az eltérést.

**Hatás:** a reviewer és a revert-proof olyan bizonyítékot kap, amelyből a tényleges forrásmódosítás hiányzik; a diffolvasás további projektkonfigurált programot indít. Ehhez meglévő Git-driver konfiguráció kell: ez nem bizonyított, tetszőleges távoli kódfuttatási támadás.

**Legkisebb javítás:** `--no-textconv` a végső diffhívásokban is. Nem kell új parancsőr. A snapshot `git add`-ból következő clean-filter viselkedése ettől külön kérdés; a script ezt már dokumentálja.

**Elfogadás:** a fenti driver mellett a konverter nem indul el, a nyers módosítás megjelenik, a valódi index változatlan. Ehhez egy célzott viselkedési teszt indokolt.

### F03 — A clean-tree feltétel blokkolja a már folyamatban lévő konfliktus feloldását

**HIGH · új regresszió · kiadást blokkol: IGEN · E + S.**

Hely: [syncing-branches/SKILL.md:98](C:/Users/lidominik02/Desktop/frontend-devkit/plugins/core/skills/syncing-branches/SKILL.md:98); az ezzel ellentétes támogatási ígéret a 36–37. sorban van.

A skill vállalja a felhasználó konfliktuson megállt rebase/cherry-pick műveletének befejezését. Ugyanakkor bármely `git status --porcelain` bejegyzésnél megállítja a tervet. Egy aktív konfliktus természetesen ilyen bejegyzés.

**Reprodukció:** elkülönített kétágú repó rebase-e szándékosan megállt; a status `UU a.txt`. A snapshot sikeresen elkészült, és az eredeti index unmerged állapotban maradt. A dokumentált általános stop ezzel az állapottal nem engedi elérni a konfliktusfeloldást. A Git-állapotot lefuttattam; a modell végrehajtási választását nem mértem agentsessionben.

További, forrásból következő ütközés: az 51–64. sor már `temp/…/LOG.md`-t készít, és kifejezetten kezeli azt is, ha `temp/` nincs ignorálva. Ilyenkor a saját scratchállomány is megjelenhet a későbbi általános status-stopban. Ez itt **S/I**, nem külön futási bizonyíték.

**Hatás:** a támogatott „folytasd a konfliktusos műveletet” útvonal a saját előfeltételén bukik el.

**Legkisebb javítás:** a clean-tree előfeltétel új művelet indítására vonatkozzon. Felismert, folyamatban lévő művelet konfliktusait külön kezelje; a saját scratchállományt ne tekintse a felhasználó commitolandó munkájának. A nem kapcsolódó felhasználói módosításokat továbbra is nevezze meg és őrizze meg. Autostash vagy restore-manager visszaépítése nem szükséges.

**Elfogadás:** tiszta indulás, már konfliktusos rebase/cherry-pick, nem ignorált `temp/`, valamint valódi, nem kapcsolódó uncommitted munka külön forgatókönyv. Az első három megfelelő útvonalon továbbhalad; az utolsó nem vész el és nem kerül automatikus commitba.

### F04 — A sync továbbra is hamis helyreállítási garanciát épít a snapshotra

**HIGH · korábbi audit megoldatlan követelménye · kiadást blokkol: IGEN · E + S.**

Hely: [syncing-branches/SKILL.md:64](C:/Users/lidominik02/Desktop/frontend-devkit/plugins/core/skills/syncing-branches/SKILL.md:64), [ugyanott:193](C:/Users/lidominik02/Desktop/frontend-devkit/plugins/core/skills/syncing-branches/SKILL.md:193), [references/conflicts.md:145](C:/Users/lidominik02/Desktop/frontend-devkit/plugins/core/skills/syncing-branches/references/conflicts.md:145). A snapshot saját korlátai a [script:2](C:/Users/lidominik02/Desktop/frontend-devkit/plugins/core/scripts/snapshot.mjs:2) sorától helyesen szerepelnek.

A sync azt mondja, hogy az in-progress tree megtartja a felhasználó kézzel feloldott fájljait, és abort után `git show <tree>:<path>` visszaadja őket. A snapshot ugyanakkor szándékosan kizár credentialútvonalakat és `temp/`-ot; nem őrzi külön a staged/unstaged verziót, és nem teljes backup. Az egyik hétköznapi fájlra megfigyelt visszaolvasást a referencia indokolatlanul általános garanciává emeli.

**Reprodukció:** kizárólag szintetikus `SYNTHETIC=…` tartalmú, követett `.env` fájl konfliktusa; kézi feloldás staging nélkül; snapshot. A script 0-val kilépett, üres tree-t adott. `git show <tree>:.env` kilépési kódja 128: a fájl nincs a tree-ben. A fixture `git rebase --abort` után az ág korábbi `SYNTHETIC=feature` tartalmát kapta vissza, a felhasználót jelképező kézi feloldás elveszett. Valódi credentialt nem olvastam.

**Hatás:** a felhasználó valótlan visszaállíthatósági állítás alapján hagyhatja jóvá a munkája elvesztését. F03 jelenlegi stopja nem megfelelő megoldása ennek: a dokumentált abortgarancia önmagában hibás, és F03 korrekciója után elérhetővé válik.

**Legkisebb javítás:** törölni az általános recovery-ígéretet. Az abort előtti tájékoztatás nevezze meg a nem commitolt feloldások elvesztését és a snapshot korlátait. Ha egy szükséges fájl nincs bizonyíthatóan megőrizve, a felhasználó külön mentse, vagy az abort álljon meg. Ne bővítsük a snapshotot titkokat Git-objektumba író backup-rendszerré.

**Elfogadás:** normál, credential, staged és unstaged feloldás esetén sem ígérhet a skill a bizonyítottan elérhető tartalomnál többet. Backup ref csak a commitolt állapotot garantálja. A kizárt szintetikus credential továbbra sem kerülhet snapshotba.

### F05 — Az assume-unchanged jelölés miatt a tree nem a munkafájl tartalmát őrzi

**MEDIUM · örökölt hiba · általános kiadást blokkol: NEM; az érintett repók teljes review-lefedettségi állítását igen · E + S.**

Hely: [snapshot.mjs:108](C:/Users/lidominik02/Desktop/frontend-devkit/plugins/core/scripts/snapshot.mjs:108), majd 129. sor.

A valódi index másolata magával viszi az `assume-unchanged` flaget. Az ezt követő `git add -u` nem frissíti a megjelölt fájl tartalmát.

**Reprodukció:** commitolt `a.txt` → `git update-index --assume-unchanged a.txt` → munkafájl módosítása → snapshot → `git show <tree>:a.txt`. A tree-ben `base`, a lemezen `changed but flag set` szerepelt. A `skip-worktree` viselkedését ebben az auditban nem teszteltem.

**Hatás:** a munkafájl tényleges módosítása hiányozhat a review-alapból és diffből. Ez nem a gyakori alapbeállítás, ezért MEDIUM.

**Legkisebb javítás:** a snapshot által lefedni kívánt fájlok ilyen flagjét csak a privát indexmásolatban törölni Git-paranccsal, vagy a támogatási szerződést kifejezetten szűkíteni és az érintett állapotot jelenteni. A valódi indexhez nem szabad hozzányúlni. Nem kell saját indexparser.

**Elfogadás:** a teszt a friss munkatartalmat látja, vagy egyértelműen jelzett, nem teljes review-eredményt kap; nincs csendes hamis teljeskörűség. A valódi index bájtazonossága megmarad.

### F06 — A Vue/Nuxt pack hibának minősít támogatott top-level await használatot

**MEDIUM · örökölt tartalmi hiba · kiadást blokkol: NEM · S + D; framework-runtime próba: U.**

Hely: [Vue reactivity.md:101](C:/Users/lidominik02/Desktop/frontend-devkit/plugins/vue/skills/vue-engineering/references/reactivity.md:101), [Vue review-checklist.md:47](C:/Users/lidominik02/Desktop/frontend-devkit/plugins/vue/skills/vue-engineering/references/review-checklist.md:47), [Nuxt SKILL.md:75](C:/Users/lidominik02/Desktop/frontend-devkit/plugins/nuxt/skills/nuxt-engineering/SKILL.md:75), [Nuxt checklist:93](C:/Users/lidominik02/Desktop/frontend-devkit/plugins/nuxt/skills/nuxt-engineering/references/nuxt-review-checklist.md:93).

A szabály szerint `<script setup>`-ban await után regisztrált lifecycle hook nem fut le. A hivatalos Vue-dokumentáció ezzel szemben kifejezetten leírja: a top-level await fordítása megőrzi az aktív komponenspéldány kontextusát az await után. [Vue: Top-level await](https://vuejs.org/api/sfc-script-setup.html#top-level-await).

**Konkrét ellenpélda:** `<script setup>` alatt `import { onMounted } from 'vue'; await Promise.resolve(); onMounted(() => { /* … */ });`, megfelelő async setup/Suspense környezetben. Ezt a forrást a pack jelenlegi általános szabálya hibának jelölné. Ez dokumentációval alátámasztott ellenpélda, nem ebben a munkamenetben lefuttatott Vue-alkalmazás.

**Hatás:** téves review-lelet és szükségtelen kódátrendezés. A normál aszinkron callbackben történő késői regisztráció problémáját nem szabad összekeverni a compiler által transzformált top-level awaittel.

**Legkisebb javítás:** mind a négy helyen ezt a különbséget leírni; az általános „await után mindig hibás” állítást törölni. Új absztrakció vagy framework nem szükséges.

**Elfogadás:** a fordított top-level await példára nincs automatikus finding; az elveszett kontextusú valódi async callback esete továbbra is megkülönböztethető. A Nuxt-delta ne ismételje a hibás Vue-alapszabályt.

### F07 — A formázóhook eltűnt, de a normál szerkesztési útvonalon nincs explicit helyettesítés

**MEDIUM · migrációs funkciórés / a terv részben hibás feltételezése · kiadást blokkol: NEM · S.**

Hely: [implementer.md:50](C:/Users/lidominik02/Desktop/frontend-devkit/plugins/core/agents/implementer.md:50), [executing-plans/SKILL.md:113](C:/Users/lidominik02/Desktop/frontend-devkit/plugins/core/skills/executing-plans/SKILL.md:113).

A régi hook formázott az írás után. Az új implementer az Edit/Write használatát írja elő, majd a 57. sortól a gate-eket; formatterlépést nem tartalmaz. Az inline útvonal kizárólag scripted shell edit után rendeli el a projekt formatterét. Edit/Write önmagában nem futtatja azt. Az implementer indoklása — a shell write nem formázott — így a preferált útvonalra nézve félrevezető.

**Forgatókönyv:** fogyasztói projekt saját formázási szabályokkal, külön autoformat-hook nélkül; a task kizárólag Edit/Write-ot használ. A skill egyetlen lépése sem hívja meg a formattert. Ez a hiányzó lépés forrásból bizonyítható; azt nem állítom, hogy minden ilyen szerkesztés biztosan formázatlan vagy hogy egy teljes formatterpróbát lefuttattam.

**Hatás:** a korábbi automatikus viselkedés megszűnt, a stílusellenőrző kapu javítást kérhet, és a review a projekt formázásától eltérő diffet kaphat. A lelet tárgya a kimaradt funkció, nem egy preferált kódstílus.

**Legkisebb javítás:** a normál szerkesztés után egy explicit lépés a projekt saját formatterével, az érintett fájlokra; vagy a formázás tudatosan manuális felelősségének egyértelmű dokumentálása. Ne kerüljön vissza PostToolUse-hook, és a validátor ne legyen automatikus fixer.

**Elfogadás:** a dokumentált felelősség egyértelmű. Ha a képességet megtartjuk, a projekt saját formattere a kapuk előtt, kontrolláltan fut az érintett fájlokra, Edit/Write esetén is.

### F08 — A saját komponensreviewer összekeveri a preapprovalt az eszköztiltással

**MEDIUM · hibás natív integrációs útmutatás · kiadást blokkol: NEM · S + D.**

Hely: [.claude/agents/component-reviewer.md:47](C:/Users/lidominik02/Desktop/frontend-devkit/.claude/agents/component-reviewer.md:47), kiegészítő elavult állítások a 22–29. sorban; [authoring.md:46](C:/Users/lidominik02/Desktop/frontend-devkit/docs/contributing/authoring.md:46).

A reviewer azt állítja, hogy a skill grantlistájából hiányzó eszköz futáskor elérhetetlen, és a grantlista kényszeríti ki a csak olvasást. A skill `allowed-tools` mezője azonban jóváhagyás nélküli használatot engedélyez; nem önmagában eszközallowlist. Az agent `tools` korlátozása más mechanizmus. A hivatalos skills-dokumentáció a `disallowed-tools` mező eltávolítását is jelzi. [Claude Code skills](https://code.claude.com/docs/en/skills), [subagents](https://code.claude.com/docs/en/sub-agents).

**Konkrét hibás review-szcenárió:** egy skill `allowed-tools: Read` mező mellett jóváhagyás után Write-tal készít riportot. A helyi reviewer jelenlegi szabálya ezt szükségszerű runtime-hibának minősíti; a grant hiánya önmagában nem bizonyítja ezt. A repo authoring útmutatója másutt már helyesen különbözteti meg a preapprovalt és a tiltást.

**Hatás:** téves finding, felesleges jogkörbővítés vagy hamis read-only garancia. Mellékes, de konkrét maradvány: a reviewer még „mechanikusan ellenőrzött” literális reponév-grepről beszél, amelyet a jelenlegi hétcheckes validátor nem tartalmaz; az authoring pedig a törölt investigating-bugs batch Agent-hívását hozza példának.

**Legkisebb javítás:** a téves platformállítások és a két elavult példa törlése/cseréje. Külön mondat a skill-preapprovalról, agent-eszközlistáról és projekt-denyról. Ne hozzunk létre új guardot vagy tiltási réteget emiatt.

**Elfogadás:** a fenti Read→jóváhagyott Write példát nem jelöli lehetetlennek; a tényleges agent `tools` listából hiányzó eszközt továbbra is észleli. Csak létező gépi checkre hivatkozik.

### F09 — A teszthelperben megmaradt a törölt alrendszerek kiszolgáló kódja

**LOW · felesleges maradvány · kiadást blokkol: NEM · S.**

Hely: [scripts/test/helpers.mjs:26](C:/Users/lidominik02/Desktop/frontend-devkit/scripts/test/helpers.mjs:26), 30., 43. és 94. sor; az 5. sor `spawn` importja.

A `runScriptAsync`, `spawnAsync`, `hookEvent`, `isolatedEnv` négyesnek nincs megmaradt tesztfogyasztója. A keresés csak a saját definíciókat és a két async helper egymás közti hívását találta. Az npm-cache/gyermekfolyamat-kiszolgálás a törölt driver/hooktesztekhez tartozott.

**Hatás:** kicsi, de bizonyítottan szükségtelen karbantartási felület; megsérti a „csak a szükséges helper marad” célját.

**Legkisebb javítás:** e függvények, a kizárólag hozzájuk tartozó import és kommentek DELETE. A használt `tempDir`, `git`, `write`, `gitRepo`, `runScript`, Git-környezettisztítás és Windows törlési retry maradjon. Nem indokolt a használt fixture-izoláció felszámolása.

**Elfogadás:** nincs elárvult export; a meglévő 59 teszt továbbra is sikeres. A puszta törléshez új teszt nem kell.

### F10 — A release skill csak módosítás után tiltja meg azt az állapotot, amelyet előtte engedett

**MEDIUM · inkonzisztens előfeltétel · kiadást blokkol: NEM tiszta munkafán · S.**

Hely: [.claude/skills/release/SKILL.md:39](C:/Users/lidominik02/Desktop/frontend-devkit/.claude/skills/release/SKILL.md:39) és [ugyanott:75](C:/Users/lidominik02/Desktop/frontend-devkit/.claude/skills/release/SKILL.md:75).

Az első rész szerint a CHANGELOG/manifests körén kívüli uncommitted fájlok nem állítják meg a release-t. A 3. lépés azonban a verzió- és changelogírás után minden más módosított fájlnál megáll.

**Forgatókönyv:** egy ártalmatlan módosított README mellett indul a kiadás. Az első ellenőrzés továbbengedi, a user jóváhagyja a bumpot, a skill átírja a release-fájlokat, majd a későbbi status-check ugyanazon README miatt leáll. Valódi kiadást nem indítottam; a két ellentétes utasítás közvetlenül olvasható.

**Hatás:** félbehagyott release-előkészítés és szükségtelen felhasználói helyreállítás. A késői erősebb kapu helyes célját a korai feltétel nem tükrözi.

**Legkisebb javítás:** ugyanaz a tiszta munkafa-előfeltétel már az első jóváhagyás és írás előtt. Nem kell visszahozni a törölt release-check scriptet vagy ideiglenes commit-runner környezetet.

**Elfogadás:** nem release-célú módosítás esetén az első ellenőrzés megáll, és a manifest/CHANGELOG változatlan. Tiszta munkafán a leírt folyamat végig konzisztens.

### F11 — Az egyszerű sessiondiagnózisnak is kötelező négy-öt analyst

**LOW · indokolatlan minimum-komplexitás · kiadást blokkol: NEM · S; tényleges modellköltség: U.**

Hely: [.claude/skills/diagnosing-sessions/SKILL.md:66](C:/Users/lidominik02/Desktop/frontend-devkit/.claude/skills/diagnosing-sessions/SKILL.md:66), [references/analysts.md:3](C:/Users/lidominik02/Desktop/frontend-devkit/.claude/skills/diagnosing-sessions/references/analysts.md:3), 9. és 72. sor.

Ez repohelyi diagnosztika, nem fogyasztói runtime. Öt párhuzamos elemzőt ír elő ugyanarra a case file-ra; legfeljebb egy hagyható el. Egyetlen jól körülhatárolt, például rosszul minősített gate-kimenetnél is legalább négy dispatch és szintézis szükséges.

**Bizonyíték és határ:** a kötelező alsó korlát forrásból számszerű. A több elemző általános minőségi előnyét vagy dollárköltségét nem mértem. Ez ezért egyszerűsítési lelet, nem állítás egy lefuttatott diagnózis hibájáról.

**Hatás:** a legkisebb feladatra is rögzített többletolvasás és koordináció. A nagy review fan-outja eltűnt, de hasonló minimum-előírás itt változatlanul megmaradt.

**Legkisebb javítás:** törölni a kötelező négy-öt fős minimumot. Egy célzott elemzés legyen elegendő; több dimenzióhoz csak a valóban indokolt elemzők. A transcriptkezelés, anonimitás, verzióazonosítás és bizonyítéki szabályok maradjanak.

**Elfogadás:** egy egydimenziós tünet egy elemzéssel is lezárható; több független kérdésnél a célzott párhuzamosítás továbbra is választható. Új orchestrator nem szükséges.

## E. Mi maradt felesleges, és mi érdemelte ki a létét?

**Bizonyítottan eltávolítandó:** az F09 négy helperfüggvénye és kapcsolódó importja; F04 általános snapshot-recovery ígérete; F08 hamis grantlista- és már nem létező gépi check-állításai; F11 kötelező analystminimuma. F01-nél a rögzített outputnév kötelező újrafelhasználása tűnjön el, ne a felülírásvédelem. F03/F10-nél az egymásnak ellentmondó előfeltételek szűnjenek meg.

**Nem találtam rejtett guardutódot.** Nincs shell-parser, kivétellista-növelésre épülő interceptor vagy scriptet javítgató háttérscript. A credential-path logika beolvadt a snapshotba, mert egyetlen fogyasztója maradt; ez felelősségszűkítés, nem új általános guard. A használatkor olvasandó projectadatok 31 soros referenciája nem új facts-service: nem termel gépi API-t vagy cache-t, nem indít minden skill előtt processzt.

A release-check helyén prózai ellenőrzések maradtak. Ez kedvező csere, de a próza is lehet hibás, ahogy F10 mutatja. A három kötelező feature-artifact továbbra is protokoll, de nincs archive algoritmus, JSON ledger vagy olyan runtime, amely ezt a protokollt őrzi. A megmaradt összekapcsolás indokolt minimuma: taskállapot, felhasználói döntés, baseline és a reviewer bizonyítéka.

**A natív helyettesítés határa:** a checkpoint nem rögzíti általánosan a Bash, külső folyamatok és más végrehajtási csatornák módosításait; ezért a snapshot egyszerű törlése nem őrizné meg ugyanazt a review-alapot. A natív checkpointot teljes backupként sem szabad bemutatni. [Claude Code checkpointing](https://code.claude.com/docs/en/checkpointing).

Az 540 soros saját validátor ma a repo legnagyobb scriptje. Sorhossza önmagában nem indokol törlést. A frontmatter-elírásra végzett natív próba igazolja, hogy van valós többlete. A minimális irány: a hét repo-invariáns marad; általános YAML-parser, renderer, repo-felderítő platform, új plan checker vagy újabb shellvédelmi check nem kell. A 48 soros release-notes script tényleges CI-fogyasztóhoz kapcsolódik; a gondozott CHANGELOG adott szakaszát emeli ki, amit az automatikusan generált GitHub release notes nem ugyanúgy tesz.

## F. Komponensenkénti döntések

A teljes, minden követett és törölt fájlt megnevező leltár külön melléklet. Az alábbi táblák a funkcionális komponensek indoklását adják; a KEEP nem jelenti az adott komponens minden mondatának hibamentességét.

### Runtime, authoring és tesztek

| Komponens | Döntés | Konkrét indok / legkisebb megfelelő forma |
| --- | --- | --- |
| `plugins/core/scripts/snapshot.mjs` | **KEEP + SIMPLIFY szerződés** | Tracked/untracked review-tree az index átírása nélkül. F01/F02/F05 javítása; kizárólag review, nem backup. |
| Beolvasztott credential-path függvények | **MERGE megtartva** | Egyetlen fogyasztó; nincs indok külön libhez. Kizárás a Git object store előtt szükséges. |
| `scripts/validate.mjs` | **KEEP** | Natív CLI által nem fedett, konkrét invariánsok. A hét checkhez ne nőjön új infrastruktúra. |
| `scripts/ci/release-notes.mjs` | **KEEP** | Pontos CHANGELOG-szakasz CI-fogyasztóval; 48 sor. |
| `snapshot.test.mjs` | **KEEP** | Indexvédelem, credential-kizárás és outputbiztonság viselkedési tesztjei. F02/F05 hiányzó regressziói indokoltak. |
| `validate.test.mjs` | **KEEP** | Érvényes/érvénytelen repófixture-ök, kilépési kódok; a repo saját kapuját igazolják. |
| `release-notes.test.mjs` | **KEEP** | A publikált jegyzet helyes verziószakaszát ellenőrzi. |
| `helpers.mjs` | **SIMPLIFY / részleges DELETE** | F09; csak a valóban használt izoláció maradjon. |
| Régi shipped/repo hookok és tesztjeik | **DELETE végrehajtva** | Nincs regisztráció, nincs őket kiszolgáló runtime. Ne térjenek vissza. |
| facts/gates, shell/env parser, guardok | **DELETE / NATIVE REPLACEMENT végrehajtva** | Feladathoz kötött olvasás, projektparancsok, natív permissions; eltérő garanciák nyíltan vállalva. |
| CLI driver, scenario DSL, release-check, Windows-probes | **DELETE / NATIVE REPLACEMENT végrehajtva** | Natív plugin validate/eval, rövid manuális platform-smoke. |
| pack-graph, lib/config, devkit.config | **DELETE / MERGE végrehajtva** | Minimális manifestolvasás a valódi fogyasztóban, konstans budget; nincs új config-service. |

### Szállított skillek és agentek

| Komponens | Döntés | Indok és maradó korlát |
| --- | --- | --- |
| `clarifying-features` | **KEEP** | Önálló tisztázás és bounded-változtatási ág; nem minden feladatnak kötelező teljes lifecycle. |
| `designing-architecture` | **KEEP** | El nem döntött architekturális kérdések választható lépése; nem általános kötelező ceremónia. |
| `planning-features` | **KEEP** | Konkrét taskok, döntésfüggőségek és Done when; egyszerűbb artifactok tulajdonosa. |
| `executing-plans` | **KEEP + SIMPLIFY** | Inline vagy subagent mód, folytatás, baseline. F01/F07; nincs indok új state machine-re. |
| `reviewing-changes` | **KEEP** | Egy kétaxisú reviewer és nagy változásnál korlátozott további szerep; a régi lencse/finding verifier lánc eltűnt. |
| `finishing-features` | **KEEP** | Bizonyítékhoz kötött átadás és felhasználói Git-döntés, önálló lezárási művelet. |
| `testing-changes` | **KEEP** | Projekt tesztjei és célzott felhasználói esetek; nem azonos a browser UI ellenőrzéssel. |
| `verifying-ui` | **KEEP** | Tényleges böngészőállapot és vizuális ellenőrzés; meglévő MCP-t használ, nem bundliz új böngészőréteget. |
| `preparing-a-repo` | **KEEP** | Consumer-konfiguráció és framework-előkészítés, dokumentált natív snippet. A használathoz nem kötelező telepítőscript. |
| `describing-changes` | **KEEP** | Jóváhagyandó commit/PR/MR szöveg és projektkonvenciók; önálló felhasználói belépési pont, facts-injection nélkül. |
| `syncing-branches` | **KEEP + SIMPLIFY** | Konfliktus, stack, backup ref és userdöntés értékes; F03/F04 miatt recovery-ígéret és feltételek javítandók. |
| `investigating-bugs` | **KEEP** | Javítás nélküli, bizonyítékos diagnózis érdemi önálló határ. Batch-üzemmód törölve. |
| `fixing-bugs` | **KEEP + SIMPLIFY** | Célzott javítás, red/green és revert-proof; F01. Nem kell általános bug-orchestrator. |
| `optimizing-prompts` | **DELETE végrehajtva** | Nem frontend-specifikus alapfeladat. Evaljai is eltűntek. |
| `core:implementer` | **KEEP** | Választható delegálási szerep, rövid visszatérés; F07. |
| `core:reviewer` | **KEEP** | Tényleges csak olvasó agent-tools és a szülőnek visszaadott riport; a szülő írja az artifactot. |
| `vue-engineering` és szakmai referenciái | **KEEP + tartalmi javítás** | Framework-specifikus érték; F06. Nem indokolt teljes packot törölni egy hibás szabály miatt. |
| `nuxt-engineering` és delta-referenciái | **KEEP + tartalmi javítás** | SSR/adatkezelési különbségek; F06. A Vue-val közös szabály ne legyen ismételt eltérő igazságforrás. |

A korábbi Codex-review több skill összevonását vetette fel. A jóváhagyott második terv külön belépési pontokat tartott meg. A mai kódban ezekhez már nem tartozik külön runtime-service, és az eltérő felhasználói szándék látható. **Nincs elegendő új bizonyíték arra, hogy most a 13 skill mesterséges egyesítése kisebb használati és karbantartási költséget eredményezne.** A bizonyított hibák kijavítása fontosabb, mint a darabszám öncélú csökkentése.

### Referenciák, konfiguráció, repohelyi működés

| Komponens/család | Döntés | Indok |
| --- | --- | --- |
| `artifacts.md`, lifecycle dokumentáció | **KEEP** | Három kötelező + egy feltételes fájl, egyszerű olvasás és folytatás; nincs archiváló algoritmus. |
| `project.md`, `rules-block.md` | **KEEP** | Rövid, használatkor követett projektolvasási/gate-szabály; nincs JSON facts API. |
| `dispatch.md`, `formats.md` | **KEEP + F01 korrekció** | A task intent és a review-bizonyíték átadása szükséges; új ledgermezők nem indokoltak. |
| Kérdéskörök, forráskezelés, bug-loop, sync-stack/conflicts | **KEEP + F04 korrekció** | Ritkábban olvasott domaineljárások; a bodyba másolás növelné az alapkontextust. |
| UI browser-tools referencia | **KEEP** | Meglévő kapcsolatok gyakorlati használata; nem saját MCP discovery-service. |
| `core/evals` 25 esete és rubrikái | **KEEP** | Natív evalbemenetek; a fizetős futás explicit döntés. Nem szimulált unit tesztből következtetünk modellviselkedésre. |
| `.claude/agents/component-reviewer.md` | **SIMPLIFY** | F08; contract-auditor releváns részei már beolvadtak, külön agent ne jöjjön vissza. |
| `.claude/agents/eval-grader.md` | **KEEP** | Rubrika minőségét szintetikus válaszokon vizsgálja, nem puszta másolata a natív runtime-gradernek. |
| `.claude/skills/diagnosing-sessions` | **SIMPLIFY** | F11; önkéntes transcriptdiagnózis értékes, a minimum fan-out nem. |
| `.claude/skills/cli-upgrade-check` | **KEEP** | Pin/canary/platformváltozás összekötése vékony útmutatóval; nincs saját upgrade-driver. |
| `.claude/skills/release` | **SIMPLIFY** | F10; a nyílt Git-lépések maradnak, az ellentétes előfeltételek nem. |
| Korábbi authoring-skillek és trigger-tester | **DELETE / MERGE végrehajtva** | Rövid authoring dokumentáció + component-reviewer; nincs nyolc külön metaeljárás. |
| Marketplace és három pluginmanifest | **KEEP** | Natív csomagolási felület; három pack önálló telepítése. |
| Repo `.claude/settings.json` | **KEEP** | Natív engedélyek/attribution; hook nélkül. Nem consumerre automatikusan öröklődő védelem. |
| Installation/preparing permissions snippet | **NATIVE REPLACEMENT, megtartandó** | Géppel összevetve azonos; az effektív beállítás és tool/platform korlátai dokumentálandók. |
| `validate.yml` | **KEEP** | Windows/macOS/Linux és Node-mátrix; saját teszt + pinelt natív validálás. |
| `release.yml` | **KEEP** | Tag/verzióegyezés, ugyanazok a kapuk, CHANGELOG és GitHub Release. Egyedül ez ír a GitHubra. |
| `canary.yml` | **KEEP** | Latest változás külön jelzés, nincs continue-on-errorrel elrejtett piros eredmény. |
| Három workflow néhány ismételt parancsa | **KEEP jelen formában** | Nem indokol reusable workflow-réteget vagy új wrappert. A két ismert pin frissítése explicit. |
| README, CONTRIBUTING, CLAUDE, docs, ADR-ek | **KEEP, célzott pontosítás** | Döntési okok és felhasználói működés; a régi ADR superseded jelölése jó, nem élő legacy-kód. |
| `.mcp.json`, repo-hook config és törölt meta-configok | **DELETE végrehajtva** | Nincs szükség szerzői környezet automatikus újratelepítésére. A consumer böngésző-MCP dokumentáció jogosan maradt. |

## G. Előtte–utána architektúra és metrikák

A fájl- és sorszámok a `4f8fc37` és `97f44d3` Git-objektumokból származnak. A sorszám fizikai sor, nem executable LOC vagy token; a kategóriák részben egymás részhalmazai, ezért nem adhatók össze. Az új auditjelentés és az auditfixture-ök nem részei a metrikának.

| Mérőszám | Refaktor előtt | Vizsgált HEAD | Értékelés |
| --- | ---: | ---: | --- |
| Összes `.mjs` fájl / sor | 44 / 14 169 | 7 / 1 472 | −89,6% sor; valós törlés. |
| Fogyasztóhoz szállított script / sor | 11 / 5 003 | 1 / 222 | −95,6% sor. |
| Repo-tooling script / sor | 8 / 1 194 | 2 / 588 | Validátor + release-notes. |
| Skill-local script / sor | 4 / 1 115 | 0 / 0 | Saját runner/driver nincs. |
| Teszt + helper fájl / sor | 21 / 6 857 | 4 / 662 | −90,3% sor; nem a megszüntetett runtime-t teszteli tovább. |
| Shipped próza evalok nélkül / sor | 61 / 8 789 | 53 / 6 019 | −31,5% sor. |
| Core skill body + referencia / sor | 38 / 6 315 | 30 / 3 677 | −41,8% sor. |
| Core evalfájl / sor | 59 / 6 480 | 51 / 5 573 | Nem a fizetős evalfutások száma. |
| Core evaleset | 29 | 25 | Törölt funkcionalitáshoz igazodott. |
| Docs tervdokumentumok nélkül / sor | 25 / 2 214 | 25 / 1 617 | Történeti ADR-ek szándékosan maradtak. |
| Core skill / agent | 14 / 2 | 13 / 2 | A funkcionális belépési pontok többsége maradt. |
| Repohelyi skill / agent | 9 / 4 | 3 / 2 | A terv baseline-ja 10 skillt mondott; Git szerint 9 volt. |
| Szállított hook / repo-hook | 4 / 3 | 0 / 0 | Nincs hook-lifecycle, event-routing vagy hook-exitkód probléma a jelenlegi csomagban. |
| Külső runtime-függőség | 0 | 0 | Ez megőrzött tulajdonság, nem új megtakarítás. |
| Always-on description budget | 6 305 / 6 500 | 6 307 / 6 500 | Nem csökkent; +2. Nem állítható általános kontextusköltség-javulás ebből. |
| Saját statikus check | 10 | 7 | Kevesebb saját invariáns. |
| Teljes Node-suite idő | P: 75,607 s | E: 4,939 s | Kb. 93,5% rövidülés, **nem kontrollált benchmark**. |

A korábbi Codex-review 89,0 másodperces, sandboxhibákkal terhelt futását nem kevertem a 75,607 másodperces későbbi baseline-naplóval. A mostani suite mind az 59 tesztje sikeres; a korábbi több mint 1700 teszt nagy része megszüntetett mechanizmusokhoz tartozott. A tesztszám csökkenése így önmagában nem lefedettségromlás.

**Runtime overhead:** a korábbi Bash-hook-regisztráció két Node-indítást jelentett egy érintett Bash-esemény körül; ezekből jelenleg nulla marad. Ez a regisztrációkból számolt architekturális következmény, nem teljes agentsession processzprofilja. A facts-injection, Stop-validáció és edit-utáni formatter indulása is megszűnt. Az explicit snapshot/gate/review továbbra is munkát végez; F11 többletdispatchét nem mértem pénzben vagy latencyben.

**Coupling:** korábban parser → guardok, facts → számos skill, gate-runner → Stop/hook/CLI-driver, graph/config → repo-checkek láncok éltek. Most a fő közös függőség a snapshot, a `project.md`, valamint néhány rövid artifact/dispatch szabály. Ez lényegesen érthetőbb. A snapshot központi szerepe egyben azt jelenti, hogy F01/F02 több fogyasztóra hat; a kevesebb kód nem teszi kevésbé fontossá e határ helyességét.

A 13 core body mind a terv plafonja alatt van. A 7 script 1 472 sora belefér az 1 300 ±15%-os célsávba; a 662 soros tesztfelület meghaladja az 550 +15%-ot. Utóbbi nem önálló hiba: az F09 holtkódot kell törölni, nem a szükséges teszteket a sorcél kedvéért.

## H. Végrehajtott validáció és a bizonyítás határa

| Ellenőrzés | Tényleges eredmény | Mit nem bizonyít? |
| --- | --- | --- |
| `node scripts/validate.mjs` | **E: 7/7 PASS**, budget 6307/6500. | Nem bizonyítja a skillutasítások logikai konzisztenciáját. |
| `node --test "scripts/test/*.test.mjs"` | **E: 59 PASS, 0 FAIL, 0 SKIP**, 9 suite, 4939,4728 ms. | A hiányzó fogyasztói és Git-driver eseteket nem teszteli. |
| `claude plugin validate . --strict` | **E: PASS**. | Nem teljes skill-runtime ellenőrzés. |
| Ugyanez külön `plugins/core`, `plugins/vue`, `plugins/nuxt` | **E: 3/3 PASS**. | Nem modellrouting/eval. |
| `claude --version`, `claude plugin eval --help` | **E: 2.1.292**, natív eval CLI és `--bare` opció jelen. | Fizetős eval nem futott. |
| Szintetikus `disable-model-invokation` typo | **E: root és skills-dir strict validate is exit 0**. | Csak ezt a frontmatterhibát teszteltem; nem állítom, hogy semmit nem ellenőriz. |
| Ismeretlen `unexpectedAuditField` pluginmanifestben | **E: strict exit 1**. | Ez manifestcheck, nem a typo ellenőrzése. |
| Snapshot azonos output kétszer | **E: 0, majd 1; régi output sértetlen**. | F01 skill-integrációja nincs a suite-ban. |
| Textconv fixture | **E: konverter futott, forráshunk eltűnt**. | Nem bizonyít általános távoli exploitot. |
| Assume-unchanged fixture | **E: régi tartalom került a tree-be**. | Skip-worktree nem futott. |
| Aktív rebase-conflict + snapshot | **E: `UU a.txt`; take sikeres; index továbbra is unmerged**. | Nem teljes Claude konfliktusfeloldás. |
| Szintetikus credential-konfliktus + abort | **E: tree-ből hiányzik, abort után a kézi feloldás nincs meg**. | Valódi titokhoz nem nyúltam. |
| Követett, de .gitignore-ba illő fájl | **E: a snapshot tartalmazta**. | Ez helyes Git-viselkedés; az „ignored files” kizárás szóhasználata pontosabban untracked ignored legyen. |
| Installation/preparing JSON snippet | **E: szemantikusan azonos**. | A user effektív settingsrétege eltérhet. |
| Fájlleltár, törölt nevekre keresés, body-plafonok | **E/S: leltár és célzott scan sikeres**. | A keresés nem bizonyítja minden prózamondat szemantikai helyességét; F08 maradványa példa erre. |
| Git munkafa/index ellenőrzés | **E: tracked implementáció nem változott**. | Csak auditdokumentum és ignored fixture készült. |

**Korábbi eredményként kezelve (P):** a végrehajtási napló alaptesztideje, az előző sessionök eval-eredményei, a permission-mátrix korábbi élő megfigyelései és a végső component-reviewer lezárása. Az installation aktuális szövegének létezése **S**, a benne állított korábbi modellezett/CLI-viselkedés ettől még nem saját újramérés.

**Nem végrehajtva (U):** fizetős Claude agentsessionök; natív eval újrafuttatás és nyers transkriptek független újragradelése; tényleges user-settings migráció; teljes browser/E2E/Vue runtime-próba; Linux/macOS és Node 24/26 helyi futás; GitHub CI/canary távoli futásának eredménye és action-refjeinek futásidejű feloldása; valódi commit/tag/push/release; hosszú távú 10/20-session megfigyelés. A workflow konfigurációját olvastam, nem állítom egy nem indított workflow sikerét.

### Natív platform: mi igazolható?

Az auditban megnyitott hivatalos dokumentáció alapján a natív permissions a régi shell-parser helyettesítésére **korlátozott balesetvédelemként** helyes választás. A fájltool-szabályok, Bash-wrapper/összetett parancs kezelés és alternatív eszközök külön felületet jelentenek; egy snippet nem teljes shell- vagy credentialbiztonsági határ. Az installban jelzett PowerShell-lefedetlenséget nem szabad PASS védelemként átírni. [Claude Code permissions](https://code.claude.com/docs/en/permissions).

A plugin saját default settings felülete nem általános módja consumer permission-denyk automatikus kiosztásának; a projektbe másolandó, ellenőrizendő snippet ezért értelmes. A plugin-agentek bizonyos frontmattermezői figyelmen kívül maradnak, ezért nem szabad őket hatásos enforcementként bemutatni. [Plugin components](https://code.claude.com/docs/en/plugins/components).

A reviewer tényleges agent `tools` korlátozása és a Skill használata natív képesség. Ez különbözik az F08-ban tévesen megfogalmazott skill-grant szemantikától. A dokumentáció frissebb is lehet a pinelt CLI-nél; a saját CLI-próbák ezért csak a valóban kipróbált műveletekre bizonyító erejűek.

**Biztonsági mérleg:** a korábbi guardok szélesebb garanciáinak egy része tudatosan megszűnt. Ezt nem minősítem önmagában hibának, és nem kérem a parser visszaállítását. A szűkebb termékszerződést azonban a README/architecture rövid összefoglalóinak is követniük kell; a „credentials unread” jellegű rövidítés nem lehet abszolút állítás minden eszközre. A jelenlegi konkrét, reprodukált veszély F02 bizonyítéktorzítása és F04 elvesző munka melletti hamis garanciája.

## I. Javítási sorrend és elfogadási kapu

Ez javítási átadás, nem végrehajtott módosításlista. A fájl- és sorhivatkozások az egyes F-leleteknél pontosak.

| Prioritás | Javítás | Elfogadási feltétel |
| --- | --- | --- |
| **P0 / kiadás előtt** | **F04:** sync backupígéret törlése/szűkítése | Kizárt szintetikus fájlra nincs recovery-ígéret; abort jóváhagyása valós veszteséginformáción alapul. |
| **P0 / kiadás előtt** | **F02:** nyers diff textconv nélkül | Marker nem jön létre, a tényleges forráshunk megjelenik, index változatlan. |
| **P1 / kiadás előtt** | **F01:** minden ismétlés friss diffútvonalat használ | Task-resume és revert-proof retry nem ütközik; régi bizonyíték nem íródik felül. |
| **P1 / kiadás előtt** | **F03:** új művelet / aktív konfliktus / scratch megkülönböztetése | Felismert folyamatban lévő konfliktus elér a feloldásig; valódi uncommitted munka nem veszhet el. |
| **P2** | **F05:** indexflag kezelése vagy támogatási korlát | Nincs csendben kihagyott munkatartalom; a valódi index sértetlen. |
| **P2** | **F06:** Vue/Nuxt await állítás javítása | A compiler-preserved top-level await nem automatikus finding. |
| **P2** | **F07:** formatter felelősségének rendezése | Edit/Write útvonalra is egyértelmű, projekt-specifikus viselkedés; nulla hook. |
| **P2** | **F08:** reviewer platformtévedéseinek eltávolítása | Skill-preapproval és agent-eszközkorlátozás helyesen elkülönül; stale batch/grep állítás nincs. |
| **P2** | **F10:** release előfeltétel előrehozása | Nem release-fájl módosulása mellett még írás előtt megáll. |
| **P3** | **F09:** elárvult helperkód törlése | Meglévő tesztek zöldek; nincs új helperkeret. |
| **P3** | **F11:** kötelező minimum fan-out törlése | Egy egyszerű sessionhiba egyetlen célzott elemzéssel is lezárható. |

A javított állapotban a meglévő hét check, az 59 teszt és négy natív strict validate fusson újra, a snapshot hibákhoz célzott viselkedési próbával. A prózai fogyasztói szerződésekhez a megadott resume/conflict/retry forgatókönyveket kell ellenőrizni; fizetős eval csak külön engedéllyel. Nem szükséges új állandó auditframeworket vagy minden módosítást lefogó hookot építeni.

## J. Végső architekturális értékelés

**Az egyszerűsítés valódi és jelentős.** A terv legfontosabb döntései megvalósultak: nincs automatikus parancsintercepció, facts-service, gate-runner, hooklánc, saját CLI-sessiondriver vagy gépi artifactledger. A megmaradt három éles scriptnek konkrét fogyasztója és védhető feladata van. A skillek és referenciák mennyiségét nem indokolt pusztán darabszám alapján tovább csökkenteni.

**A jelenlegi implementáció még nem elég megbízható a jóváhagyáshoz.** A lényegi hibák a kevés megmaradt határfelületen koncentrálódnak: snapshot↔fájlnév, Git-diff↔review-bizonyíték, clean-tree↔folyamatban lévő művelet és review-tree↔helyreállítás. Ezek a meglévő tesztek mellett is fennállnak. Javításuk néhány szűk kód- és szövegkorrekció, nem új architektúra.

A scriptburjánzással szembeni ellenállás ma jóval erősebb, de nem automatikus. A bevált elv maradjon: projektadatot akkor olvasni, amikor kell; projektparancsot közvetlenül futtatni; valóban közös kódot csak bizonyított fogyasztóhoz fenntartani; új kivétellistát vagy frameworköt ne építsünk egy pontatlan szerződés megkerülésére. A következő lépés **F01–F04 javítása**, majd a konkrét holtkód és hamis minimumkövetelmények törlése. A régi rétegek visszaépítését a bizonyíték nem indokolja.

### Auditbizonyítékok

- [Fájlszintű leltár és komponensdiszpozíciók](C:/Users/lidominik02/Desktop/frontend-devkit/temp/post-implementation-audit-2026-10-12/inventory.md)
- [Teljes A/M/D változáslista](C:/Users/lidominik02/Desktop/frontend-devkit/temp/post-implementation-audit-2026-10-12/changes.tsv)
- [Git/snapshot reprodukciók és before/after metrikák](C:/Users/lidominik02/Desktop/frontend-devkit/temp/post-implementation-audit-2026-10-12/probe-results.json)
- [Credential-recovery és natív validator próbák](C:/Users/lidominik02/Desktop/frontend-devkit/temp/post-implementation-audit-2026-10-12/extra-results.json)
- [Snippetegyezés, body-plafonok és célzott legacy-scan](C:/Users/lidominik02/Desktop/frontend-devkit/temp/post-implementation-audit-2026-10-12/inventory-results.json)
- [Az izolált reprodukciók kódja](C:/Users/lidominik02/Desktop/frontend-devkit/temp/post-implementation-audit-2026-10-12/probes.mjs) és [kiegészítő próbák](C:/Users/lidominik02/Desktop/frontend-devkit/temp/post-implementation-audit-2026-10-12/extra-probes.mjs)

A mellékletek az ignorált `temp/` alatt vannak, nem új termékscriptek vagy CI-kapuk. A jelentésben a lényegi reprodukció és eredmény önállóan is szerepel, így a scratchadatok későbbi törlése nem teszi érthetetlenné az ítéletet.
