# Analytics (#136)

Exploration: count what visitors do (easter eggs, palettes, the printed resume, the contact card) and replace Cloudflare Web Analytics with numbers ad blockers can't hide. This doc compares tools, picks how events reach them, and covers privacy, cost and what changes for read counts. It ends with the decisions made and what was built (#154).

Prices and limits checked 2026-10-05.

## Recommendation

**PostHog EU Cloud, fed by our own beacon through the Worker, in cookieless server hash mode. No PostHog script on the page, no cookies, no consent banner, EU visitors included. Cloudflare Web Analytics runs alongside for four weeks, then goes.**

- **Accurate:** events go to `bhargavshukla.com/api/events`, same-origin, so blocklists that catch `static.cloudflareinsights.com` (ad blockers, Pi-hole) don't catch them.
- **Light:** a ~1 KB beacon plus `web-vitals` (~2.4 KB gz), instead of posthog-js.
- **Private:** the same daily-salt scheme as read counts, done by PostHog: nothing is stored in the browser and nothing that identifies a visitor is kept.
- **Free:** PostHog's free plan (1 M events a month, no card) and Workers Paid's included requests.

## What it answers

| Question                                         | Today (Web Analytics) | With the beacon                                                                                                       |
| ------------------------------------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Easter eggs** found, and which                 | No                    | `easter_egg_found {egg}`                                                                                              |
| **Palettes** chosen                              | No                    | `palette_chosen {palette}`                                                                                            |
| **Resume** printed or saved as PDF               | No                    | `resume_printed`. One event for both: the browser fires the same `beforeprint` for each, so they can't be told apart. |
| **Contact card:** started, sent, blocked as spam | No                    | `contact_started`, `contact_sent`, `contact_blocked`                                                                  |
| Time spent reading                               | No                    | `read {seconds}`: visible time on a post or aside page                                                                |
| Outbound links                                   | No                    | `outbound_link {host}`                                                                                                |
| Page views, referrers, countries, devices        | Yes, minus blocked    | `$pageview` (PostHog's web analytics dashboard)                                                                       |
| Core Web Vitals                                  | Yes, minus blocked    | `$web_vitals`                                                                                                         |
| Scroll depth                                     | No                    | Left out: `read {seconds}` says more on a site of single-column pages.                                                |
| Return visitors                                  | No                    | **Not possible** without recognising a visitor across days: see [Post-MVP](#post-mvp-a-consent-banner).               |

The bold rows are the must-haves.

## Tools compared

| Option                       | Events and funnels                              | Dashboard                      | Keeps data | Cost here                                       | Fit                                                                                                                                                           |
| ---------------------------- | ----------------------------------------------- | ------------------------------ | ---------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PostHog EU Cloud**         | Yes, with funnels (the contact card) and trends | Yes, plus a web analytics view | 1 year     | $0 up to 1 M events a month                     | **Pick.** Takes events from any server through its capture API, and hashes visitors itself in cookieless mode.                                                |
| **Workers Analytics Engine** | Counts only; funnels by hand in SQL             | None (SQL API, or Grafana)     | 3 months   | $0 (10 M data points a month on Workers Paid)   | **Runner-up.** Nothing leaves Cloudflare, but every chart is a SQL query, there are no funnels, and three months is too short to compare this year with last. |
| **Umami Cloud** (Hobby)      | Custom events; simple funnels                   | Yes                            | 6 months   | $0 up to 100 K events a month                   | Smaller free tier and shorter history. Its script is third-party unless proxied.                                                                              |
| **Plausible**                | Custom events (goals), simple funnels           | Yes                            | Plan-long  | From $9 a month (10 K page views); no free plan | Good privacy story, but it costs money from the first visitor for what PostHog does free.                                                                     |

## How events get there

```
browser ── sendBeacon ──▶ /api/events (Worker) ── POST ──▶ eu.i.posthog.com/batch
           same origin     adds $ip, $raw_user_agent,      cookieless server hash mode:
                           $host; drops what isn't          visitor = hash(daily salt, IP,
                           counted                          User-Agent, host); IP discarded
```

- **In the browser**, a small module like `trackRead` ([`src/lib/reads.ts`](../src/lib/reads.ts)) queues events and sends them with `navigator.sendBeacon` as JSON: on each page view, and when the page is hidden (`visibilitychange`), which also carries `$web_vitals` and the `read` time. Client-side navigations send a `$pageview` from `afterNavigate`. The page view carries `$current_url`, `$pathname`, `$referrer` and UTM params.
- **In the Worker**, `POST /api/events` accepts a small batch (a few events), checks it (below), adds the visitor's IP (`CF-Connecting-IP`), User-Agent and host, sets `distinct_id` to `$posthog_cookieless`, and forwards it to PostHog's batch endpoint in `waitUntil`. It answers 204 straight away, as `/api/views` does.
- **Why not posthog-js:** it's tens of KB, it's a third-party script (blocked unless proxied), and what it adds over our beacon is autocapture and session replay, which we don't want.
- **The project token** (`phc_…`) is public by PostHog's design (it can only send events), so it goes in `vars` in `wrangler.jsonc`, not in secrets.

### Not counted

The same rules as read counts ([view-counts.md](view-counts.md#what-counts-as-a-view)):

- Only `bhargavshukla.com`: not `vite dev` or Workers Builds preview URLs.
- Not in preview mode (a valid `__preview` cookie).
- Not from the author's devices: the same `noCount` flag in `localStorage` turns off read counts and events.
- Only same-origin requests, and only known event names: anything else is dropped in the Worker.
- **Bots:** most never run JavaScript. The Worker drops obvious bot User-Agents, and PostHog's web analytics filters known bots too.

### Who's a visitor

In cookieless server hash mode PostHog makes each event's visitor from `hash(project, daily salt, IP, User-Agent, host)` and deletes each day's salt once its events are processed. With **Discard client IP data** on (Project settings → IP data capture), the IP is used for that hash, for GeoIP (country) and for bot detection, and is not stored with the event.

So a **visitor** is someone on the site on a given day. The same person tomorrow is a new visitor, and two people behind one IP with the same browser are one. That gives visitors per day and sessions within a day; it can't give return visitors.

Countries come from the IP, so a VPN user counts under the VPN's exit country. That's true of every IP-based tool, Web Analytics included.

**To check in the build ticket:** that the web analytics dashboard groups cookieless page views into sessions (and so bounce rate and session length) without `$session_id` from posthog-js; if not, the beacon makes a session ID in memory per tab.

### Events

| Event                                                | Properties                                    | Fired when                                                                                      |
| ---------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `$pageview`                                          | `$current_url`, `$pathname`, `$referrer`, UTM | A page loads, or a client-side navigation lands                                                 |
| `$web_vitals`                                        | LCP, INP, CLS (from `web-vitals`)             | The page is hidden for the first time                                                           |
| `read`                                               | `seconds`                                     | A post or aside page is hidden, with its visible time so far                                    |
| `easter_egg_found`                                   | `egg`: `8-bit`, `disco`, `tab-lap`, `abyss`   | The gesture succeeds. Disco and 8-bit mode count here, not as palette choices.                  |
| `palette_chosen`                                     | `palette`                                     | The visitor picks a palette. Disco shows palettes without choosing one, so it never fires this. |
| `resume_printed`                                     | none                                          | `beforeprint` on `/resume`                                                                      |
| `contact_started`, `contact_sent`, `contact_blocked` | none                                          | First keystroke in the card; the server accepted it; the server rejected it as spam (Turnstile) |
| `outbound_link`                                      | `host`                                        | A link to another site is followed                                                              |

`contact_sent` and `contact_blocked` are decided on the server, so the Worker sends them itself after the contact form's checks, with the same visitor fields.

## Read counts stay in D1

PostHog could hold read counts, but the public number would then come from its query API: called from the Worker with a personal API key (a secret, unlike the project token), rate limited, and counting differently from today's exact once-per-visitor-per-page-per-day rule. D1 already does this exactly, for $0 ([view-counts.md](view-counts.md)).

So read counts don't change. PostHog gets a `read` event with the reading time, so reading shows up next to everything else.

## Cost

**Performance.** No third-party script and no extra connection: the beacon is part of the site's own bundle (~1 KB), plus `web-vitals` (5.7 KB minified, 2.4 KB gz), loaded after the page is interactive. Beacons go out with `sendBeacon`, which never holds up the page. Removing Cloudflare's injected beacon takes away one third-party script, and brings back `ETag` for browsers ([caching.md](caching.md#validators-126)). The build ticket runs `pnpm perf` before and after.

**PostHog.** The free plan has 1 M events a month and 1 year of history. With no card on file, anything past the limit is dropped, never billed. A page view sends about 3 events (`$pageview`, `$web_vitals`, often `read`), so the free plan covers roughly **300 K page views a month**. Past that, events cost $0.00005 each: 1 M page views a month would be about $100. That's the point to revisit.

**Workers.** Each beacon is a Worker request (a POST, never cached), about 2 per page view (on load, on hide). Workers Paid includes 10 M requests a month, then $0.30 per million: about 5 M page views a month before it costs anything, far beyond PostHog's free limit.

## Privacy

- **Stored by PostHog** (EU Cloud, Frankfurt): the events above with page paths, referrer, country, browser, OS and device type, and a daily visitor hash that can't be linked to a person once the day's salt is deleted.
- **Not stored:** IP addresses (discarded after the hash, GeoIP and bot detection), anything in the visitor's browser. No cookies, no `localStorage`, no session replay, no autocapture.
- **EU visitors are included**, with no banner. This is the approach Plausible, Fathom and PostHog's own cookieless mode take: nothing is read from or written to the device, and nothing kept identifies a person. It is a reading of the rules, not legal advice.
- **For the build ticket:**
  - A short **privacy note**, linked from the footer: what's collected, the daily hash, PostHog EU as the processor, how long data is kept (1 year), and read counts.
  - Sign **PostHog's DPA** (in organisation settings; free).

## Cloudflare Web Analytics

- **Now:** turn off its EU exclusion, so EU numbers build up before the beacon ships. The exclusion was set in #58 to avoid consent questions while EU traffic was unknown; Web Analytics stores nothing on the device either, so it doesn't need one.
- **After the beacon ships:** run both for **four weeks**. The gap between them is roughly what ad blockers were hiding. Then turn Web Analytics off (dashboard → Web Analytics → `bhargavshukla.com`), and update [infrastructure.md](infrastructure.md#analytics-cloudflare-web-analytics-58).

## Post-MVP: a consent banner

Recognising a visitor across days (return visitors, and anything that follows a person over time) needs an ID kept on the device, and that needs consent: a cookie banner. It's left out of the MVP.

After a few months of numbers, decide whether it's worth it, and if so who sees it. A banner only for EU visitors would be decided by `cf.country`, so VPN users would get the wrong one; that's a reason to show it to everyone or no one. PostHog's `cookieless_mode: 'on_reject'` keeps counting visitors who say no, with today's daily hash.

## Decisions (2026-10-05)

1. **Tool:** PostHog EU Cloud, free plan, no card.
2. **Sending:** our own beacon to `/api/events`, forwarded by the Worker. No posthog-js, autocapture or replay.
3. **Visitors:** PostHog's cookieless server hash mode, with client IP data discarded. No cookies, no banner.
4. **EU:** visitors included in full. Web Analytics' EU exclusion is turned off now. _Changed while building (#154), below: no visitors from the EEA, the UK or Switzerland until there's a DPA._
5. **Events:** as listed above; the must-haves are easter eggs, palettes, the printed resume and the contact card.
6. **Not counted:** the read counts' rules, plus bot User-Agents. One `noCount` flag for both.
7. **Web Analytics:** alongside for four weeks after launch, then off.
8. **Read counts:** stay in D1; PostHog gets a `read` event.
9. **Web Vitals:** measured with `web-vitals` and sent as `$web_vitals`.
10. **Post-MVP:** a consent banner for return visitors, decided after a few months of data.

## Built (#154)

| Piece                                                                     | What it does                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/lib/events.ts`](../src/lib/events.ts)                               | The events a page may send and the properties each may carry (free text, a number, or one of a few words: the eggs, the palette ids). The beacon is typed from it and the Worker checks against it. `contact_sent` and `contact_blocked` are server-only.                                                                                   |
| [`src/lib/analytics.ts`](../src/lib/analytics.ts)                         | The beacon: `startAnalytics` (the root layout, once; nothing with `noCount`), `pageview` (on load and from `afterNavigate`, sent at once), `track` (queued), `trackReading`. Sends with `navigator.sendBeacon` as JSON in plain text: on a page view, when the page is hidden, when 10 events are waiting, and when a link leaves the site. |
| [`src/lib/server/events.ts`](../src/lib/server/events.ts)                 | `counted` (the rules under [Not counted](#not-counted)), `readBeacon` (at most 10 events and 16 KB; unknown events and properties dropped, text cut at 500 characters), `toPostHog` (the cookieless placeholder, `$ip`, `$raw_user_agent`, `$host`, `$process_person_profile: false`, the time from each event's age), `sendToPostHog`.     |
| [`src/routes/api/events/+server.ts`](../src/routes/api/events/+server.ts) | `POST`: always 204; forwards to `https://eu.i.posthog.com/batch/` in `waitUntil`. Nothing is forwarded while `POSTHOG_TOKEN` (in `vars`) is empty.                                                                                                                                                                                          |
| [`src/routes/privacy/`](../src/routes/privacy/+page.svelte)               | The privacy note (PRIV-\* on the design canvas), linked from the footer next to RSS. Its copy is the Strapi **Privacy** single type ([content-model.md](content-model.md#privacy--privacy-draft--publish-off)).                                                                                                                             |
| [`src/lib/server/contact.ts`](../src/lib/server/contact.ts)               | Sends `contact_sent` (sent, verified or not) and `contact_blocked` (Turnstile failed, or the honeypot was filled) after the card's checks, by the same rules. The card adds a `no-count` field on the author's devices.                                                                                                                     |

Where each event fires: `easter_egg_found` in `unlock` (8-bit, each time the code turns it on; not again while it's on), `disco` and the layout (`tab-lap`; `abyss` when Safari reports a scroll 40 px past the end, once per visit); `palette_chosen` in the palette picker; `resume_printed` on `beforeprint` on `/resume`; `contact_started` on the card's first input (again after Send another); `read` from `ReadCount` wherever it counts reads.

Choices made while building:

- **`read` sends the seconds since its last report**, each time the page is hidden and when the reader leaves, so a reader who switches tabs and comes back isn't cut short or counted twice. Total reading time on a page is the sum of `seconds`; time per view is that sum over the page's `$pageview`s.
- **`$web_vitals` carries the URL of the page that loaded**, not the page open when it's sent: LCP belongs to the first page of a visit, even after client-side navigations.
- **Timestamps come from the Worker's clock**: each event carries its age in milliseconds, so a wrong clock on the device doesn't move it.
- **Cost on the page:** about 1.3 KB gz more on every page, plus `web-vitals` (3.0 KB gz), loaded once the page is idle.

**EEA, UK and Switzerland not counted (2026-10-05).** PostHog's DPA is written for a company to sign, and this site is run by an individual; PostHog's advice was to ask a legal adviser whether it fits. Until that's settled, the Worker drops every event from a visitor in the EEA (the EU and its outermost regions, Iceland, Liechtenstein, Norway), the UK (with Gibraltar and the Crown Dependencies) or Switzerland, by `request.cf.country` (`EXCLUDED_COUNTRIES` in `src/lib/server/events.ts`), and from unknown countries and Tor. Nothing about their visits reaches PostHog. Their pages still send the beacon: pages come from the shared edge cache, so the page can't know where its visitor is, and the Worker decides. Cloudflare Web Analytics' EU exclusion is back on. Read counts are unchanged: they stay in D1 and never leave Cloudflare. VPN users count under their VPN's exit country, as with every IP-based check. To count these visitors again, empty the list.

**Not counting your own visits:** the same `noCount` as read counts ([view-counts.md](view-counts.md#built-87)).

**Sessions:** still to check against the PostHog project (the ticket's "Check first"): whether its web analytics dashboard groups these cookieless page views into sessions without `$session_id`. If not, the beacon gets a session ID kept in memory per tab.

## Sources

Checked 2026-10-05. Third-party summaries are marked; check prices against the vendor's own page before relying on them.

**PostHog**

- [Cookieless tracking](https://posthog.com/tutorials/cookieless-tracking): server hash mode, the daily salt, `cookieless_mode: 'always'` and `'on_reject'`
- [Capture API](https://posthog.com/docs/api/capture): EU endpoints (`eu.i.posthog.com`), required fields, the public project token, `$process_person_profile`
- [Cookieless server hash mode in capture](https://github.com/PostHog/posthog/pull/27290) (PostHog PR): how the `$posthog_cookieless` placeholder becomes a hash
- [The cookieless placeholder](https://github.com/PostHog/posthog/pull/110316) (PostHog PR): every cookieless event shares one placeholder `distinct_id`
- [Person processing](https://posthog.com/handbook/engineering/person-processing) (handbook): `$ip` and `$raw_user_agent` for server-side events; cookieless events without `$ip` are dropped
- [Controlling data collection](https://posthog.com/docs/privacy/data-collection): **Discard client IP data**, and GeoIP and bot detection still using the IP first
- [Bot and traffic detection](https://posthog.com/docs/web-analytics/bot-detection)
- [Web analytics: getting started](https://posthog.com/docs/web-analytics/getting-started) and [the dashboard](https://posthog.com/docs/web-analytics/dashboard): `$pageview`, the properties the dashboard reads, Web Vitals
- [Bounce rate](https://posthog.com/tutorials/bounce-rate): how a bounce is defined
- [Pricing](https://posthog.com/pricing); the free plan's limits as summarised by [usercall.co](https://www.usercall.co/post/posthog-pricing) (third party)

**Cloudflare**

- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/): 10 M requests a month on Workers Paid, then $0.30 per million
- [Analytics Engine pricing](https://developers.cloudflare.com/analytics/analytics-engine/pricing/): 10 M data points and 1 M queries a month

**Alternatives**

- [Umami Cloud FAQ](https://umami.is/docs/cloud/faq): the Hobby plan's 100 K events a month and 6 months of history
- [Plausible pricing](https://seline.com/blog/plausible-analytics-pricing) (third party): from $9 a month, no free plan

**Libraries**

- [`web-vitals` size](https://mcp.depscope.dev/pkg/npm/web-vitals) (third party): 5.7 KB minified, 2.4 KB gz

**In this repo**

- [view-counts.md](view-counts.md): the daily-salt scheme, what isn't counted, and why read counts stay in D1
- [infrastructure.md](infrastructure.md#analytics-cloudflare-web-analytics-58): today's Web Analytics setup
- [caching.md](caching.md#validators-126): why the injected beacon drops `ETag`
- [performance.md](performance.md): `pnpm perf`, for the before-and-after
