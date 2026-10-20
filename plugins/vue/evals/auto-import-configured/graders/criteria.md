---
type: llm
weight: 1
---

A negative test: the `vite.config.ts` in the prompt imports `unplugin-auto-import` (with
the `vue` and `vue-router` presets) and `unplugin-vue-components`, so `ref`, `computed`
and `<BaseButton>` need no import in the component under review. The defect is treating
the missing imports as a finding when the project's configuration supplies them. Only the
handling of those three missing imports is graded; any other observation about the
component is ignored.

Expected baseline: pass. The baseline arm is `core` alone, as the vue evals README sets it.
The case is kept as a regression guard. Its other half, that the `core` + `vue` arm fails
under the pack's earlier explicit-imports rule, which had no exception for a project that
opts in, can only be observed by loading the `vue-engineering` text from before that change
(an earlier commit, through `--plugin-dir`); it is not part of the planned run.

Two kinds of note are not findings in either list below: an optional style note that explicit
imports would read more clearly, labelled Nit, Minor or Suggestion, which says nothing is
wrong and asks for no change; and a note that the generated `.d.ts` files (`auto-imports.d.ts`,
`components.d.ts`) must be in the tsconfig `include` for type-checking, which accepts that the
plugins resolve these identifiers at build time.

A fails-if hit fails the answer even when every passes-if clause is met.

Passes if it does ALL of:
- Raises no finding about the missing imports of `ref`, `computed` or `BaseButton`.
- Names the configured plugins as the reason those identifiers resolve: for `ref` and
  `computed`, `AutoImport` (with or without parentheses), `unplugin-auto-import`, or a
  reference that ties the auto-import plugin to the shown `vite.config.ts`; for
  `BaseButton`, `Components` (with or without parentheses), `unplugin-vue-components`, or a
  reference that ties the component plugin to the shown `vite.config.ts`. A generic phrase
  that points at nothing in the config — the plain word "components", or "auto-import"
  with no plugin — does not meet this. A review that never mentions imports does not meet
  this clause, and neither does a hedge that ignores the shown configuration, such as
  "this works only if auto-imports are set up".

Fails if it does ANY of:
- Says the component does not compile, throws a `ReferenceError`, or that `ref`, `computed`
  or `BaseButton` is undefined or unresolved. Saying only that `BaseButton.vue` cannot be
  opened or is not found in the sandbox or workspace, so its resolution cannot be
  confirmed, is not this.
- Requires or requests adding an `import` for `ref`, `computed` or `BaseButton` before
  merge, or lists their absence as a finding of any severity (Blocking, Critical, Major,
  Minor, Nit or otherwise) that asks for a change. "Consider adding imports" is a request,
  unless the answer explicitly marks it optional or says no change is needed.
