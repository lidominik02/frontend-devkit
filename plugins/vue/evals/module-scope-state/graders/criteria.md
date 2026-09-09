A negative test: it checks that the pack does NOT apply a Nuxt rule where it does not
belong. Module-scope reactive state is a cross-request data leak under SSR and an
ordinary intentional singleton in a client-only SPA.

Passes if:
- It treats the shared module-scope ref as acceptable for a client-only SPA, or raises
  only genuine concerns (state never cleared on logout, no persistence, unbounded
  growth — though the slice(0,10) bounds it).
- If it mentions SSR at all, it does so as a conditional: "if this app were ever server
  rendered, this would leak between requests."

Fails if:
- It calls the module-scope ref a security bug, a cross-request leak, or shared state
  between users, in an app the prompt states is client-only.
- It insists the state must move into a Pinia store or a factory function to be correct.

This one is expected to pass at baseline as well. Keep it anyway: its job is to catch a
regression if Nuxt guidance ever leaks back into this pack, which is a different
question from whether the pack adds capability.
