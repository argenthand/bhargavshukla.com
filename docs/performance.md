# Performance on slow networks

Why phone navigation was slow, how we measure it, and the numbers to compare real-world results against (#108).

## What was wrong (fixed in #108)

The edge cache gave a page and its `__data.json` (the data a tap on a link fetches) the same key, because SvelteKit strips `/__data.json` from `event.url` before hooks run. Once a page was cached in a data centre, every tap to it got HTML instead of JSON. The browser couldn't parse it, fetched it again, and then reloaded the whole page: three downloads per tap. Page data was also never cached (SvelteKit marks it `private, no-store`), so every tap waited on Strapi. Details in [caching.md](caching.md).

## How to measure

`pnpm perf [url] [--runs n]` ([`scripts/perf.mjs`](../scripts/perf.mjs)) runs Chromium as a Pixel 7 with Chrome DevTools' network presets, once with JavaScript on and once off. Each run:

1. **First visit: home** with an empty browser cache.
2. **Tap Writing, Resume, Asides** in the tab bar, one second apart.
3. **Return visit: home**, with the browser cache from steps 1–2.

It warms the edge cache first, so these are cache HITs. It prints median times as a Markdown table.

| Preset  | Latency  | Down        | Up          |
| ------- | -------- | ----------- | ----------- |
| Fast 4G | 165 ms   | 8.1 Mbit/s  | 1.35 Mbit/s |
| Slow 4G | 562.5 ms | 1.44 Mbit/s | 675 kbit/s  |
| 3G      | 2000 ms  | 400 kbit/s  | 400 kbit/s  |

**Columns:**

- _Total_ is wall-clock time from the start of the step to the `load` event (and, with JS, until the loading bar is gone). For a tap with JS on, that is when the new page is on screen.
- _FCP_ (first text on screen) and _LCP_ (largest text or image on screen) come from the browser, from the start of a full page load. A tap with JS on and no reload has neither (–).
- _KB_ is bytes over the wire from the start of the step until the network goes quiet. Route code fetched ahead of a tap (preloaded when the tab bar is visible) isn't in the tap's row.
- _Requests_ counts full page loads and `__data.json` fetches per tap. Fixed, with JS on, it's `0 page, 1 data`.

TTFB is left out on purpose: Chrome's throttling doesn't show in it (about 100 ms even at 3G's 2 s latency).

**Limits:** throttling adds a fixed delay to every request; it doesn't model packet loss, a radio waking up, or switching cell towers, so real LTE is worse. iOS Safari can't be throttled this way. Treat these as a floor and compare like with like.

## Results

Measured 2026-10-03, 3 runs each, medians. The edge cache was warm.

### Summary

Tapping a tab with JS on, the median of Writing, Resume and Asides:

| Network | Before #108 | After #108 | Before: per tap                |
| ------- | ----------- | ---------- | ------------------------------ |
| Fast 4G | 0.75 s      | 0.65 s     | 2 data fetches + a full reload |
| Slow 4G | 2.1 s       | 1.1 s      | 2 data fetches + a full reload |
| 3G      | 7.2 s       | 2.5 s      | 2 data fetches + a full reload |

- **Taps:** after the fix, a tap is one small data request (a few KB), so it costs about one round trip at any speed. Before, it cost three. With JS off, every tap is a full page load and takes about as long as a fixed JS-on tap.
- **First visit is the slow part now:** text appears at 1.3–1.5 s on Slow 4G and 4.5–5 s on 3G, and the page weighs about 280 KB, of which about 200 KB is fonts. They come from two other origins (fonts.googleapis.com, fonts.gstatic.com), each needing its own connection before text renders in its real font. That's the input for #110 (self-hosted fonts).
- **With JS on, `load` comes much later than first paint on 3G** (11.4 s vs 5.1 s): the page is readable at FCP while its scripts keep loading. Reading isn't blocked, but taps before then are full page loads.
- **Return visits** cost about one round trip (0.6 s on Slow 4G, 2 s on 3G): everything else comes from the browser cache.

### Production before #108 (https://bhargavshukla.com)

| Network | JS  | Step               | Total (ms) | FCP (ms) | LCP (ms) | KB  | Requests       |
| ------- | --- | ------------------ | ---------- | -------- | -------- | --- | -------------- |
| Fast 4G | on  | First visit: home  | 929        | 516      | 516      | 275 |                |
| Fast 4G | on  | Tap Writing        | 745        | 204      | 204      | 23  | 1 page, 2 data |
| Fast 4G | on  | Tap Resume         | 840        | 208      | 208      | 44  | 1 page, 2 data |
| Fast 4G | on  | Tap Asides         | 652        | 212      | 212      | 26  | 1 page, 2 data |
| Fast 4G | on  | Return visit: home | 206        | 208      | 208      | 8   |                |
| Fast 4G | off | First visit: home  | 885        | 472      | 472      | 216 |                |
| Fast 4G | off | Tap Writing        | 261        | 208      | 208      | 7   | 1 page, 0 data |
| Fast 4G | off | Tap Resume         | 436        | 208      | 208      | 21  | 1 page, 0 data |
| Fast 4G | off | Tap Asides         | 265        | 204      | 204      | 7   | 1 page, 0 data |
| Fast 4G | off | Return visit: home | 200        | 208      | 208      | 8   |                |
| Slow 4G | on  | First visit: home  | 3437       | 1720     | 1720     | 275 |                |
| Slow 4G | on  | Tap Writing        | 2055       | 616      | 616      | 23  | 1 page, 2 data |
| Slow 4G | on  | Tap Resume         | 2685       | 652      | 652      | 44  | 1 page, 2 data |
| Slow 4G | on  | Tap Asides         | 2092       | 620      | 620      | 26  | 1 page, 2 data |
| Slow 4G | on  | Return visit: home | 627        | 628      | 628      | 8   |                |
| Slow 4G | off | First visit: home  | 1323       | 1348     | 1348     | 216 |                |
| Slow 4G | off | Tap Writing        | 676        | 620      | 620      | 7   | 1 page, 0 data |
| Slow 4G | off | Tap Resume         | 1318       | 652      | 652      | 21  | 1 page, 0 data |
| Slow 4G | off | Tap Asides         | 671        | 620      | 620      | 7   | 1 page, 0 data |
| Slow 4G | off | Return visit: home | 621        | 632      | 632      | 8   |                |
| 3G      | on  | First visit: home  | 11926      | 5900     | 5900     | 275 |                |
| 3G      | on  | Tap Writing        | 7065       | 2176     | 2176     | 23  | 1 page, 2 data |
| 3G      | on  | Tap Resume         | 9329       | 2276     | 2276     | 44  | 1 page, 2 data |
| 3G      | on  | Tap Asides         | 7188       | 2172     | 2172     | 26  | 1 page, 2 data |
| 3G      | on  | Return visit: home | 2192       | 2192     | 2192     | 8   |                |
| 3G      | off | First visit: home  | 4507       | 4528     | 4528     | 216 |                |
| 3G      | off | Tap Writing        | 2215       | 2160     | 2160     | 7   | 1 page, 0 data |
| 3G      | off | Tap Resume         | 4495       | 2256     | 2256     | 21  | 1 page, 0 data |
| 3G      | off | Tap Asides         | 2221       | 2164     | 2164     | 7   | 1 page, 0 data |
| 3G      | off | Return visit: home | 2193       | 2196     | 2196     | 8   |                |

### After #108 (the branch on a local Workers runtime)

Measured with `wrangler dev` on localhost against production content, not through Cloudflare's network, so first visits here skip a real connection to Cloudflare. Taps are comparable. Replace this table with production numbers after the deploy (`pnpm perf`).

| Network | JS  | Step               | Total (ms) | FCP (ms) | LCP (ms) | KB  | Requests       |
| ------- | --- | ------------------ | ---------- | -------- | -------- | --- | -------------- |
| Fast 4G | on  | First visit: home  | 854        | 428      | 428      | 282 |                |
| Fast 4G | on  | Tap Writing        | 263        | –        | –        | 0   | 0 page, 1 data |
| Fast 4G | on  | Tap Resume         | 650        | –        | –        | 12  | 0 page, 1 data |
| Fast 4G | on  | Tap Asides         | 652        | –        | –        | 0   | 0 page, 1 data |
| Fast 4G | on  | Return visit: home | 201        | 204      | 204      | 0   |                |
| Fast 4G | off | First visit: home  | 410        | 436      | 436      | 215 |                |
| Fast 4G | off | Tap Writing        | 262        | 200      | 200      | 6   | 1 page, 0 data |
| Fast 4G | off | Tap Resume         | 425        | 204      | 204      | 19  | 1 page, 0 data |
| Fast 4G | off | Tap Asides         | 266        | 204      | 204      | 6   | 1 page, 0 data |
| Fast 4G | off | Return visit: home | 195        | 200      | 200      | 0   |                |
| Slow 4G | on  | First visit: home  | 3270       | 1476     | 1476     | 282 |                |
| Slow 4G | on  | Tap Writing        | 1086       | –        | –        | 0   | 0 page, 1 data |
| Slow 4G | on  | Tap Resume         | 1078       | –        | –        | 3   | 0 page, 1 data |
| Slow 4G | on  | Tap Asides         | 1047       | –        | –        | 0   | 0 page, 1 data |
| Slow 4G | on  | Return visit: home | 605        | 608      | 608      | 0   |                |
| Slow 4G | off | First visit: home  | 1259       | 1284     | 1284     | 215 |                |
| Slow 4G | off | Tap Writing        | 671        | 604      | 604      | 6   | 1 page, 0 data |
| Slow 4G | off | Tap Resume         | 1303       | 596      | 616      | 19  | 1 page, 0 data |
| Slow 4G | off | Tap Asides         | 669        | 612      | 612      | 6   | 1 page, 0 data |
| Slow 4G | off | Return visit: home | 601        | 608      | 608      | 0   |                |
| 3G      | on  | First visit: home  | 11444      | 5132     | 5132     | 282 |                |
| 3G      | on  | Tap Writing        | 2542       | –        | –        | 0   | 0 page, 1 data |
| 3G      | on  | Tap Resume         | 2563       | –        | –        | 3   | 0 page, 1 data |
| 3G      | on  | Tap Asides         | 2496       | –        | –        | 10  | 0 page, 1 data |
| 3G      | on  | Return visit: home | 2071       | 2072     | 2072     | 0   |                |
| 3G      | off | First visit: home  | 4456       | 4476     | 4476     | 215 |                |
| 3G      | off | Tap Writing        | 2209       | 2116     | 2116     | 6   | 1 page, 0 data |
| 3G      | off | Tap Resume         | 4471       | 2100     | 2136     | 19  | 1 page, 0 data |
| 3G      | off | Tap Asides         | 2209       | 2128     | 2128     | 6   | 1 page, 0 data |
| 3G      | off | Return visit: home | 2051       | 2056     | 2056     | 0   |                |

## Real-world log

Add a row whenever you try the site on a slow connection. Time from tap until the page is readable, by stopwatch or by feel.

| Date | Device and browser | Network (bars, place) | From → to | JS  | Time (s) | Notes |
| ---- | ------------------ | --------------------- | --------- | --- | -------- | ----- |
|      |                    |                       |           |     |          |       |
