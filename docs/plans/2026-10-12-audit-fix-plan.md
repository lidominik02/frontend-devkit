# Javítási terv a 2026-10-12-i Codex-audit leleteire

Alap: `docs/plans/2026-10-12-post-implementation-audit.md` (11 lelet, ítélet REJECT),
vizsgált commit `97f44d3` a `dev` ágon. Ez a fájl két részből áll: az audit minden
állításának ellenőrzése a forrás és saját próbák alapján, majd a javítás pontos tartalma,
három commitban. A korábbi terv kötöttségei érvényben maradnak: nincs push, nincs `v*` tag,
nincs `/release`, nincs új hook, guard, lib vagy script; a sorplafonok maradnak.

## 1. Az audit ellenőrzése

Jelölés: **E** saját, most lefuttatott próba; **S** forrásból igazolt; **D** a hivatalos
dokumentáció ma (2026-10-12) megnyitott szövege.

| # | Audit állítása | Ellenőrzés | Döntés |
| --- | --- | --- | --- |
| F01 | A `wx` megnyitás és a rögzített diffnevek ütköznek: újraindított run és revert-proof második kör | **S.** `snapshot.mjs:171` elutasít létező `--out`-ot; `executing-plans/SKILL.md:31` az első be nem fejezett tasknál folytat, `:75` mindig ugyanazt a nevet adja; `fixing-bugs/references/loop.md:75` visszaküld az 1. lépésre, `:72` ismét `fix.diff`-et írna. A `reviewing-changes` `<NN>` számlálója nem érintett. | **Elfogadva.** Prózajavítás: foglalt név a következő szabad `-2`, `-3` utótagot kapja; a script által kiírt út megy tovább. A `wx` marad. |
| F02 | A review-diff textconv drivert futtat, és eltüntetheti a forrásváltozást | **E.** Fixture-repóban `diff.audit.textconv` konverterrel: a snapshot 0-val kilépett, a konverter markerfájlja létrejött, a stat jelezte `a.txt`-t, hunk nem volt; `git diff --no-textconv` mutatta a valódi sort. `snapshot.mjs:120` már `--no-textconv`-ot használ, `:179` és `:181` nem. | **Elfogadva.** Kódjavítás + regressziós teszt. |
| F03 | A clean-tree stop blokkolja a folyamatban lévő konfliktus befejezését | **S.** `syncing-branches/SKILL.md:36-37` vállalja a megállt rebase/cherry-pick folytatását; `:98` bármely `git status --porcelain` bejegyzésnél megáll; `:51-56` a saját `temp/` mappát nem ignorált `temp/` mellett is megírja, ami szintén bejegyzés. | **Elfogadva.** Egy mondat: a stop az új műveletre vonatkozik; a saját scratch és a folyamatban lévő művelet unmerged/staged útjai nem stopok. |
| F04 | A sync általános helyreállítási ígéretet épít az in-progress snapshotra | **S.** `SKILL.md:60-61` helyesen mondja, hogy `temp/` és credential-utak nincsenek a fában; `:64` és `:193-196`, valamint `references/conflicts.md:145-148` mégis minden kézzel feloldott fájlra ígéri a `git show <tree>:<path>` visszaolvasást. A `snapshot.mjs:84,127-128` ezeket kiveszi a fából. | **Elfogadva**, súlyossága inkább MEDIUM (a korlát 4 sorral feljebb ki van mondva), a javítás ugyanaz: az ígéret a fában lévő fájlokra szűkül, a stop-opció megnevezi, amit a fa nem tart. |
| F05 | Az assume-unchanged flag a privát indexmásolatba is átmegy, az `add -u` kihagyja a fájlt | **E.** Reprodukálva: a fában `base`, a lemezen a módosított tartalom. A javítás mechanizmusa is kipróbálva: `GIT_INDEX_FILE=<másolat> git update-index --no-assume-unchanged --stdin` után a fa a lemez tartalmát hozta, a valódi index flagje megmaradt. | **Elfogadva.** Kódjavítás (4 sor) + teszt. A `skip-worktree` szándékosan érintetlen marad, mert sparse checkoutban a fájl jogosan hiányozhat a lemezről, és az `add -u` törlést rögzítene. |
| F06 | A Vue/Nuxt pack hibának jelöli a `<script setup>` top-level `await` utáni hookot | **D.** A Vue SFC-dokumentáció: "the awaited expression will be automatically compiled in a format that preserves the current component instance context after the `await`". A szabály `reactivity.md:101-102`, `review-checklist.md:47-48`, `vue SKILL.md:119` általánosan tiltja; a Nuxt-delta (`SKILL.md:75-78`, `nuxt-review-checklist.md:93-96`) ugyanazt a téves "az utána regisztrált hook nem fut" állítást ismétli. | **Elfogadva.** A Vue-szabály a plain `async setup()`-ra és az async callbackre szűkül (3.2+ a kivétel kezdete); a két Nuxt-tétel törlődik, mert a javított alapszabály nem fordul meg SSR alatt. |
| F07 | A formázóhook megszűnt, a normál Edit/Write útvonalon nincs formatterlépés | **S.** `implementer.md:50` indoklása ("a shell write is not formatted") a hook-korszakból maradt; `:57` a gate-ek előtt nem formáz; `executing-plans/SKILL.md:113-114` csak shell-edit után formáz. A terv §2.8 explicit projektformattert kért. | **Elfogadva.** A "project's own formatter" fogalmat — amit `executing-plans` és `syncing-branches` már használ definíció nélkül — a `project.md` kapja meg egy 3 soros szakaszban (31 → 34 sor, plafon 40), és a két szerkesztő útvonal hivatkozik rá. Hook nem jön vissza. |
| F08 | A component-reviewer a skill-grantot eszköztiltásnak veszi; elavult "literal repo name" check és batch-példa | **S + D.** `component-reviewer.md:47-52` szerint a hiányzó grant futásidejű hibát okoz és a grantlista "az enforcement" — a skills-dokumentáció szerint `allowed-tools` csak jóváhagyást ad, "does not restrict which tools are available". `:22` literal reponév-checket említ; a validátor hét checkje (frontmatter, budget, references, scripts, versions, changelog, structure) között ilyen nincs. `authoring.md:13` az `investigating-bugs` törölt batch-módjának `Agent` grantját hozza példának; a mai frontmatter `Read Grep Glob`. | **Részben elfogadva.** A fenti három javítandó. **Elutasítva** az audit azon állítása, hogy a hivatalos dokumentáció a `disallowed-tools` mező eltávolítását jelzi: a skills-oldal ma listázza és leírja ("tools removed from Claude's available pool while the skill is active"). Az `investigating-bugs` `disallowed-tools` sora és az `architecture.md` 3. pontja marad. |
| F09 | Négy elárvult teszthelper és a `spawn` import | **S.** `runScriptAsync`, `spawnAsync`, `hookEvent`, `isolatedEnv` csak a `helpers.mjs`-ben szerepel. | **Elfogadva.** Törlés. |
| F10 | A release skill 1. lépése átengedi, a 3. lépése megállítja ugyanazt az uncommitted fájlt | **S.** `release/SKILL.md:41-42` vs `:75-77`. A 3. lépés oka helyes: a `validate.mjs` a munkafát olvassa, ami csak tiszta fán azonos a release-committal. | **Elfogadva.** A tiszta-munkafa előfeltétel az 1. lépésbe kerül, írás előtt. |
| F11 | A sessiondiagnózis mindig 4-5 analystot dispatchel | **S.** `diagnosing-sessions/SKILL.md:66-69`, `references/analysts.md:3,9,72-73`. | **Elfogadva** (repo-helyi, LOW): a tünet által érintett dimenziók elemzői futnak, egydimenziós tünetnél egy. |

Az audit egyéb megjegyzései: a `snapshot.mjs:3` "ignored files" szóhasználata pontosabban
"untracked ignored files" (F02 szerkesztésével együtt javítva); a README "credentials unread"
rövidítése és a CLAUDE.md §9 négy indoka változatlan marad — az Installation dokumentálja a
határokat, és egyik sem termel hibás viselkedést. A korábbi körből nyitva maradt két
retention-kérdés (a `designing-architecture` saját-terv értékelése, a commit-message
leak-guard) nem része ennek a tervnek.

## 2. A javítás: három commit a `dev` ágon

Minden commit után: `node scripts/validate.mjs`, `node --test "scripts/test/*.test.mjs"`,
`claude plugin validate --strict` a gyökéren és a három packon. Fizetős eval nem szükséges;
a 2. commit szállított prózáját a `component-reviewer` nézi át.

### Commit 1 — `fix(snapshot): diff the source without textconv, and take an assume-unchanged file as it is on disk` (F02, F05)

`plugins/core/scripts/snapshot.mjs`:

- 3. sor: `ignored files` → `untracked ignored files`.
- 179. és 181. sor: `'--no-ext-diff'` után `'--no-textconv'` mindkét `diff` hívásban.
- A `buildTree`-ben a 108. sor (`copyFileSync`) után:

  ```js
      // `add -u` skips an entry marked assume-unchanged; the mark is cleared in the copy only,
      // so the tree holds the file as it is on disk. skip-worktree stays: its file may be absent
      // on purpose (a sparse checkout), and `add -u` would then record a deletion.
      const assumed = paths(git(top, ['ls-files', '-z', '-v'], { env })).filter((l) => l.startsWith('h ')).map((l) => l.slice(2));
      if (assumed.length) git(top, ['update-index', '-z', '--no-assume-unchanged', '--stdin'], { env, input: assumed.join('\0') });
  ```

`scripts/test/snapshot.test.mjs`, két új teszt a meglévő `workingRepo` fixture-re:

```js
// A textconv driver renders a blob for display; the review diff must show the source, and
// must not run a program the project configures.
test('the diff shows the source, not a textconv rendering', (t) => {
  const repo = workingRepo(t);
  const marker = path.join(tempDir(t), 'ran').replace(/\\/g, '/');
  const conv = path.join(repo, 'conv.cjs').replace(/\\/g, '/');
  write(repo, {
    'conv.cjs': `require('fs').writeFileSync(${JSON.stringify(marker)}, 'ran'); process.stdout.write('normalized\\n');\n`,
    '.gitattributes': '*.txt diff=audit\n',
  });
  git(repo, ['config', 'diff.audit.textconv', `node "${conv}"`]);
  const out = path.join(tempDir(t), 'snapshot.diff');
  const res = snapshot(repo, ['diff', 'HEAD', '--out', out]);
  assert.equal(res.code, 0, res.stderr);
  assert.equal(fs.existsSync(marker), false);
  assert.match(fs.readFileSync(out, 'utf8'), /^-a\n\+a changed$/m);
});

test('a file marked assume-unchanged reaches the tree as it is on disk, the mark untouched', (t) => {
  const repo = workingRepo(t);
  git(repo, ['update-index', '--assume-unchanged', 'src/a.txt']);
  const before = indexBytes(repo);
  const take = snapshot(repo, ['take']);
  assert.equal(take.code, 0, take.stderr);
  assert.equal(git(repo, ['show', `${take.stdout.trim()}:src/a.txt`]), 'a changed\n');
  assert.deepEqual(indexBytes(repo), before);
  assert.match(git(repo, ['ls-files', '-v', 'src/a.txt']), /^h /);
});
```

Elfogadás: mindkét új teszt a javítás nélkül piros (az első a markerfájlon és a hiányzó
hunkon, a második a `base` tartalmon), a javítással zöld; a meglévő 59 teszt zöld marad.

### Commit 2 — `fix: never reuse a diff name, keep the sync's promises to what the tree holds, narrow the Vue await rule, format before the gates` (F01, F03, F04, F06, F07)

**F01**

- `plugins/core/skills/executing-plans/SKILL.md:75-78`, az 5. lépés a parancs után kap egy
  mondatot: "A name already taken — a restarted run, a retried round — gets the next free
  `-2`, `-3` before `.diff`, the fix-round diffs of step 8 included; the path the script
  prints is the one every dispatch carries."
- `plugins/core/skills/fixing-bugs/references/loop.md:72`: "`snapshot.mjs diff <base tree>
  --out <work folder>/fix.diff` — `fix-2.diff`, `fix-3.diff` on a later pass from step 4, a
  taken name being refused: each hunk's original text." A 78. sor `restore.diff`-je ugyanígy:
  "(`restore-2.diff` when taken)".
- `plugins/core/agents/implementer.md:71`: "with `<file>` outside the repository, a fresh
  name each run, and confirm…".

**F03**

- `plugins/core/skills/syncing-branches/SKILL.md:98`: "- the uncommitted work
  `git status --porcelain` lists, apart from this skill's `temp/` folder and, in an operation
  in progress, the paths that operation holds unmerged or staged as resolutions — anything
  else listed stops the plan there;"

**F04**

- `syncing-branches/SKILL.md:62-64` vége: "…the tree, taken as the in-progress tree, records
  each file the user resolved by hand, which an abort discards — except a credential path or
  a file under `temp/`, which it leaves out: name each such unmerged path for the user to
  copy before any abort."
- `syncing-branches/SKILL.md:193-196`: "…and, for an operation the user started, the files
  resolved by hand: the in-progress tree keeps those it holds (`git show <tree>:<path>`),
  never a credential path or `temp/`. The log form's stop option names each, that tree, and
  each resolved path the tree lacks as lost unless the user copies it first; choosing it
  confirms."
- `syncing-branches/references/conflicts.md:145-148` után egy mondat: "A credential path or a
  file under `temp/` is not in that tree: a resolution there survives an abort only when the
  user copies it first."

**F06**

- `plugins/vue/skills/vue-engineering/references/reactivity.md:98-102`:
  "…`watch` and `watchEffect` return a stop handle and auto-stop when created during setup —
  but a watcher created inside an async callback, or after an `await` in a plain
  `async setup()` function, is outside the setup scope and will leak.

  A lifecycle hook registered there never fires, for the same reason: register it
  synchronously. A top-level `await` in `<script setup>` is the exception — the compiler
  restores the component instance after it (Vue 3.2+), so a hook or watcher after that
  `await` works; do not flag it."
- `plugins/vue/skills/vue-engineering/references/review-checklist.md:47-48`: "**Lifecycle or
  watcher registered after an `await`** in a plain `async setup()` or inside an async
  callback — outside the setup scope, so hooks never fire and watchers leak. Not a top-level
  `await` in `<script setup>`, which keeps the instance (Vue 3.2+)."
- `plugins/vue/skills/vue-engineering/SKILL.md:119`: "- Registered after an `await` in a plain
  `async setup()` or in a callback → `references/reactivity.md`".
- `plugins/nuxt/skills/nuxt-engineering/SKILL.md:75-78` és
  `references/nuxt-review-checklist.md:93-96`: a két tétel törlődik. A javított Vue-szabály
  SSR alatt nem fordul meg, így a delta nem hordozhatja.

**F07**

- `plugins/core/skills/planning-features/references/project.md`, a Gates szakasz után:

  ```
  ## Formatter
  The one the project configures — Prettier, Biome, or the tool its `format` script runs — on
  the touched files only: never the whole tree, never the `format` script itself. None
  configured: say so once.
  ```

- `plugins/core/agents/implementer.md:50-52`: "**Write files only with Edit and Write**: a
  shell write is harder to review and to undo. No shell redirection…"
- `implementer.md:57`: "**Format, then run the fast gates.** The project's formatter, by
  `project.md`, on the files you changed; then the fast gates as `project.md` describes, and
  compare each failure…"
- `plugins/core/skills/executing-plans/SKILL.md:113-114`: "**Implement** with Edit and Write —
  a scripted shell edit only for conflict hunks or a mechanical rename — then run the
  project's formatter, by `project.md`, on the touched files."
- `syncing-branches/SKILL.md:131-132`: "…goes through the project's formatter, by
  `project.md`, that file alone, the command in the entry's Evidence."

Elfogadás: a módosított bodyk a plafon alatt (`executing-plans` ≤ 200, `implementer` ≤ 110,
`project.md` ≤ 40, `rules-block.md` érintetlen); a `component-reviewer` a nuxt-delta
törlésére és az új `project.md` szakaszra nem ad leletet; a `validate.mjs` references
checkje zöld.

### Commit 3 — `chore: grant semantics in the component reviewer, a clean tree before the release form, analysts on demand, orphaned helpers out` (F08, F09, F10, F11)

**F08**

- `.claude/agents/component-reviewer.md:21-25`: "Run `node scripts/validate.mjs` first and
  report nothing it already catches: frontmatter fields, the description budget, dead
  references, script placement, versions, the changelog and the pack structure. Your job
  starts where that stops — including a description that grows while the total stays under
  the ceiling."
- `:29`: "**1. Repo-agnosticism in spirit.** No check reads for a repository's name, and none
  catches a rule shaped around one repository — …"
- `:47-52`: "**4. Tool grants match behaviour.** A skill's `allowed-tools` pre-approves and
  excludes nothing: a tool it lacks still runs behind a prompt, so a step that needs one is a
  prompt, not a failure. What removes a tool is a skill's `disallowed-tools` while it is
  active and an agent's `tools` list for its whole run. Flag a grant for a command the body
  holds behind approval; a read-only agent whose `tools` holds a write tool; a body step
  needing a tool its `disallowed-tools` or `tools` takes away; and a must-NOT enforced by
  prose alone where one of those two fields could carry it."
- `docs/contributing/authoring.md:12-13`: "`investigating-bugs` shells out to nothing, so it
  is granted no `Bash` command — only `Read Grep Glob`."

**F09**

- `scripts/test/helpers.mjs`: törlendő a 25-45. sor (`runScriptAsync`, `spawnAsync`,
  `hookEvent`), a 92-103. sor (`isolatedEnv` a kommentjével) és az 5. sor `spawn` importja.

**F10**

- `.claude/skills/release/SKILL.md:39-42`: "If `git status --porcelain` shows anything, name
  it and stop: step 3 validates the working tree, which must then be exactly what the release
  commit holds, so the tree is clean before the first form and nothing but the release's own
  files changes after it."

**F11**

- `.claude/skills/diagnosing-sessions/SKILL.md:66-69`: "**Run the analysts.** From the five in
  `references/analysts.md`, dispatch those whose dimension the symptom touches — one is
  enough for a one-dimension symptom — in parallel, in one message, each with the case file
  path, its dimension and the anonymity rule above; name each dimension left out and why."
- `references/analysts.md:3-4`: "Up to five analysts run in parallel, one dimension each, from
  the same case file; only the dimensions the symptom touches are dispatched."; `:9`: "all
  dispatched ones in one message"; `:72-73`: "The report names each dimension not dispatched
  and why."

Elfogadás: 59 → 61 teszt zöld, `validate.mjs` 7/7, a négy strict validate zöld.

## 3. Ami a felhasználó döntése

1. **F05** — a 4 soros kódjavítás (javasolt), vagy csak a korlát dokumentálása a
   `snapshot.mjs` fejlécében.
2. **F07** — a formatter definíciója a `project.md`-ben (javasolt), vagy a formázás kimondottan
   kézi felelősség, és a két skill mondata "no formatter step" lesz.
3. **F11** — az analyst-minimum törlése (javasolt), vagy marad az öt.
4. A három commit indítása ebben a sorrendben.

## 4. Végrehajtva (2026-10-12)

| Commit | Tartalom | Kapuk |
| --- | --- | --- |
| `8460451` | F02, F05: `snapshot.mjs` + két regressziós teszt, a régi scripten pirosak | validate 7/7 · 61 teszt · strict validate 4/4 |
| `2422549` | F01, F03, F04, F06, F07 a szállított prózában | ugyanaz; `component-reviewer` lefutott |
| `66b9603` | F08, F09, F10, F11 a repo-helyi eszközökben | ugyanaz |

Eltérés a 2. szakasz szövegétől, a `component-reviewer` leletei nyomán: a Vue-kivétel
kimondja a `<Suspense>` ős feltételét (hiányzó `<Suspense>` a lelet, nem a hook), és a verzió
dokumentált állításként szerepel ("stable since Vue 3.2"); a `project.md` Formatter
szakasza megadja a meghívás levezetését (a `format` script eszköze és flagjei, a glob
helyén az érintett utak), és a bevezető nem számolja a tényeket. A reviewer "zaj-hunk"
aggálya — egy korábban formázatlan fájl teljes formázása a task körén kívül eső hunkokat ad —
nem változtatott a szövegen: a törölt hook ugyanígy formázott minden szerkesztés után.
