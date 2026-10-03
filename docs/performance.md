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
- **First visit is the slow part now:** text appears at 1.3–1.7 s on Slow 4G and 4.5–5.9 s on 3G, and the page weighs about 290 KB, of which about 200 KB is fonts. They come from two other origins (fonts.googleapis.com, fonts.gstatic.com), each needing its own connection before text renders in its real font. That's the input for #110 (self-hosted fonts).
- **With JS on, `load` comes much later than first paint on 3G** (12.3 s vs 5.9 s): the page is readable at FCP while its scripts keep loading. Reading isn't blocked, but taps before then are full page loads.
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

### Production after #108 (https://bhargavshukla.com)

The reference for the real-world log below.

| Network | JS  | Step               | Total (ms) | FCP (ms) | LCP (ms) | KB  | Requests       |
| ------- | --- | ------------------ | ---------- | -------- | -------- | --- | -------------- |
| Fast 4G | on  | First visit: home  | 940        | 528      | 528      | 289 |                |
| Fast 4G | on  | Tap Writing        | 716        | –        | –        | 1   | 0 page, 1 data |
| Fast 4G | on  | Tap Resume         | 647        | –        | –        | 13  | 0 page, 1 data |
| Fast 4G | on  | Tap Asides         | 648        | –        | –        | 1   | 0 page, 1 data |
| Fast 4G | on  | Return visit: home | 208        | 212      | 212      | 8   |                |
| Fast 4G | off | First visit: home  | 879        | 484      | 484      | 217 |                |
| Fast 4G | off | Tap Writing        | 258        | 204      | 204      | 7   | 1 page, 0 data |
| Fast 4G | off | Tap Resume         | 432        | 208      | 208      | 21  | 1 page, 0 data |
| Fast 4G | off | Tap Asides         | 267        | 204      | 204      | 7   | 1 page, 0 data |
| Fast 4G | off | Return visit: home | 198        | 204      | 204      | 8   |                |
| Slow 4G | on  | First visit: home  | 3528       | 1724     | 1724     | 289 |                |
| Slow 4G | on  | Tap Writing        | 1090       | –        | –        | 1   | 0 page, 1 data |
| Slow 4G | on  | Tap Resume         | 1064       | –        | –        | 3   | 0 page, 1 data |
| Slow 4G | on  | Tap Asides         | 1050       | –        | –        | 1   | 0 page, 1 data |
| Slow 4G | on  | Return visit: home | 626        | 632      | 632      | 8   |                |
| Slow 4G | off | First visit: home  | 1322       | 1344     | 1344     | 217 |                |
| Slow 4G | off | Tap Writing        | 668        | 616      | 616      | 7   | 1 page, 0 data |
| Slow 4G | off | Tap Resume         | 1329       | 648      | 648      | 21  | 1 page, 0 data |
| Slow 4G | off | Tap Asides         | 673        | 616      | 616      | 7   | 1 page, 0 data |
| Slow 4G | off | Return visit: home | 621        | 640      | 640      | 8   |                |
| 3G      | on  | First visit: home  | 12287      | 5856     | 5856     | 289 |                |
| 3G      | on  | Tap Writing        | 2526       | –        | –        | 1   | 0 page, 1 data |
| 3G      | on  | Tap Resume         | 2579       | –        | –        | 3   | 0 page, 1 data |
| 3G      | on  | Tap Asides         | 2479       | –        | –        | 11  | 0 page, 1 data |
| 3G      | on  | Return visit: home | 2192       | 2188     | 2188     | 8   |                |
| 3G      | off | First visit: home  | 4508       | 4532     | 4532     | 217 |                |
| 3G      | off | Tap Writing        | 2219       | 2160     | 2160     | 7   | 1 page, 0 data |
| 3G      | off | Tap Resume         | 4491       | 2256     | 2256     | 21  | 1 page, 0 data |
| 3G      | off | Tap Asides         | 2224       | 2164     | 2164     | 7   | 1 page, 0 data |
| 3G      | off | Return visit: home | 2189       | 2192     | 2192     | 8   |                |

### Self-hosted fonts (#110, measured before deploy)

Both columns are local builds under `wrangler dev`, measured the same way: the #108 branch with Google Fonts, and #110 with self-hosted, slimmed fonts (no preload). Compare local with local: a local build paints about 0.25 s sooner than production on Slow 4G whatever the fonts, because it skips the real network to Cloudflare.

| First visit, home              | Google Fonts  | Self-hosted   |
| ------------------------------ | ------------- | ------------- |
| KB, JS on / off                | 282 / 215     | 181 / 114     |
| First paint, Slow 4G, on / off | 1.48 / 1.28 s | 1.47 / 1.28 s |
| First paint, 3G, on / off      | 5.13 / 4.48 s | 5.10 / 4.41 s |
| Fully loaded, JS on, Slow 4G   | 3.27 s        | 2.60 s        |
| Fully loaded, JS on, 3G        | 11.44 s       | 9.22 s        |

- About 100 KB less on a first visit, and with JS on the page finishes loading about 20% sooner.
- First paint barely moves in the simulation. Throttling adds latency per request but doesn't model opening connections to two more origins (fonts.googleapis.com, fonts.gstatic.com: DNS, TCP and TLS each), which is where a real phone should gain more. The production run after the deploy is the real comparison.
- **Preloading the roman font was slower:** with a `<link rel="preload">`, first paint with JS off went from 1.28 to 1.46 s on Slow 4G and from 4.41 to 4.71 s on 3G, because the font took bandwidth from the CSS the page needs before it can paint. So the fonts aren't preloaded.

| Network | JS  | Step               | Total (ms) | FCP (ms) | LCP (ms) | KB  | Requests       |
| ------- | --- | ------------------ | ---------- | -------- | -------- | --- | -------------- |
| Fast 4G | on  | First visit: home  | 794        | 416      | 416      | 181 |                |
| Fast 4G | on  | Tap Writing        | 258        | –        | –        | 0   | 0 page, 1 data |
| Fast 4G | on  | Tap Resume         | 231        | –        | –        | 3   | 0 page, 1 data |
| Fast 4G | on  | Tap Asides         | 232        | –        | –        | 0   | 0 page, 1 data |
| Fast 4G | on  | Return visit: home | 200        | 204      | 204      | 0   |                |
| Fast 4G | off | First visit: home  | 374        | 392      | 392      | 114 |                |
| Fast 4G | off | Tap Writing        | 253        | 196      | 196      | 6   | 1 page, 0 data |
| Fast 4G | off | Tap Resume         | 434        | 204      | 204      | 19  | 1 page, 0 data |
| Fast 4G | off | Tap Asides         | 261        | 204      | 204      | 6   | 1 page, 0 data |
| Fast 4G | off | Return visit: home | 197        | 200      | 200      | 0   |                |
| Slow 4G | on  | First visit: home  | 2596       | 1472     | 1472     | 181 |                |
| Slow 4G | on  | Tap Writing        | 1094       | –        | –        | 0   | 0 page, 1 data |
| Slow 4G | on  | Tap Resume         | 1065       | –        | –        | 3   | 0 page, 1 data |
| Slow 4G | on  | Tap Asides         | 1045       | –        | –        | 0   | 0 page, 1 data |
| Slow 4G | on  | Return visit: home | 600        | 604      | 604      | 0   |                |
| Slow 4G | off | First visit: home  | 1257       | 1280     | 1280     | 114 |                |
| Slow 4G | off | Tap Writing        | 665        | 612      | 612      | 6   | 1 page, 0 data |
| Slow 4G | off | Tap Resume         | 1303       | 600      | 620      | 19  | 1 page, 0 data |
| Slow 4G | off | Tap Asides         | 673        | 612      | 612      | 6   | 1 page, 0 data |
| Slow 4G | off | Return visit: home | 593        | 596      | 596      | 0   |                |
| 3G      | on  | First visit: home  | 9221       | 5100     | 5100     | 181 |                |
| 3G      | on  | Tap Writing        | 2551       | –        | –        | 0   | 0 page, 1 data |
| 3G      | on  | Tap Resume         | 2578       | –        | –        | 3   | 0 page, 1 data |
| 3G      | on  | Tap Asides         | 2498       | –        | –        | 10  | 0 page, 1 data |
| 3G      | on  | Return visit: home | 2042       | 2048     | 2048     | 0   |                |
| 3G      | off | First visit: home  | 4387       | 4408     | 4408     | 114 |                |
| 3G      | off | Tap Writing        | 2212       | 2132     | 2132     | 6   | 1 page, 0 data |
| 3G      | off | Tap Resume         | 4438       | 2076     | 2112     | 19  | 1 page, 0 data |
| 3G      | off | Tap Asides         | 2185       | 2108     | 2108     | 6   | 1 page, 0 data |
| 3G      | off | Return visit: home | 2057       | 2060     | 2060     | 0   |                |

## Real-world log

Add a row whenever you try the site on a slow connection. Time from tap until the page is readable, by stopwatch or by feel.

| Date | Device and browser | Network (bars, place) | From → to | JS  | Time (s) | Notes |
| ---- | ------------------ | --------------------- | --------- | --- | -------- | ----- |
|      |                    |                       |           |     |          |       |
