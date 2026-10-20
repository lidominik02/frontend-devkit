# Evals for the `nuxt` pack

## Why these exist

Same retention rule as every pack here — a component survives only if an ablation shows
it adds capability. The methodology, the manual run procedure and how to write a case
are in `plugins/core/evals/README.md`; this file covers only what is specific to this
pack.

## What each case tests

| Case | The claim under test |
| --- | --- |
| `ssr-shared-state` | Module-scope reactive state is a cross-request data leak under SSR, where the identical code is an ordinary singleton in an SPA |
| `cookie-independent-ref` | Each `useCookie` call returns its own ref, and cross-instance sync is asynchronous, not immediate |
| `hydration-fix-pins-clock` | Moving a hydration-mismatched time value into `useState` silences the warning by freezing it to the server's clock, not by fixing it, unless the label means server time and the format is fixed |
| `payload-rich-types` (regression guard) | A `Date` and a `Set` in `useState` reach the client as themselves (devalue, every Nuxt 3+ version), so the review comment that they arrive as a string and `{}` and need converting is wrong |

`cookie-independent-ref` and `hydration-fix-pins-clock` were run by hand with `claude -p`,
not the automated harness — see `plugins/core/evals/README.md` for why.
`payload-rich-types` is a regression guard, expected to pass at baseline and to fail only
if the pack teaches the conversion. Every case's latest run is recorded under "The
2026-10-14 run" or "The 2026-10-20 run" below. Four other
candidates from the same research pass — a plain async function losing Nuxt's request
context after an `await`, a missing `runtimeConfig.public` key, `setup` running twice
under hydration, and an un-awaited `navigateTo` outside middleware — were tested the same
way and dropped: a bare Sonnet 5, with no plugin at all, already answered every one of
them correctly.

Splitting `nuxt` out of `vue` costs a plugin to maintain and a second description in the
always-on listing. The evidence that it is worth it is not that the Nuxt guidance is
correct — it is that **a plain `vue` install gets the same question wrong.**

## The 2026-10-14 run

Every case was run twice per arm, `core` + `vue` + `nuxt` against `core` + `vue`, with the
manual `claude -p` rig on Claude Code 2.1.299, model `claude-opus-5-5`, graded by hand per
criterion line, on Windows 10 (10.0.19045), with the packs loaded from the working tree
through `--plugin-dir`. User-level instructions reached both arms; no run used `--bare`.

**`payload-rich-types` held with the pack: both runs pass.** The baseline passed one run and
failed the other on the version fails-if line: it said `Date` and `Set` survive the payload
only "since Nuxt 3.4".

**`ssr-shared-state` passed one run of two with the pack, and none without**, so the matched
pair's SSR half did not hold on this run; the FAIL stands as recorded. Every run in
both arms named the cross-request leak and reached for `useState`; the FAILs are its fourth
passes-if line — no mention that the initialiser must be a function, that the value must be
serialisable for the payload, or that the key is global. With the pack, one run said "The
initial value must be a function" and that the key "must be unique across the app"; the
other said only that `useState` carries the state "to the client in the payload".

The skill body's `useState` line was then rewritten to name all three — the key is global
to the app, the initialiser is a function, the value goes into the payload — and the pair
ran again, two runs per arm, same rig and CLI. **`ssr-shared-state` came back the same: one
run of two with the pack, none without; the FAIL stands.** The passing run said "The
initialiser has to be a function" and "The key has to be unique across the app"; the
failing one said only that Nuxt "puts the value in the payload", and every baseline run
named the payload only as how the value reaches the client. `module-scope-state` passed all
four runs. Those runs used that wording before the payload type note was restored.

A final re-run on the shipped text, with the note, two runs per arm with the same rig and CLI,
**passed `ssr-shared-state` in both runs with the pack and in neither without.** Both pack
runs said the initialiser must be a function and the key must be unique across the app; one
baseline run made `useCookie` the fix, and both named the payload only as how the value
reaches the client. `module-scope-state` passed all four runs. Two runs per arm is a small
sample: the two earlier runs were one of two each with the pack.

**`hydration-fix-pins-clock` passed one run of two in each arm**, so this run does not
separate them. Both FAILs miss the third passes-if line: the fix offered for the visitor's
local time reads back the `useState` value, so it still shows the server's instant — the
pack run passed that value to `<NuxtTime>`, the baseline run formatted it in `onMounted`. The
pack run also misses the second passes-if line: it never says the value is not the time the
page loaded for that visitor.

**`cookie-independent-ref` passed all four runs**, the `core` + `vue` baseline included.

Only `ssr-shared-state` separated the arms on this run, and narrowly — one run of two with
the pack against none without; `payload-rich-types` differed by one baseline FAIL on a
regression guard, and every other case scored the same in both arms.

## The 2026-10-20 run

`ssr-shared-state` was run again after the `vue` pack's reactivity reference and review
checklist changed, two runs per arm, `core` + `vue` + `nuxt` against `core` + `vue`, on the
rig of the `vue` evals README's "The 2026-10-20 run" — the same CLI, model, OS and loading
as above, plus `--add-dir` for each loaded pack. **It passed both runs with the pack and
neither without**, as on the final 2026-10-14 re-run. Both pack runs said the initialiser
must be a function. Both baseline runs found the leak and reached for `useState`, but
neither met the mechanism line: one named the payload only as how the value reaches the
client, the other only hydration. `module-scope-state`, its mirror, passed all four runs
in the same pass.

## The matched pair

`ssr-shared-state` is the deliberate mirror of `plugins/vue/evals/module-scope-state/`:
the same code in the opposite environment.

| Case | Correct verdict | What it guards |
| --- | --- | --- |
| `vue` / `module-scope-state` | **not** a bug (client-only SPA) | Nuxt guidance leaking into the SPA pack |
| `nuxt` / `ssr-shared-state` | **Critical** (server-rendered) | The SPA rule being applied under SSR |

**The pair is the instrument. Run both whenever either changes.** Either case alone
measures nothing: a pack that calls module-scope state a leak everywhere passes one and
fails the other, and a pack that calls it fine everywhere does the reverse.

## Running the `nuxt` arm

**Enable `core`, `vue` and `nuxt` together.** `nuxt` depends on `vue`, so that is what
ships, and both skill bodies can trigger on a `.vue` file with no guaranteed ordering. A
`nuxt`-only arm measures a configuration no user has, and would credit the suppression
block for a conflict it was never asked to resolve.

The baseline arm is **`core` + `vue`, without `nuxt`** — not "no plugins". The question
is whether the `nuxt` pack changes the answer, and the plain-Vue pack actively asserts
the opposite conclusion, so a bare-model baseline would understate the gap.
