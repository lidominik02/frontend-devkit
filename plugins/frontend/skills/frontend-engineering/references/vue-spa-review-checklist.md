# Vue SPA review checklist

**This is a delta. Run the `vue-*` set's review checklist first,** then apply this list.

## Blocking (Critical)

**Lost reactivity in a query.** A query whose input is a plain value, so it never
refetches.

## Warning

- A route component imported statically rather than lazily, or a heavy library pulled
  into the entry chunk.

Only when one built artifact is promoted across environments (`vue-spa-env-and-config.md`):

- `import.meta.env` read outside the one module allowed to.
- `/config.json` or `index.html` served without a no-store header.
- A boot path that can fail to a blank page.
