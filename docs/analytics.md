# Analytics (#136)

Exploration: count what visitors do (easter eggs, palettes, the printed resume, the contact card) and replace Cloudflare Web Analytics with numbers ad blockers can't hide. This doc compares tools, picks how events reach them, and covers privacy, cost and what changes for read counts. It ends with the decisions made. No code yet: a build ticket follows.

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
4. **EU:** visitors included in full. Web Analytics' EU exclusion is turned off now.
5. **Events:** as listed above; the must-haves are easter eggs, palettes, the printed resume and the contact card.
6. **Not counted:** the read counts' rules, plus bot User-Agents. One `noCount` flag for both.
7. **Web Analytics:** alongside for four weeks after launch, then off.
8. **Read counts:** stay in D1; PostHog gets a `read` event.
9. **Web Vitals:** measured with `web-vitals` and sent as `$web_vitals`.
10. **Post-MVP:** a consent banner for return visitors, decided after a few months of data.
