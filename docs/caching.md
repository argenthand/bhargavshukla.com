# Edge cache and webhook purge

Goal: near-static speed, with content changes live within seconds and no frontend redeploy.

## Constraints (from Cloudflare docs, checked 2026-09-28)

- `cache.delete()` only purges the **one data center** where the Worker runs, so it can't be used for global invalidation.
- Purge by URL doesn't work for entries stored with the Cache API.
- Purge by **`Cache-Tag`** does work on Cache API entries and is on the **Free plan**: 5 requests/min (bucket of 25), up to 100 tags per request, limits shared per account.
- The Cache API only works on the **custom domain**, not `*.workers.dev`.

## Tagging strategy

Each page is tagged with the **content types it read**: `type:post`, `type:snippet`, `type:project`, `type:book-review`, `type:tag`.

Publishing any post purges `type:post`, which clears every page that shows posts: the post itself, `/blog`, `/`, `/tags/*`, RSS, sitemap, and SvelteKit's `__data.json` for client-side navigation. A renamed slug can't leave a stale page behind. Per-document tags would add bookkeeping for no benefit at this scale.

## Implementation

### 1. Types — `src/app.d.ts`

Run `pnpm wrangler types` to generate `Env`, then:

```ts
interface Locals {
	cacheTags: Set<string>;
}
interface Platform {
	env: Env;
	ctx: ExecutionContext;
	caches: CacheStorage & { default: Cache };
	cf?: IncomingRequestCfProperties;
}
```

### 2. Strapi client — `src/lib/server/strapi.ts`

- One map: `MODELS = { post: 'posts', snippet: 'snippets', project: 'projects', 'book-review': 'book-reviews', tag: 'tags' }` (model name → REST path).
- `strapi(locals).find(model, query)` builds the URL with `qs`, sends `Authorization: Bearer ${STRAPI_TOKEN}`, and calls `locals.cacheTags.add('type:' + model)`.
- Populating the Tag relation also adds `type:tag`.

### 3. Hook — `src/hooks.server.ts` + `src/lib/server/edge-cache.ts`

1. Set `event.locals.cacheTags = new Set()`.
2. **Bypass** (plain `resolve`) when: no `platform` (local dev), method isn't `GET`, path starts with `/api/`, or a preview cookie is present.
3. **Cache key** = origin + pathname + allowlisted query params (only `page`), sorted. Everything else is dropped.
4. `hit = await platform.caches.default.match(key)`. On a hit, return it with `x-edge-cache: HIT` and browser `Cache-Control: public, max-age=0, must-revalidate`.
5. On a miss, `response = await resolve(event)`.
6. Cache only if `status === 200 && locals.cacheTags.size > 0`. Store a clone with `Cache-Control: public, max-age=${EDGE_TTL}` and `Cache-Tag: <tags joined by commas>` via `platform.ctx.waitUntil(cache.put(key, stored))`.
7. Return to the browser with `x-edge-cache: MISS`, `Cache-Tag` removed, and the browser `Cache-Control` from step 4.

`EDGE_TTL = 600` (10 minutes). It only bounds staleness if a purge fails; raise it once purging has proven reliable.

### 4. Purge endpoint — `src/routes/api/purge/+server.ts` + `src/lib/server/purge.ts`

- **Auth:** `Authorization: Bearer ${PURGE_SECRET}`, compared with `crypto.subtle.timingSafeEqual`; otherwise 401.
- **Payload** (Strapi 5): `{ event, model, uid, entry }`. Derive the model from `uid` (`api::post.post` → `post`).
- **Mapping:**

  | Event                                              | Action                                                                                                            |
  | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
  | `entry.publish`, `entry.unpublish`, `entry.delete` | purge `type:<model>`                                                                                              |
  | `entry.create`, `entry.update`                     | purge only when model is `tag` (no Draft & Publish); otherwise it's a draft save that doesn't change live content |
  | `media.*`                                          | ignore                                                                                                            |
  | body `{ "all": true }`                             | `purge_everything` (manual escape hatch)                                                                          |

- **Call:** `POST https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache` with `{ "tags": [...] }` and `Authorization: Bearer ${CF_PURGE_TOKEN}`.
- Respond 200 on success, 502 on failure, and `console.log` the outcome (shows in `wrangler tail` and Workers Logs). Strapi doesn't retry webhooks, so failures must be visible.

### 5. Configuration

| Where                                 | Name                         | Value                                                                         |
| ------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------- |
| Worker secret (`wrangler secret put`) | `STRAPI_TOKEN`               | Strapi read-only API token                                                    |
| Worker secret                         | `PURGE_SECRET`               | random 32+ bytes, shared with the Strapi webhook                              |
| Worker secret                         | `CF_PURGE_TOKEN`             | Cloudflare API token, permission _Zone → Cache Purge → Purge_, this zone only |
| `wrangler.jsonc` `vars`               | `STRAPI_URL`                 | `https://cms.bhargavshukla.com`                                               |
| `wrangler.jsonc` `vars`               | `CF_ZONE_ID`                 | the zone ID                                                                   |
| local `.env`                          | `STRAPI_URL`, `STRAPI_TOKEN` | `http://localhost:1337` + a local token                                       |

Read string config through `$env/dynamic/private` (populated from bindings by `adapter-cloudflare`); use `platform` for `caches` and `ctx`.

**Strapi webhook** (Settings → Webhooks): URL `https://bhargavshukla.com/api/purge`, header `Authorization: Bearer <PURGE_SECRET>`, events Entry create / update / delete / publish / unpublish. Test with the admin's **Trigger** button.

### 6. Tests (Vitest, server project)

- Cache key normalization and bypass rules.
- "No tags → not cached" and "non-200 → not cached".
- Webhook → tags mapping for every row in the table above.
- Purge auth rejects a missing or wrong token.

## Verifying in production

1. `curl -sI https://bhargavshukla.com/blog/<slug>` twice → `x-edge-cache: MISS`, then `HIT`.
2. Edit and publish the post in Strapi; `pnpm wrangler tail` shows the purge of `type:post`.
3. Next `curl` → `MISS` with the new content; `/`, `/blog` and `/rss.xml` also reflect it.
4. A wrong bearer token on `/api/purge` → 401. `{ "all": true }` with the right token purges everything.
