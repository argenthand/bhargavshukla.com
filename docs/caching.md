# Edge cache and webhook purge

Goal: near-static speed, with content changes live within seconds and no frontend redeploy.

## Constraints (from Cloudflare docs, checked 2026-09-28)

- `cache.delete()` only purges the **one data center** where the Worker runs, so it can't be used for global invalidation.
- Purge by URL doesn't work for entries stored with the Cache API.
- Purge by **`Cache-Tag`** does work on Cache API entries and is on the **Free plan**: 5 requests/min (bucket of 25), up to 100 tags per request, limits shared per account.
- The Cache API only works on the **custom domain**, not `*.workers.dev`.

## Tagging strategy

Each page is tagged with the **content types it read**: `type:post`, `type:category`, `type:aside`, `type:tag`, `type:profile`, `type:resume`.

Publishing any post purges `type:post`, which clears every page that shows posts: the post itself, `/blog`, `/`, RSS and sitemap. SvelteKit's `__data.json` (client-side navigation) is never cached: SvelteKit marks it `private, no-store`, so it always reads Strapi. A renamed slug can't leave a stale page behind. Per-document tags would add bookkeeping for no benefit at this scale.

## Implementation

### 1. Types — `src/app.d.ts`

`App.Locals { cacheTags: Set<string> }`. `App.Platform` (`ctx`, `caches`, `cf`) comes from `@sveltejs/adapter-cloudflare`. `wrangler types` is not used: its 600 KB of runtime types clash with the DOM types the Svelte code needs, and string config comes through `$env/dynamic/private` anyway.

### 2. Strapi client — `src/lib/server/strapi.ts`

- One map: `MODELS = { post: 'posts', category: 'categories' }` (model name → REST path), plus `profile`, `resume`, `aside` and `tag`.
- `strapi(locals).find(model, query)` builds the URL with `qs`, sends `Authorization: Bearer ${STRAPI_TOKEN}`, and calls `locals.cacheTags.add('type:' + model)`.
- Populating a relation adds its model's tag too (`category` → `type:category`, `related` → `type:post`; `tags` → `type:tag`), so renaming a category purges every page that shows it.
- `hooks.server.ts` creates `locals.cacheTags` for every request; the edge cache (#16) turns it into the `Cache-Tag` header.

### 3. Hook — `src/hooks.server.ts` + `src/lib/server/edge-cache.ts`

`handle = sequence(cacheTags, edgeCache)`:

1. `cacheTags` sets `event.locals.cacheTags = new Set()`.
2. **Bypass** (plain `resolve`, `x-edge-cache: BYPASS`) when there's no `platform.caches` (`vite dev`), the method isn't `GET`/`HEAD`, the path starts with `/api/`, or the `__preview` cookie is present.
3. **Cache key** = `origin + /__edge + pathname` + only these params, in this order: `cat`, `kind`, `page`, `q`, `tag`, `x-sveltekit-invalidated`, `x-sveltekit-trailing-slash`. Tracking params (`utm_*`, `fbclid`, …) are dropped, so they share the page.
   - The filters are in the key because `/blog` and `/asides` render their filtered results on the server (no-JS and shareable links).
   - The `/__edge/` prefix matters: the adapter's own worker looks up the **raw request URL** in `caches.default` before SvelteKit runs, and must never find one of our entries (it would serve it as-is, `Cache-Tag` and 10-minute `Cache-Control` included).
4. `hit = await caches.default.match(key)`. A hit is returned with `x-edge-cache: HIT` (a `HEAD` gets the headers without the body).
5. On a miss, `response = await resolve(event)`.
6. Stored only for a `GET` whose response is `200`, has ≥ 1 tag, has no `Set-Cookie`, and whose `Cache-Control` isn't `no-store`/`private`. A load opts out with `setHeaders({ 'cache-control': 'no-store' })`; the home page does this when Strapi is unreachable, so the page without posts isn't kept for the TTL. The stored copy gets `Cache-Control: public, max-age=${EDGE_TTL}` and `Cache-Tag: <tags>`, written with `ctx.waitUntil(cache.put(key, …))`.
7. Browsers always get `x-edge-cache: MISS|HIT`, no `Cache-Tag`, and `Cache-Control: no-cache`. `no-cache` (rather than `max-age=0, must-revalidate`) also stops the adapter's worker from storing the response itself.

`EDGE_TTL = 600` (10 minutes). It only bounds staleness if a purge fails; raise it once purging has proven reliable.

### 4. Purge endpoint — `src/routes/api/purge/+server.ts` + `src/lib/server/purge.ts`

- **Auth:** `Authorization: Bearer ${PURGE_SECRET}`, compared with `crypto.subtle.timingSafeEqual`; otherwise 401.
- **Payload** (Strapi 5): `{ event, model, uid, entry }`, sent as JSON. Derive the model from `uid` (`api::post.post` → `post`); uids the site never reads (plugins, users) are ignored. Send JSON when calling it by hand: SvelteKit's CSRF check answers 403 to a form-encoded cross-site POST.
- **Mapping:**

  | Event                                              | Action                                                                                                                                     |
  | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
  | `entry.publish`, `entry.unpublish`, `entry.delete` | purge `type:<model>`                                                                                                                       |
  | `entry.create`, `entry.update`                     | purge only for models without Draft & Publish (`category`, `profile`, `tag`); otherwise it's a draft save that doesn't change live content |
  | `media.*`                                          | ignore                                                                                                                                     |
  | body `{ "all": true }`                             | `purge_everything` (manual escape hatch)                                                                                                   |

- **Call:** `POST https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache` with `{ "tags": [...] }` and `Authorization: Bearer ${CF_PURGE_TOKEN}`.
- Respond 200 on success or when there's nothing to purge, 502 when Cloudflare fails, 500 when `CF_ZONE_ID`/`CF_PURGE_TOKEN` is missing, and log every outcome (`Purge: …` in `wrangler tail` and Workers Logs). Strapi doesn't retry webhooks, so failures must be visible.
- The handler lives in `purge.ts` (`handlePurge(request, config, fetch)`) so it's tested without SvelteKit; `+server.ts` only passes the env in. `crypto.subtle.timingSafeEqual` is Workers-only: both sides are SHA-256 hashed first (equal lengths), with a constant-time loop in Node.

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

1. `curl -s -D - -o /dev/null https://bhargavshukla.com/blog/<slug>` twice → `x-edge-cache: MISS`, then `HIT`. Use a GET: `curl -I` sends `HEAD`, which is answered from the cache but never stored.
2. Edit and publish the post in Strapi; `pnpm wrangler tail` shows the purge of `type:post`.
3. Next `curl` → `MISS` with the new content; `/`, `/blog` and `/rss.xml` also reflect it.
4. A wrong bearer token on `/api/purge` → 401. `{ "all": true }` with the right token purges everything.
