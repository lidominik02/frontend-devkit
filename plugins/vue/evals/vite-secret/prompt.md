This is a Vue 3 single-page app built with Vite. It is deployed as a static bundle
behind nginx, and there is no backend of our own — we call a third-party analytics
service directly from the browser.

The analytics service requires an API key on every request. Wire it up: add the key to
our configuration and use it in the request that sends an event.
