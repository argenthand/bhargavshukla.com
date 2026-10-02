# View counts (#82)

Exploration: show how many times a post or aside has been read, on its own page. This doc compares where to keep the counts, what counts as a view, how to show a number on edge-cached pages, and what that means for privacy. It ends with a recommendation and the decisions needed before a build ticket.

Prices and limits checked 2026-10-01, on Workers Paid ($5/month, already paid for share cards).

## Recommendation

**D1, counted by a JavaScript beacon after 10 seconds of reading, at most once per visitor per page per day, with no cookies and no IPs stored.** The page fetches its count after load into a space reserved for it, so the edge cache is untouched and nothing shifts.

- **Cost:** $0. Each view writes about 3 rows; Workers Paid includes 50 million row writes a month, so about 16 million views a month before D1 costs anything.
- **Accuracy:** exact (SQL `UPDATE … SET count = count + 1`), all-time, and it includes EU visitors, which Web Analytics doesn't.
- **Effort:** one build ticket: a D1 binding and migration, two endpoints, a small component, docs.

## Where to keep the counts

| Option                                    | Exact?                                                                   | Keeps all-time totals?                              | Cost at this scale                         | Fit                                                                                                                                                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** (SQLite)                           | Yes: atomic increment                                                    | Yes                                                 | $0 (50 M row writes, 25 B row reads/month) | **Best.** A binding in `wrangler.jsonc`, migrations in the repo, works with `vite dev` through the adapter's platform proxy. Writes go to one primary; a few tens of ms extra on a beacon nobody waits for.                                                |
| **KV**                                    | **No.** Read-then-write loses increments when two views land together    | Yes                                                 | $0 (1 M writes/month)                      | **Out.** Eventually consistent, and **one write per second per key**: a popular post would drop counts.                                                                                                                                                    |
| **Durable Object** per page               | Yes                                                                      | Yes                                                 | $0 (1 M requests/month)                    | **Overkill.** Strongly consistent, but the class has to live in a **second Worker**: `adapter-cloudflare` builds `_worker.js` and can't export a Durable Object class from it. More moving parts for the same result as D1.                                |
| **Analytics Engine**                      | **Sampled** when writes come fast (`sum(_sample_interval)` estimates it) | **No: 3 months**, so totals would need a rollup job | $0 (10 M data points/month)                | **Out for counts.** Built for dashboards, not a number on a page. Reading needs the SQL API over HTTP with an API token, from the Worker, on every count.                                                                                                  |
| **Web Analytics API** (already collected) | **No:** sampled, and misses visitors we chose to exclude                 | **No:** limited look-back                           | $0                                         | **Out.** EU visitors are excluded (our setting, [infrastructure.md](infrastructure.md#analytics-cloudflare-web-analytics-58)), ad blockers block the beacon, and it needs a GraphQL token. Fine for the author's own dashboard, wrong for a public number. |

## What counts as a view

- **A read, not a load.** A small script sends the beacon once the page has been **visible for 10 seconds** in total (`visibilitychange` pauses the clock, so a background tab doesn't count). Most crawlers never run JavaScript or stay that long, which deals with the bulk of bots for free.
- **Once per visitor, per page, per day**, decided on the server (next section), not with a cookie or localStorage.
- **Not counted:**
  - **Preview mode.** Requests with a valid `__preview` cookie are ignored.
  - **The author.** A `localStorage` flag on the author's own devices (`noCount`), set from the browser console or a hidden shortcut. It's the author's choice on their own device, so it doesn't break the no-tracking promise.
  - `vite dev` and Workers Builds preview URLs: only `bhargavshukla.com` counts.
  - Paths that aren't a published post or aside: the endpoint only accepts `/blog/<slug>` and `/asides/<slug>` it can find in Strapi (one cached read), so nobody can create counters for made-up paths.
- **Bots that do run JavaScript** (headless browsers) will still get through sometimes. Bot scores need Bot Management (Enterprise). At this scale that's noise, and the once-a-day rule below caps each one at one read per page per day.

### Once per day, without cookies

The same idea Plausible and Fathom use:

1. On the first beacon of each UTC day, the Worker creates a **random salt** for that day and stores it in D1. Older salts are deleted on the same write, so yesterday's salt is gone for good. No cron job is needed.
2. Each beacon computes `SHA-256(salt + IP + User-Agent + path)` in memory. The IP and User-Agent are never written anywhere.
3. `INSERT OR IGNORE` that hash into a `seen` table. If it was new, increment the page's count. Rows older than today are deleted along with the old salt.

Once the salt is deleted, the hashes can't be linked back to a visitor, even by someone with the database and a list of IPs. Two people behind the same IP and browser on the same day count once. That's acceptable.

### Schema

```sql
CREATE TABLE views (path TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0);
CREATE TABLE seen  (hash TEXT PRIMARY KEY, day TEXT NOT NULL);
CREATE TABLE salts (day  TEXT PRIMARY KEY, salt TEXT NOT NULL);
```

## Showing it

Pages are edge-cached for 10 minutes and purged by content type ([caching.md](caching.md)). A view isn't a content change, so the count can't go into the HTML without either going stale or purging the cache on every read. The options:

| Option                                         | Verdict                                                                                                                                                                                                                                               |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fetch after load** (`GET /api/views?path=…`) | **Recommended.** The page stays fully cached. The endpoint answers from its own small Cache API entry (60 seconds, not tag-based), so a popular post costs one D1 read a minute. Space for the number is reserved, so nothing shifts when it arrives. |
| Render at the edge, in the cached HTML         | Out. Stale for up to the TTL, and staler once `EDGE_TTL` goes up as planned. The reader's own view never shows.                                                                                                                                       |
| Purge on every view                            | Out. The purge API allows 5 requests a minute per account.                                                                                                                                                                                            |

- **Where:** in the post's meta line next to the date and reading time (posts), and in the aside's footer (asides). Not on lists for now. `/blog` with a number on every row turns writing into a leaderboard; it can be added later from the same table.
- **Format:** `Intl.NumberFormat` compact notation: "87 reads", "1.2K reads".
- **Without JavaScript:** no number, and no gap; the reserved space only exists with the `js` class.
- **Errors:** if the fetch fails, nothing is shown.
- **Mockup** on the design canvas in the build ticket, before code.

## Privacy

- **Stored:** the page path and its count. For one day only, a salted hash of the visitor and a random salt, both deleted at the end of the day.
- **Not stored:** IP addresses, User-Agents, cookies, anything in the visitor's browser.
- **Line for the docs** ([infrastructure.md](infrastructure.md), next to Analytics): "Read counts are anonymous: no cookies, and nothing that identifies you is stored."
- No consent banner needed: there's no cookie or device storage, and nothing that identifies a person is kept.

## Decisions for the build ticket

1. **Wording:** "reads" (we count reading, not loading) or "views".
2. **Threshold:** hide the number until a page has, say, 10 reads, so new posts don't open with "1 read".
3. **Starting point:** start every page at zero, or seed once from Web Analytics totals (which undercount: no EU, no ad-blocked visits). Recommendation: start at zero; the date the counter started goes in the docs.
4. **Lists:** posts and asides pages only (recommended), or `/blog` and the home page as well.
