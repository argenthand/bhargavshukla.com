# Edge-cache misses (#120)

Exploration: why a page sometimes takes half a second longer, and how to make that rare or cheap. This doc measures what a miss costs, explains why a quiet site misses often, compares the options, and ends with a recommendation and the questions for you to decide. No code changes in #120; the build gets its own ticket.

Facts checked 2026-10-03 against Cloudflare's docs (linked inline), on Workers Paid ($5/month, already paid for share cards).

## Recommendation

**Move from the Cache API to [Workers Cache](https://developers.cloudflare.com/workers/cache/) (generally available since 6 July 2026), with `stale-while-revalidate`.** It's a cache in front of the Worker instead of inside it:

- One miss anywhere fills a shared upper tier, so a miss in Toronto helps Vancouver and Frankfurt too.
- Expired pages are served instantly while the Worker re-renders in the background.
- Hits never run the Worker.

Visitors would wait on Strapi only for the first request to a page after a deploy or a publish, instead of on every first visit to each data centre every day.

- **Cost:** about $0. Requests are billed as today, and cache hits use no CPU. Static-asset requests become billable too, but they're far inside Workers Paid's 10 million included requests a month at this traffic.
- **Effort:** one build ticket. Most of it is deleting code (`edge-cache.ts`'s Cache API logic and the zone purge call), plus three spikes to confirm behaviour first ([below](#spikes-before-building)).
- **Main risk:** draft preview. Workers Cache doesn't key on cookies, so preview needs `Vary: Cookie` or its own URLs (decision 2).

## What a miss costs (measured)

From Toronto (`YYZ`), on production, 2026-10-03. A miss was forced with an unused `?page=` value, which is part of today's cache key.

| Request                                              | Time to first byte                                |
| ---------------------------------------------------- | ------------------------------------------------- |
| Home, edge-cache HIT                                 | ~0.10 s                                           |
| Home, MISS (renders, 2 Strapi calls in parallel)     | ~0.55 s (0.29–0.67 s)                             |
| Strapi API called directly from Toronto, per request | ~0.22–0.25 s (≈0.17 s after the connection is up) |

- A miss costs about **0.45 s more** than a hit. In Lighthouse that was 93 (cold) vs 100 (warm).
- Most of the cost is Strapi: the CMS is a Hetzner VPS in Europe, reached through a Cloudflare Tunnel, so for North American visitors every miss crosses the Atlantic at least once.

## Why a quiet site misses often

Today's edge cache ([caching.md](caching.md)) uses the Workers [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/):

- **One cache per data centre.** "The contents of the cache do not replicate outside of the originating data center." Cloudflare has hundreds of them; each one's first visitor of the day misses.
- **No tiering.** "The `cache.put` method is not compatible with tiered caching," so a data centre can't ask a nearby one before going to Strapi.
- **Every deploy starts fresh** (the build version is in the key since #108, on purpose), and **every publish purges** the content type it touched.
- **Expiry is a hard miss** after a day (`EDGE_TTL`). There's no serve-stale-while-refreshing with the Cache API.
- **No request collapsing:** two visitors missing at once both render.

A site with a handful of visitors a day spread over the world will therefore miss on a large share of first visits. Crawlers and tools like PageSpeed, which run from Google's data centres, almost always miss. We don't have a hit ratio today (nothing records `x-edge-cache`). Workers Cache reports `cf-cache-status` per request in Workers observability, which gives us one ([debugging](https://developers.cloudflare.com/workers/cache/debugging/)).

## Options

| Option                                                                                                                           | Fewer misses?                                                                                                                 | Cheaper misses?                                                           | Cost                                                                                                                          | Fit                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Workers Cache** + `stale-while-revalidate`                                                                                     | **Yes:** two tiers network-wide; expiry served stale; request collapsing                                                      | No (same render)                                                          | ~$0                                                                                                                           | **Best.** Header-driven (`Cache-Control`, `Cache-Tag`), so it works with SvelteKit as is. Replaces most of `edge-cache.ts`.                                                                                                                                            |
| **Workers KV** as a global page store (write on miss or on publish)                                                              | Yes: global                                                                                                                   | Hot keys yes; cold keys read from a central store                         | $0 at this scale (10 M reads, 1 M writes a month included; [pricing](https://developers.cloudflare.com/kv/platform/pricing/)) | **Out.** We'd build what Workers Cache now does: our own tag→keys index for purges, and "changes may take up to 60 seconds or more to be visible" elsewhere ([how KV works](https://developers.cloudflare.com/kv/concepts/how-kv-works/)), so a publish isn't instant. |
| **Pre-render on publish** (webhook renders every page into KV)                                                                   | Yes: no visitor ever renders                                                                                                  | n/a                                                                       | $0                                                                                                                            | **Out for now.** Needs KV (above) plus a renderer outside the request path. Workers Cache has no pre-warm API ([limitations](https://developers.cloudflare.com/workers/cache/limitations/)).                                                                           |
| **Warm after publish/deploy** (request the key pages)                                                                            | With the Cache API, only for the one data centre that runs it. With Workers Cache, a warm request fills the shared upper tier | No                                                                        | $0                                                                                                                            | **Later, maybe.** Useful on top of Workers Cache (warm home, lists and the published page after a purge) if spike 3 shows loopback requests fill the cache.                                                                                                            |
| **Tiered Cache / Cache Reserve** (zone features)                                                                                 | Not for us: the Cache API isn't tiered, and zone cache settings "have no effect on Workers Cache"                             | No                                                                        | Cache Reserve is paid per GB and operation                                                                                    | **Out.**                                                                                                                                                                                                                                                               |
| **[Smart Placement](https://developers.cloudflare.com/workers/configuration/placement/)** (run the Worker near Strapi on a miss) | No                                                                                                                            | **Maybe:** two Strapi calls from next door instead of across the Atlantic | $0                                                                                                                            | **Later, maybe.** It "only considers locations where the Worker has previously run" and needs enough traffic from several locations to decide. With Workers Cache, only misses run the Worker, which makes that traffic even thinner.                                  |
| **Cache Strapi responses** separately (subrequest cache)                                                                         | No                                                                                                                            | Yes                                                                       | $0                                                                                                                            | **Out.** A second cache to purge, and with Workers Cache misses become rare enough that it's not worth it.                                                                                                                                                             |

## Recommended design

What changes from today ([caching.md](caching.md)):

1. **Turn it on:** `"cache": { "enabled": true }` in `wrangler.jsonc` (Wrangler ≥ 4.69). Keep the default: the Worker version is in the cache key, so a deploy never serves a page that points at removed assets (the reason for #108's version prefix). `cross_version_cache` stays off.
2. **Headers instead of `cache.put`:** on a cacheable response, the hook sets:
   - `Cloudflare-CDN-Cache-Control: max-age=86400, stale-while-revalidate=604800` for the edge. It takes precedence over `Cache-Control` for Cloudflare ([configuration](https://developers.cloudflare.com/workers/cache/configuration/)).
   - `Cache-Control: no-cache` for browsers, as today.
   - `Cache-Tag: type:post,…` from `locals.cacheTags`, as today.

   The same rules decide what's cacheable: 200, tagged, no `Set-Cookie`, not `locals.noStore`, and for `__data.json` no error node. Everything else gets `Cloudflare-CDN-Cache-Control: no-store`, so the 2-hour heuristic TTL for responses without headers never applies by accident. That includes `/api/*`, errors, previews and anything without tags.

3. **Purge from inside the Worker:** `/api/purge` calls `ctx.cache.purge({ tags })` instead of Cloudflare's zone purge API. Zone-level purges "don't affect Workers Caching content" ([purge](https://developers.cloudflare.com/workers/cache/purge/)). Propagation is global, like today. The `CF_PURGE_TOKEN` and `CF_ZONE_ID` settings go away. Purges use the Free plan's rate limits, which is plenty for one purge per publish.
4. **Delete the Cache API code:** `cacheKey`, `KEY_PARAMS`, the `/__edge/` prefix, the `match`/`put` path and `EDGE_TTL`'s day-long expiry all go. What stays is a small hook that sets headers. The adapter's own `caches.default` lookup is independent and unaffected.
5. **Draft preview** (decision 2):
   - **Option A:** `Vary: Cookie` on every page. Visitors who send no cookies share one cached copy. A preview cookie makes a different key, so the Worker runs and its `private, no-store` answer is never stored. Cookie values are compared verbatim, so it only works if ordinary visitors send no cookies on this domain (spike 2).
   - **Option B:** previews get their own URLs (for example `/preview/blog/<slug>`, mapped with SvelteKit's `reroute` hook). Links inside a preview would need rewriting to stay in preview.
6. **Query strings are now part of the key verbatim**, order included. Tracking parameters (`?utm_source=…`) make a separate entry; "`cf.cacheKey` has no effect on eyeball requests," so they can't be stripped ([cache keys](https://developers.cloudflare.com/workers/cache/cache-keys/)). That only means the first visitor from each tracked link renders the page; content is unaffected.
7. **Docs:** rewrite caching.md around Workers Cache; drop the zone purge token from infrastructure.md.

**What visitors would see:**

- After a **deploy**, the first request for each page anywhere renders it; everyone after that, anywhere, gets the upper-tier copy.
- After a **publish**, the purged pages render once.
- After a **day**, a page is served stale while it refreshes, so nobody waits.
- **Simultaneous misses** for one page render once.

## Spikes (run in #123, 2026-10-03, on a preview version)

All three passed on `cache-spike-bs-blog.mrshukla-b.workers.dev` (a version uploaded with `wrangler versions upload`, not deployed; its cache is separate from production's):

1. **Page data:** `Cloudflare-CDN-Cache-Control` makes `__data.json` cacheable despite SvelteKit's `private, no-store`: second request `HIT`. A copy filled in Toronto was a `HIT` in Montréal (upper tier). Browsers still get `Cache-Control: no-cache`; `Cache-Tag` and `Cloudflare-CDN-Cache-Control` don't reach them.
2. **Preview:** the site and Cloudflare set no cookies on bhargavshukla.com, so ordinary visitors send none and share one copy. A request with a `__preview` cookie got `BYPASS`: it reached the Worker. A 404 → `BYPASS` both times.
3. **Purge and repopulate:** `ctx.cache` and `ctx.exports` are reachable through `adapter-cloudflare` as `platform.ctx` (`enable_ctx_exports` is on by default since 2025-11-17). A webhook-style call purged `type:resume`. Within seconds `/resume` and its page data were `HIT` again with an `age` matching the purge, without any visitor request, so the loopback refill landed in the same keys visitors use. Pages that don't read the resume kept their older copies.

Also seen: a tracking parameter makes its own entry (`MISS`), as documented; `HEAD` is answered from a `GET` fill.

## Decisions (2026-10-03, build ticket #123)

1. **Workers Cache:** yes.
2. **Preview:** never cached, and a preview request must never be answered from the public cache: the Worker has to run for it. `Vary: Cookie` if spike 2 shows ordinary visitors send no cookies; otherwise preview URLs.
3. **On publish:** purge the touched tags, then **repopulate** the affected pages right away (home, the type's list, the entry's own page, RSS and the sitemap), so visitors get the new version from cache instead of the first one rendering it.
4. **Warming:** keep home, resume, Writing and Asides warm (cost below).

## What it costs if the blog gets very popular

Prices on Workers Paid, checked 2026-10-03 ([Workers](https://developers.cloudflare.com/workers/platform/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/)):

- **Base:** $5 a month, including 10 M requests ($0.30 per extra million) and 30 M CPU-ms ($0.02 per extra million).
- **D1:** 50 M rows written included ($1.00 per extra million).
- **Bandwidth:** Cloudflare doesn't charge for it.

**What changes:** with the Cache API, the Worker runs on every page request, but static assets (`/_app/…`) are "free and unlimited". With Workers Cache, hits use no CPU, but "every request to your Worker is charged … including requests that are normally free: static asset requests".

**One visit, measured** (phone, production, 2026-10-03):

| Step         | Requests                                          |
| ------------ | ------------------------------------------------- |
| First visit  | 28: the page + 27 static files (JS chunks, fonts) |
| Each tap     | 1 data request                                    |
| Return visit | 1: the rest comes from the browser cache          |

Reading a post adds 2 read-count calls. So a typical visit from a shared link (land on a post, read it, tap once) is:

- **Today:** 4 billable requests (page, data, 2 read-count calls).
- **With Workers Cache:** 31 billable requests.

| Visits a month | Today (Cache API)                              | Workers Cache            | Workers Cache with fewer JS files (~10 requests a visit) |
| -------------- | ---------------------------------------------- | ------------------------ | -------------------------------------------------------- |
| 10 k           | $5                                             | $5                       | $5                                                       |
| 100 k          | $5                                             | $5                       | $5                                                       |
| 1 M            | $5                                             | **$11** (31 M requests)  | $5                                                       |
| 10 M           | **$16** (40 M requests + CPU on every request) | **$95** (310 M requests) | **$32**                                                  |

- **Read counts:** about 3 D1 rows per counted read stays inside the 50 M included rows up to roughly 30 M visits a month. Beyond that, D1 costs more than the cache: 100 M visits ≈ $100 of row writes.
- **Strapi and the VPS** don't feel popularity: only misses reach them, and with Workers Cache those are a handful per publish.
- **If traffic ever gets there:**
  - The lever is the number of static files on a first visit (18 JS files on home). Merging them is a small Vite setting (Rolldown `codeSplitting.groups` for the client build only; the server build breaks on the share cards' WebAssembly). Tried 2026-10-03: 18 → 7 files, but 49.8 → 61.0 KB gzip, because the merged chunk carries every page's code. Taps were unchanged, and first-visit "fully loaded" was a little slower (Slow 4G 1.99 → 2.07 s, 3G 6.97 → 7.33 s). HTTP/2 already fetches the small files in parallel. So it only pays for itself as a billing measure at millions of visits a month; not worth it before then.
  - Rate limits and a spending alert on the Cloudflare account are cheap insurance.
  - Neither is worth doing at today's traffic.

## What keeping pages warm costs

Warm means re-requesting a page so the cache always has a fresh copy. The set is home, resume, Writing and Asides, each as the page and as its page data: 8 requests.

- **Hourly:** 8 × 24 × 30 = 5,760 requests a month, under 0.1% of the 10 M included.
  - Most of those are hits that use no CPU. A page re-renders only when its copy passes `max-age` (a day): about 8 renders and 16 Strapi calls a day.
  - Cost: **$0**.
- **On publish:** the repopulate step is about 10–20 requests per publish. Also **$0**.
- **Where warming helps:**
  - A warm request fills the shared upper tier, which every data centre asks on a miss, and the lower tier of the data centre it runs in.
  - Visitors elsewhere still get a lower-tier miss on their first visit. It's answered from the upper tier, without the Worker or Strapi.
- **UptimeRobot already requests the home page every 5 minutes** ([infrastructure.md](infrastructure.md)), so home stays warm from its locations at no extra cost. The warming schedule lives in the repo either way (a Cron Trigger), so it doesn't depend on a monitoring account.

## How we'll know it worked

- `cf-cache-status` on production: `HIT` from the lower or upper tier, `UPDATING` / `STALE` while refreshing, `MISS` only after a deploy or a purge.
- The hit ratio in Workers observability, a week after the switch.
- Lighthouse on a "cold" run (a data centre that hasn't seen the page): it should match a warm run, because the upper tier answers.
- `pnpm perf` unchanged or better ([performance.md](performance.md)); the real-world log there for phones.
