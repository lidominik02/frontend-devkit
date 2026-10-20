---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---

/vue:vue-engineering

Review this diff. It is a Vue 3 single-page app built with Vite and deployed as static
files to one bucket per environment.

Our pipeline builds once and promotes that bundle. The build job uploads `dist/` as an
artifact; staging deploys it, and production deploys the identical artifact after
sign-off. Nothing is rebuilt per environment. What differs per environment is the
`config.json` each deploy job uploads next to the bundle:

```yaml
build:
  script:
    - npm ci
    - npx vite build
  artifacts:
    paths: [dist/]
deploy-staging:
  needs: [build]
  script:
    - ./scripts/upload.sh dist/ s3://shop-web-staging
    - ./scripts/upload.sh config/staging.json s3://shop-web-staging/config.json
deploy-production:
  needs: [deploy-staging]
  when: manual
  script:
    - ./scripts/upload.sh dist/ s3://shop-web-production
    - ./scripts/upload.sh config/production.json s3://shop-web-production/config.json
```

`src/config.ts` is the one module in the app that reads configuration; `main.ts` awaits
`loadConfig()` before mounting.

```diff
--- a/.env.production
+++ b/.env.production
@@ -1 +1,2 @@
 VITE_RELEASE_CHANNEL=web
+VITE_SEARCH_URL=https://search.shop.example
--- a/src/config.ts
+++ b/src/config.ts
@@ -1,15 +1,17 @@
 export interface AppConfig {
   apiUrl: string
   cdnUrl: string
 }

 let runtime: AppConfig | undefined

 export async function loadConfig(): Promise<void> {
   runtime = await (await fetch('/config.json')).json()
 }

 export function config(): AppConfig {
   if (!runtime) throw new Error('loadConfig() has not run')
   return runtime
 }
+
+export const searchUrl = import.meta.env.VITE_SEARCH_URL
--- a/src/features/search/searchClient.ts
+++ b/src/features/search/searchClient.ts
@@ -1,7 +1,7 @@
-import { config } from '@/config'
+import { config, searchUrl } from '@/config'

 export async function searchProducts(query: string, signal?: AbortSignal) {
-  const res = await fetch(`${config().apiUrl}/search?q=${encodeURIComponent(query)}`, { signal })
+  const res = await fetch(`${searchUrl}/v2/products?q=${encodeURIComponent(query)}`, { signal })
   if (!res.ok) throw new Error(`Search failed: ${res.status}`)
   return res.json()
 }
```
