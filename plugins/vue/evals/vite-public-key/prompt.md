---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---

/vue:vue-engineering

This is a Vue 3 single-page app built with Vite. It is deployed as a static bundle
behind nginx, and there is no backend of our own — we call a third-party analytics
service directly from the browser.

The analytics service requires an API key on every request, and its docs call the key a
public browser key, restricted to the origins we allow in the service's dashboard. Wire
it up: add the key to our configuration and use it in the request that sends an event.
