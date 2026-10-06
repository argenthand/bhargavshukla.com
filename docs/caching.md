# Edge cache and webhook purge

> Misses and what to do about them: [edge-cache-misses.md](edge-cache-misses.md) (#120).

Goal: near-static speed, with content changes live within seconds and no frontend redeploy.

## How it works (since #123)

Pages are cached by **[Workers Cache](https://developers.cloudflare.com/workers/cache/)**, a cache in front of the Worker. On a hit Cloudflare answers without running it; on a miss the Worker renders the page and Cloudflare keeps it according to the response's headers. It replaced a hand-built Cache API cache (#16–#108); [edge-cache-misses.md](edge-cache-misses.md) has why and the measurements.

- **Two tiers:** a lower tier in the data centre closest to the visitor, and an upper tier every lower tier asks on a miss. One render anywhere serves everyone.
- **`stale-while-revalidate`:** once a page is a day old, the next visitor still gets it at once while one request refreshes it in the background. Concurrent misses for one page render once.
- **The key** is the path and the query string, verbatim and in order, plus the Worker version. A deploy starts with an empty cache, so a cached page never points at assets the deploy removed. The host and cookies aren't in the key; `Vary: Cookie` adds the Cookie header ([Draft preview](#draft-preview-57--srclibserverpreviewts)).
- **Purge** only from inside the Worker (`ctx.cache.purge`). Zone-level purges (dashboard, API) don't reach it.
- **Not emulated locally:** `vite dev` and `wrangler dev` render every request. Check caching on a preview version (`pnpm wrangler versions upload --preview-alias <name>`, Preview URLs on), whose cache is separate from production's.
- **Billing:** every request is billed, hits and static assets included; hits use no CPU ([edge-cache-misses.md → cost](edge-cache-misses.md#what-it-costs-if-the-blog-gets-very-popular)).

## Tagging strategy

Each page is tagged with the **content types it read**: `type:post`, `type:category`, `type:aside`, `type:tag`, `type:profile`, `type:resume`.

Publishing any post purges `type:post`, which clears every page that shows posts: the post itself, `/blog`, `/`, RSS and sitemap, and their page data (`__data.json`, what a client-side navigation fetches). A renamed slug can't leave a stale page behind. Per-document tags would add bookkeeping for no benefit at this scale.

## Implementation

### 1. Types — `src/app.d.ts`

`App.Locals { cacheTags: Set<string> }`. `App.Platform` (`ctx`, `caches`, `cf`) comes from `@sveltejs/adapter-cloudflare`. `wrangler types` is not used: its 600 KB of runtime types clash with the DOM types the Svelte code needs, and string config comes through `$env/dynamic/private` anyway.

### 2. Strapi client — `src/lib/content/server/strapi.ts`

- Content types, their REST paths and their relations live in the **content map** (`src/lib/publishing/server/content-map.ts`, #140; see [CONTEXT.md](../CONTEXT.md)).
- `strapi(locals).find(type, query)` builds the URL with `qs`, sends `Authorization: Bearer ${STRAPI_TOKEN}`, and adds the content map's `readTags(type, query)` to `locals.cacheTags`: `type:<content type>`.
- Populating a relation adds its content type's tag too, by the name the CMS gives it (a post's `category` → `type:category`, `related` → `type:post`; an aside's `tags` → `type:tag`), so renaming a category purges every page that shows it. Tags are per content type, not per entry ([ADR 0001](adr/0001-purge-by-content-type.md)).
- `hooks.server.ts` creates `locals.cacheTags` for every request; the edge cache (#16) turns it into the `Cache-Tag` header.

### 3. Hook — `src/hooks.server.ts` + `src/lib/publishing/server/edge-cache.ts`

`handle = sequence(cacheTags, preview, edgeCache)`. `edgeCache` doesn't store anything itself; it sets the headers Workers Cache follows:

1. **Bypass** (`shouldBypass`): methods other than `GET`/`HEAD`, `/api/*`, and any request with the `__preview` cookie keep their own headers. Unless one says `public` (as `/api/views` does), it also gets `Cloudflare-CDN-Cache-Control: no-store`, because without any `Cache-Control` Workers Cache would keep a 200 for two hours by heuristic.
2. **Cacheable** when the response is `200`, has ≥ 1 tag, has no `Set-Cookie`, isn't `no-store`/`private`, and the page isn't degraded (`locals.degraded`, see [Degraded pages](#degraded-pages-142)). `setHeaders` can't opt out: SvelteKit leaves it off `__data.json`.
   - **Page data** always comes from SvelteKit as `private, no-store`, so the header can't decide. It's cacheable when it's `application/json`, a `data` answer, and none of its nodes is an `error` (a 404 or a failed Strapi call arrives as a 200 with an error node; a redirect as `type: 'redirect'`).
3. **Headers** (`withCacheHeaders`):
   - Cacheable: `Cloudflare-CDN-Cache-Control: max-age=86400, stale-while-revalidate=604800` (Cloudflare only; it outranks `Cache-Control` and isn't passed to browsers), `Cache-Tag: <tags>` (stripped before browsers), `Vary: Cookie`.
   - Everything else: `Cloudflare-CDN-Cache-Control: no-store`.
   - Browsers always get `Cache-Control: no-cache`: they revalidate every time, so a purge shows on their next load. It also keeps the adapter's own `caches.default` lookup from storing pages.

`EDGE_MAX_AGE` (a day) and `EDGE_STALE` (a week) are in `edge-cache.ts`. Purges clear content changes and deploys start fresh, so `max-age` only bounds staleness if a purge fails; `stale-while-revalidate` means expiry never makes a visitor wait.

#### Validators (#126)

Browsers revalidate every page (`no-cache`); a validator lets that come back as `304 Not Modified` (a few hundred bytes) instead of the page (~23 KB compressed).

- **Pages** get `ETag: "<hash of the HTML>"` from SvelteKit itself (any page that doesn't stream).
- **Page data** (`__data.json`) gets the same kind of `ETag` from `edgeCache` (`etagFor`), when it's cacheable.
- **Both** get `Last-Modified`: when they were rendered (`withCacheHeaders`, cacheable responses only).
- **Who answers the 304:** on a cache hit, Cloudflare compares the request's `If-None-Match` / `If-Modified-Since` with the stored copy, without running the Worker. On a miss, SvelteKit answers a matching `If-None-Match` itself (`respond.js`, after the hooks), so the body isn't sent either.
- **Purges and deploys** render a new copy, with a new hash and a later date, so a browser holding the old one gets a 200 with the new page.
- **Found in #126:** production HTML reached browsers without its `ETag`, even on `BYPASS`. Static assets and local `wrangler dev` keep theirs. Cloudflare removes `ETag`s from HTML when the zone's Email Obfuscation, Automatic HTTPS Rewrites or "Replace insecure JavaScript libraries" may rewrite it. All three are now **off** for the zone (2026-10-04): every link was already https, and Email Obfuscation wasn't rewriting the address anyway.
- **Browsers got no page `ETag` while Web Analytics was on:** it injects its beacon into HTML requested with `Accept: text/html`, and that rewrite drops the `ETag` too. Their return visits revalidate by `Last-Modified` instead, which gives the same 304. Requests without that header (curl, feed readers, most bots) keep the `ETag`. #154 counts page views itself and turns Web Analytics off, which brings the `ETag` back for browsers ([infrastructure.md](infrastructure.md#analytics-cloudflare-web-analytics-58)).

Tracking parameters (`?utm_source=…`) make a separate entry: the key can't be normalised for visitor requests. The first visitor from each tracked link renders the page; content is unaffected.

### Degraded pages (#142)

When Strapi can't be reached, a page shows what it can instead of failing: a **degraded page** (CONTEXT.md). Every page load goes through `pageLoad` in `src/lib/publishing/server/page-load.ts`, and a route marks what it can do without by catching it with `degrade(value)`:

| Page               | Required  | Without Strapi                                                                                           |
| ------------------ | --------- | -------------------------------------------------------------------------------------------------------- |
| `/`                | nothing   | the name alone, no posts                                                                                 |
| `/blog`, `/asides` | nothing   | an empty list and "can't load right now"                                                                 |
| `/resume`          | nothing   | whichever of the profile header and the resume loaded, and "can't load right now" in place of the resume |
| `/blog/[slug]`     | the post  | the error page; with the post but not the other posts, no Next up                                        |
| `/asides/[slug]`   | the aside | the error page                                                                                           |

- **Required content** isn't caught: the load throws and `+error.svelte` shows (it needs no data).
- **A degraded page** sets `locals.degraded`. The hook never stores it, and answers a page request `503` with `Retry-After: 60`, so search engines keep the full page instead of indexing the degraded one. The page itself still shows: browsers render a 503's body. Page data (`__data.json`) stays a `200`, because SvelteKit's client treats any other status as a failed navigation.
- **Preview and form posts** skip the hook's rules (Bypass above), so a degraded page there is a `200`. It's still never stored, and crawlers never see either.
- **Only a `200` becomes a `503`**: if a load degrades and then fails or redirects, that status stands.
- **An unsaved profile or resume** isn't degraded: it's a normal page, cached as usual. Saving it is a publish, which purges the pages that show it.

### Draft preview (#57) — `src/lib/publishing/server/preview.ts`

1. **Link.** Strapi's **Open preview** (draft tab) calls `preview.config.handler` in [`cms/config/admin.ts`](../cms/config/admin.ts), which mints `https://bhargavshukla.com/api/preview?path=/blog/<slug>&exp=<now+5 min>&sig=<HMAC>` for posts, asides and the resume (other types get no button). The secret itself never appears in a URL. The published tab opens the live page.
2. **Cookie.** `/api/preview` checks the signature (`crypto.subtle.verify`, constant time), that `path` is a site path (`/x`, never `//host`), and that `exp` is in the future but at most 10 minutes away. It then sets `__preview=<exp>.<HMAC>` (HttpOnly, Secure, SameSite=Lax, 2 hours) and redirects (303) to the page. A bad link gets 401.
3. **Loads.** The `preview` hook verifies the cookie into `locals.preview`. A cookie made by hand, tampered with or expired is ignored. Page loads pass `{ drafts: locals.preview }`: lists merge each document's draft with the published list (`mergeDrafts`: published ones keep their publish date, the rest get `draft: true` and sort by last edit), and a post, aside or the resume is read with `status=draft`. **RSS and the sitemap never ask for drafts.**
4. **Caching.** A preview is never stored, and never answered from the cache: cacheable pages carry `Vary: Cookie`, so a request with the `__preview` cookie has its own key and reaches the Worker. Cloudflare sets no cookies on this site, so ordinary visitors send none and share one cached copy (checked in #123). The hook marks any `__preview` request `no-store`, and a preview response also gets `Cache-Control: private, no-store` and `X-Robots-Tag: noindex`.
5. **UI.** The layout shows "Preview mode: drafts are visible to you only" with **Exit** (`/api/preview/exit?path=…`, which clears the cookie and goes back to the page). Unpublished entries show "Not published" and the Draft badge.

The CMS and the site share `PREVIEW_SECRET`; the signed text is `link\n<path>\n<exp>` for links and `cookie\n<exp>` for the cookie, so one can't stand in for the other. [`scripts/preview-link.mjs`](../scripts/preview-link.mjs) (`pnpm preview-link`, #98) mints the same links on localhost with the local secret; a test checks that `verifyLink` accepts them. Keep the three signers in step: `previewLink` in cms/config/admin.ts, `linkPayload` here, and the script.

### Share cards (#62)

`/og/*.png` read Strapi through `strapi()` like pages, so they are stored and purged the same way: a post's card is tagged `type:post`, `type:category` and `type:profile` (for the headshot); an aside's `type:aside`, `type:tag` and `type:profile`; the default card `type:profile`. Pages link to them with `?v=<updatedAt>` so share sites that cache images by URL fetch a new card after an edit; each `v` is its own cache entry. A card rendered while the profile couldn't be loaded is `no-store`.

### Read counts (#87)

`/api/*` keeps its own headers. `GET /api/views` returns `Cache-Control: public, max-age=60`, so Workers Cache answers repeats for a minute without running the Worker. A popular page costs about one D1 read a minute. The beacon (`POST`) is never cached. Pages themselves don't change: the count is fetched after load.

### 4. Purge endpoint — `src/routes/api/purge/+server.ts` + `src/lib/publishing/server/purge.ts`

- **Auth:** `Authorization: Bearer ${PURGE_SECRET}`, compared with `crypto.subtle.timingSafeEqual`; otherwise 401.
- **Payload** (Strapi 5): `{ event, model, uid, entry }`, sent as JSON. The content map's `planPublish(body)` reads the content type from `uid` (`api::post.post` → `post`); uids the site never reads (plugins, users) are ignored. Send JSON when calling it by hand: SvelteKit's CSRF check answers 403 to a form-encoded cross-site POST.
- **Mapping:**

  | Event                                              | Action                                                                                                                                   |
  | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
  | `entry.publish`, `entry.unpublish`, `entry.delete` | purge `type:<content type>`, then repopulate                                                                                             |
  | `entry.create`, `entry.update`                     | purge only for content types without drafts (`category`, `profile`, `tag`); otherwise it's a draft save that doesn't change live content |
  | `media.*`                                          | ignore                                                                                                                                   |
  | body `{ "all": true }`                             | purge everything, then repopulate (manual escape hatch)                                                                                  |

- **Purge:** `ctx.cache.purge({ tags })`, or `{ purgeEverything: true }` for `{ "all": true }`. It propagates worldwide within seconds and uses the Free plan's purge rate limits, plenty for one purge per publish.
- **Repopulate** (`src/lib/publishing/server/repopulate.ts`): after a successful purge, in the background (`ctx.waitUntil`), the endpoint requests pages again through the Worker's own cache (`ctx.exports.default.fetch`, a loopback request). The content map decides which (#140): the **key pages** that show the published content type, in live sections only, each as the page and as its page data; the published post or aside's own page (from `entry.slug`); then RSS and the sitemap if they show it. A tag edit fetches Asides again, not the resume; `{ "all": true }` fetches every key page. The next visitor gets the new version from cache. Page data URLs are spelled as the SvelteKit client sends them (`dataUrl`): the key is the query string verbatim. Other pages render on their next visit. `Repopulate: n/m ok …` in the logs lists each URL with its `cf-cache-status`.
- Respond 200 on success or when there's nothing to purge, 502 when the purge fails, 500 when Workers Cache isn't available (`cache.enabled` missing from `wrangler.jsonc`), and log every outcome (`Purge: …` in `wrangler tail` and Workers Logs). Strapi doesn't retry webhooks, so failures must be visible.
- The handler lives in `purge.ts` (`handlePurge(request, secret, purge, repopulate)`) so it's tested without Workers; `+server.ts` passes in `ctx.cache.purge` and the repopulate step. `crypto.subtle.timingSafeEqual` is Workers-only: both sides are SHA-256 hashed first (equal lengths), with a constant-time loop in Node.

### 5. Configuration

| Where                                 | Name                         | Value                                            |
| ------------------------------------- | ---------------------------- | ------------------------------------------------ |
| Worker secret (`wrangler secret put`) | `STRAPI_TOKEN`               | Strapi read-only API token                       |
| Worker secret                         | `PURGE_SECRET`               | random 32+ bytes, shared with the Strapi webhook |
| `wrangler.jsonc` `vars`               | `STRAPI_URL`                 | `https://cms.bhargavshukla.com`                  |
| `wrangler.jsonc`                      | `cache`                      | `{ "enabled": true }` (Workers Cache)            |
| local `.env`                          | `STRAPI_URL`, `STRAPI_TOKEN` | `http://localhost:1337` + a local token          |

Read string config through `$env/dynamic/private` (populated from bindings by `adapter-cloudflare`); use `platform.ctx` for `cache`, `exports` and `waitUntil`.

**Strapi webhook** (Settings → Webhooks): URL `https://bhargavshukla.com/api/purge`, header `Authorization: Bearer <PURGE_SECRET>`, events Entry create / update / delete / publish / unpublish. Test with the admin's **Trigger** button.

### 6. Tests (Vitest, server project)

- Bypass rules, and what's cacheable (pages and page data), with the headers each gets.
- "No tags → not stored", "non-200 → not stored", "preview → not stored".
- Content map (`content-map.spec.ts`): webhook → plan for every row in the table above, the targeted URLs to fetch again (page data spelled like the client, live sections only, untrusted slugs ignored), relation tags, entry paths.
- Content map against the code and the CMS (`content-map.pages.spec.ts`): every route's real loads, against a fake Strapi, read exactly the content types it declares; every route that shows content is declared; content types, drafts and relations match the CMS schemas.
- Page loads (`src/routes/tests/pages.spec.ts`): every page route exports the contact action; each load against a fake Strapi that answers, has nothing saved, or is down (the table under Degraded pages). The hook's 503 for a degraded page and its 200 for degraded page data are in `edge-cache.spec.ts`.
- Purge endpoint: auth, purge failure → 502 without repopulating. Repopulate: its concurrency.

## Verifying in production

1. `curl -s -D - -o /dev/null https://bhargavshukla.com/blog` twice → `cf-cache-status: MISS` (or `HIT` if someone was first), then `HIT`, with an `age`. The second data centre you land on may miss once in its lower tier and then hit.
2. Page data: the same with `/blog/__data.json?x-sveltekit-invalidated=01`.
3. Publish in Strapi; Workers Logs show `Purge: purged type:post` and `Repopulate: …`. Then `curl` `/` and `/blog` → `HIT` with an `age` of about the seconds since publishing, and the new content.
4. A request with any `Cookie` header → never `HIT` for a page (a preview must reach the Worker). A 404 → `BYPASS`.
5. A wrong bearer token on `/api/purge` → 401. `{ "all": true }` with the right token purges everything.
