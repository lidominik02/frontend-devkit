---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---

/vue:vue-engineering

Review this diff. It is a Vue 3 single-page app built with Vite and deployed as static
files to one bucket per environment.

Our pipeline builds once per environment on purpose, and never promotes a bundle from
one environment to the next. Each deploy job runs its own build from the commit, with
that environment's `.env.<mode>` file:

```yaml
deploy-staging:
  script:
    - npm ci
    - npx vite build --mode staging
    - ./scripts/upload.sh dist/ s3://shop-web-staging
deploy-production:
  needs: [deploy-staging]
  when: manual
  script:
    - npm ci
    - npx vite build --mode production
    - ./scripts/upload.sh dist/ s3://shop-web-production
```

`src/config.ts` is the one module in the app that reads `import.meta.env`.

```diff
--- a/.env.staging
+++ b/.env.staging
@@ -1,2 +1,3 @@
 VITE_API_URL=https://api.staging.shop.example
 VITE_CDN_URL=https://cdn.staging.shop.example
+VITE_SEARCH_URL=https://search.staging.shop.example
--- a/.env.production
+++ b/.env.production
@@ -1,2 +1,3 @@
 VITE_API_URL=https://api.shop.example
 VITE_CDN_URL=https://cdn.shop.example
+VITE_SEARCH_URL=https://search.shop.example
--- a/src/config.ts
+++ b/src/config.ts
@@ -1,4 +1,5 @@
 export const config = {
   apiUrl: import.meta.env.VITE_API_URL,
   cdnUrl: import.meta.env.VITE_CDN_URL,
+  searchUrl: import.meta.env.VITE_SEARCH_URL,
 } as const
--- a/src/features/search/searchClient.ts
+++ b/src/features/search/searchClient.ts
@@ -1,6 +1,6 @@
 import { config } from '@/config'

 export async function searchProducts(query: string, signal?: AbortSignal) {
-  const res = await fetch(`${config.apiUrl}/search?q=${encodeURIComponent(query)}`, { signal })
+  const res = await fetch(`${config.searchUrl}/v2/products?q=${encodeURIComponent(query)}`, { signal })
   if (!res.ok) throw new Error(`Search failed: ${res.status}`)
   return res.json()
 }
```
