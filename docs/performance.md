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

Superseded as the reference by [Production after #117](#production-after-117-httpsbhargavshuklacom).

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

### Self-hosted fonts (#110)

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

#### Production after #110 (https://bhargavshukla.com)

Against production after #108 (Google Fonts), measured the same day:

| First visit, home                 | Google Fonts   | Self-hosted    |
| --------------------------------- | -------------- | -------------- |
| KB, JS on / off                   | 289 / 217      | 189 / 116      |
| First paint, Slow 4G, on / off    | 1.72 / 1.34 s  | 1.71 / 1.33 s  |
| First paint, 3G, on / off         | 5.86 / 4.53 s  | 5.88 / 4.50 s  |
| Fully loaded, JS on, Slow 4G / 3G | 3.53 / 12.29 s | 2.93 / 10.24 s |

The same picture as the local builds: 100 KB less, fully loaded about 17% sooner, and first paint unchanged in the simulation. Whether a real phone paints sooner without the two Google connections is a question for the real-world log.

| Network | JS  | Step               | Total (ms) | FCP (ms) | LCP (ms) | KB  | Requests       |
| ------- | --- | ------------------ | ---------- | -------- | -------- | --- | -------------- |
| Fast 4G | on  | First visit: home  | 931        | 544      | 544      | 189 |                |
| Fast 4G | on  | Tap Writing        | 699        | –        | –        | 1   | 0 page, 1 data |
| Fast 4G | on  | Tap Resume         | 248        | –        | –        | 3   | 0 page, 1 data |
| Fast 4G | on  | Tap Asides         | 233        | –        | –        | 1   | 0 page, 1 data |
| Fast 4G | on  | Return visit: home | 208        | 212      | 212      | 7   |                |
| Fast 4G | off | First visit: home  | 432        | 452      | 452      | 116 |                |
| Fast 4G | off | Tap Writing        | 253        | 204      | 204      | 6   | 1 page, 0 data |
| Fast 4G | off | Tap Resume         | 433        | 208      | 208      | 20  | 1 page, 0 data |
| Fast 4G | off | Tap Asides         | 265        | 208      | 208      | 6   | 1 page, 0 data |
| Fast 4G | off | Return visit: home | 197        | 204      | 204      | 7   |                |
| Slow 4G | on  | First visit: home  | 2933       | 1712     | 1712     | 189 |                |
| Slow 4G | on  | Tap Writing        | 1071       | –        | –        | 1   | 0 page, 1 data |
| Slow 4G | on  | Tap Resume         | 1065       | –        | –        | 3   | 0 page, 1 data |
| Slow 4G | on  | Tap Asides         | 1047       | –        | –        | 1   | 0 page, 1 data |
| Slow 4G | on  | Return visit: home | 631        | 632      | 632      | 7   |                |
| Slow 4G | off | First visit: home  | 1308       | 1332     | 1332     | 116 |                |
| Slow 4G | off | Tap Writing        | 672        | 620      | 620      | 6   | 1 page, 0 data |
| Slow 4G | off | Tap Resume         | 1330       | 652      | 652      | 20  | 1 page, 0 data |
| Slow 4G | off | Tap Asides         | 671        | 616      | 616      | 6   | 1 page, 0 data |
| Slow 4G | off | Return visit: home | 626        | 632      | 632      | 7   |                |
| 3G      | on  | First visit: home  | 10243      | 5880     | 5880     | 189 |                |
| 3G      | on  | Tap Writing        | 2540       | –        | –        | 1   | 0 page, 1 data |
| 3G      | on  | Tap Resume         | 2563       | –        | –        | 3   | 0 page, 1 data |
| 3G      | on  | Tap Asides         | 2479       | –        | –        | 11  | 0 page, 1 data |
| 3G      | on  | Return visit: home | 2192       | 2192     | 2192     | 7   |                |
| 3G      | off | First visit: home  | 4482       | 4504     | 4504     | 116 |                |
| 3G      | off | Tap Writing        | 2224       | 2168     | 2168     | 6   | 1 page, 0 data |
| 3G      | off | Tap Resume         | 4521       | 2256     | 2256     | 20  | 1 page, 0 data |
| 3G      | off | Tap Asides         | 2219       | 2164     | 2164     | 6   | 1 page, 0 data |
| 3G      | off | Return visit: home | 2186       | 2188     | 2188     | 7   |                |

### Inline CSS (#117)

Lighthouse (mobile, 2026-10-03) put most of the LCP in "render delay": the stylesheet (16 KB) had to arrive before anything painted. #117 puts all CSS in the HTML (`inlineStyleThreshold` in `vite.config.ts`) and has Tailwind read `src/` only. It used to read the docs, the CMS and skill files too, which shipped about 60 classes no page uses (95.6 → 86.0 KB raw).

Local builds, before and after, measured the same way:

| First visit, home                  | Before (#110) | Inline CSS    | Inline CSS + font preload |
| ---------------------------------- | ------------- | ------------- | ------------------------- |
| First paint, Slow 4G, JS on        | 1.48 s        | 0.70 s        | 0.80 s                    |
| First paint, 3G, JS on             | 5.10 s        | 2.38 s        | 2.38 s                    |
| Fully loaded, JS on, 3G            | 9.19 s        | 6.97 s        | 11.44 s                   |
| Lighthouse FCP / LCP (median of 5) | 1.96 / 2.41 s | 1.88 / 2.41 s | 1.67 / 2.57 s             |

- **First paint is more than twice as fast** on slow networks, with JS on or off.
- **The cost:** with JS off, every full page load carries the CSS (about 15 KB compressed): a tap is 20 KB instead of 6 KB, and paints about 0.06 s later on Slow 4G and 0.23 s later on 3G. With JS on, taps only fetch data, so nothing changes.
- **With JS off, "Total" is higher on a first visit** (Slow 4G 1.26 → 1.78 s): the fonts are found in the HTML now, so `load` waits for them. Text shows long before, in the matched fallback.
- **Font preload, tried again:** still slower, now competing with the JavaScript; not used.
- **Lighthouse barely moves:** its simulation ties the LCP text to its font download and doesn't credit the fallback paint, so the score stays about the same while real first paint halves.

| Network | JS  | Step               | Total (ms) | FCP (ms) | LCP (ms) | KB  | Requests       |
| ------- | --- | ------------------ | ---------- | -------- | -------- | --- | -------------- |
| Fast 4G | on  | First visit: home  | 630        | 212      | 212      | 180 |                |
| Fast 4G | on  | Tap Writing        | 265        | –        | –        | 0   | 0 page, 1 data |
| Fast 4G | on  | Tap Resume         | 231        | –        | –        | 3   | 0 page, 1 data |
| Fast 4G | on  | Tap Asides         | 649        | –        | –        | 0   | 0 page, 1 data |
| Fast 4G | on  | Return visit: home | 198        | 204      | 204      | 0   |                |
| Fast 4G | off | First visit: home  | 464        | 200      | 228      | 112 |                |
| Fast 4G | off | Tap Writing        | 261        | 200      | 200      | 20  | 1 page, 0 data |
| Fast 4G | off | Tap Resume         | 430        | 192      | 208      | 33  | 1 page, 0 data |
| Fast 4G | off | Tap Asides         | 263        | 208      | 208      | 20  | 1 page, 0 data |
| Fast 4G | off | Return visit: home | 200        | 204      | 204      | 0   |                |
| Slow 4G | on  | First visit: home  | 1988       | 700      | 700      | 180 |                |
| Slow 4G | on  | Tap Writing        | 1075       | –        | –        | 0   | 0 page, 1 data |
| Slow 4G | on  | Tap Resume         | 1062       | –        | –        | 3   | 0 page, 1 data |
| Slow 4G | on  | Tap Asides         | 1050       | –        | –        | 0   | 0 page, 1 data |
| Slow 4G | on  | Return visit: home | 605        | 608      | 608      | 0   |                |
| Slow 4G | off | First visit: home  | 1775       | 688      | 708      | 112 |                |
| Slow 4G | off | Tap Writing        | 743        | 672      | 676      | 20  | 1 page, 0 data |
| Slow 4G | off | Tap Resume         | 1378       | 672      | 696      | 33  | 1 page, 0 data |
| Slow 4G | off | Tap Asides         | 750        | 684      | 696      | 20  | 1 page, 0 data |
| Slow 4G | off | Return visit: home | 598        | 600      | 600      | 0   |                |
| 3G      | on  | First visit: home  | 6971       | 2384     | 2412     | 180 |                |
| 3G      | on  | Tap Writing        | 2525       | –        | –        | 0   | 0 page, 1 data |
| 3G      | on  | Tap Resume         | 2548       | –        | –        | 3   | 0 page, 1 data |
| 3G      | on  | Tap Asides         | 2482       | –        | –        | 10  | 0 page, 1 data |
| 3G      | on  | Return visit: home | 2041       | 2048     | 2048     | 0   |                |
| 3G      | off | First visit: home  | 6253       | 2364     | 2428     | 112 |                |
| 3G      | off | Tap Writing        | 2480       | 2364     | 2400     | 20  | 1 page, 0 data |
| 3G      | off | Tap Resume         | 4716       | 2380     | 2440     | 33  | 1 page, 0 data |
| 3G      | off | Tap Asides         | 2488       | 2396     | 2396     | 20  | 1 page, 0 data |
| 3G      | off | Return visit: home | 2053       | 2060     | 2060     | 0   |                |

#### Production after #117 (https://bhargavshukla.com)

Against production after #110, both with a warm edge cache:

| First visit, home                 | After #110    | After #117    |
| --------------------------------- | ------------- | ------------- |
| Lighthouse score (median of 5)    | 99            | 100           |
| Lighthouse FCP / LCP              | 1.5 / 1.9 s   | 1.04 / 1.04 s |
| First paint, Slow 4G, JS on / off | 1.71 / 1.33 s | 0.78 / 0.77 s |
| First paint, 3G, JS on / off      | 5.88 / 4.50 s | 2.55 / 2.56 s |

In production Lighthouse does credit it: LCP drops with FCP, unlike the local build.

| Network | JS  | Step               | Total (ms) | FCP (ms) | LCP (ms) | KB  | Requests       |
| ------- | --- | ------------------ | ---------- | -------- | -------- | --- | -------------- |
| Fast 4G | on  | First visit: home  | 600        | 292      | 292      | 187 |                |
| Fast 4G | on  | Tap Writing        | 260        | –        | –        | 1   | 0 page, 1 data |
| Fast 4G | on  | Tap Resume         | 651        | –        | –        | 13  | 0 page, 1 data |
| Fast 4G | on  | Tap Asides         | 663        | –        | –        | 1   | 0 page, 1 data |
| Fast 4G | on  | Return visit: home | 212        | 208      | 208      | 23  |                |
| Fast 4G | off | First visit: home  | 524        | 272      | 272      | 114 |                |
| Fast 4G | off | Tap Writing        | 258        | 204      | 204      | 22  | 1 page, 0 data |
| Fast 4G | off | Tap Resume         | 451        | 220      | 220      | 36  | 1 page, 0 data |
| Fast 4G | off | Tap Asides         | 272        | 208      | 208      | 22  | 1 page, 0 data |
| Fast 4G | off | Return visit: home | 206        | 208      | 208      | 23  |                |
| Slow 4G | on  | First visit: home  | 2152       | 780      | 780      | 187 |                |
| Slow 4G | on  | Tap Writing        | 1081       | –        | –        | 1   | 0 page, 1 data |
| Slow 4G | on  | Tap Resume         | 1083       | –        | –        | 3   | 0 page, 1 data |
| Slow 4G | on  | Tap Asides         | 1031       | –        | –        | 1   | 0 page, 1 data |
| Slow 4G | on  | Return visit: home | 721        | 720      | 720      | 23  |                |
| Slow 4G | off | First visit: home  | 1866       | 772      | 772      | 114 |                |
| Slow 4G | off | Tap Writing        | 770        | 708      | 708      | 22  | 1 page, 0 data |
| Slow 4G | off | Tap Resume         | 1411       | 740      | 740      | 36  | 1 page, 0 data |
| Slow 4G | off | Tap Asides         | 766        | 708      | 708      | 22  | 1 page, 0 data |
| Slow 4G | off | Return visit: home | 718        | 720      | 720      | 23  |                |
| 3G      | on  | First visit: home  | 7455       | 2548     | 2548     | 187 |                |
| 3G      | on  | Tap Writing        | 2533       | –        | –        | 1   | 0 page, 1 data |
| 3G      | on  | Tap Resume         | 2578       | –        | –        | 3   | 0 page, 1 data |
| 3G      | on  | Tap Asides         | 2514       | –        | –        | 11  | 0 page, 1 data |
| 3G      | on  | Return visit: home | 2501       | 2500     | 2500     | 23  |                |
| 3G      | off | First visit: home  | 6439       | 2556     | 2556     | 114 |                |
| 3G      | off | Tap Writing        | 2528       | 2468     | 2468     | 22  | 1 page, 0 data |
| 3G      | off | Tap Resume         | 4840       | 2580     | 2580     | 36  | 1 page, 0 data |
| 3G      | off | Tap Asides         | 2526       | 2468     | 2468     | 22  | 1 page, 0 data |
| 3G      | off | Return visit: home | 2498       | 2500     | 2500     | 23  |                |

### Workers Cache (#123)

Production right after the deploy, 2026-10-04, from Toronto/Montréal:

| Request                        | Before #123 (Cache API)                              | After #123 (Workers Cache)                                                                          |
| ------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Page, cache hit                | ~0.10 s                                              | 0.07–0.12 s, also from a data centre that hadn't seen the page (filled in Toronto, hit in Montréal) |
| Page, miss                     | ~0.55 s, on each data centre's first visit and daily | 0.66–1.08 s, only the first request anywhere after a deploy or purge                                |
| Lighthouse (median of 5, warm) | 100, FCP/LCP 1.04 s                                  | 100, FCP/LCP 1.12 s                                                                                 |

`pnpm perf` matches production after #117 within noise: first paint on Slow 4G 0.78 s, on 3G 2.55 s; taps 1.07 / 2.54 s. Workers Cache doesn't make a hit faster; it makes misses rare ([edge-cache-misses.md](edge-cache-misses.md)).

- **Return visits** download the whole page (about 23 KB with the inlined CSS, since #117): pages have no `ETag`, so the browser's revalidation can't get a `304 Not Modified`. Fixed in #126, below.

#### Production after #123 (https://bhargavshukla.com)

The current reference for the real-world log.

| Network | JS  | Step               | Total (ms) | FCP (ms) | LCP (ms) | KB  | Requests       |
| ------- | --- | ------------------ | ---------- | -------- | -------- | --- | -------------- |
| Fast 4G | on  | First visit: home  | 562        | 248      | 248      | 187 |                |
| Fast 4G | on  | Tap Writing        | 689        | –        | –        | 1   | 0 page, 1 data |
| Fast 4G | on  | Tap Resume         | 648        | –        | –        | 13  | 0 page, 1 data |
| Fast 4G | on  | Tap Asides         | 646        | –        | –        | 0   | 0 page, 1 data |
| Fast 4G | on  | Return visit: home | 211        | 208      | 208      | 23  |                |
| Fast 4G | off | First visit: home  | 526        | 264      | 264      | 114 |                |
| Fast 4G | off | Tap Writing        | 260        | 204      | 204      | 22  | 1 page, 0 data |
| Fast 4G | off | Tap Resume         | 441        | 212      | 212      | 36  | 1 page, 0 data |
| Fast 4G | off | Tap Asides         | 258        | 208      | 208      | 22  | 1 page, 0 data |
| Fast 4G | off | Return visit: home | 208        | 208      | 208      | 23  |                |
| Slow 4G | on  | First visit: home  | 2155       | 780      | 780      | 187 |                |
| Slow 4G | on  | Tap Writing        | 1065       | –        | –        | 1   | 0 page, 1 data |
| Slow 4G | on  | Tap Resume         | 1065       | –        | –        | 3   | 0 page, 1 data |
| Slow 4G | on  | Tap Asides         | 1047       | –        | –        | 0   | 0 page, 1 data |
| Slow 4G | on  | Return visit: home | 717        | 716      | 716      | 23  |                |
| Slow 4G | off | First visit: home  | 1859       | 768      | 768      | 114 |                |
| Slow 4G | off | Tap Writing        | 772        | 716      | 716      | 22  | 1 page, 0 data |
| Slow 4G | off | Tap Resume         | 1402       | 736      | 736      | 36  | 1 page, 0 data |
| Slow 4G | off | Tap Asides         | 760        | 704      | 704      | 22  | 1 page, 0 data |
| Slow 4G | off | Return visit: home | 717        | 716      | 716      | 23  |                |
| 3G      | on  | First visit: home  | 7452       | 2548     | 2548     | 187 |                |
| 3G      | on  | Tap Writing        | 2542       | –        | –        | 1   | 0 page, 1 data |
| 3G      | on  | Tap Resume         | 2563       | –        | –        | 3   | 0 page, 1 data |
| 3G      | on  | Tap Asides         | 2514       | –        | –        | 11  | 0 page, 1 data |
| 3G      | on  | Return visit: home | 2487       | 2488     | 2488     | 23  |                |
| 3G      | off | First visit: home  | 6434       | 2548     | 2548     | 114 |                |
| 3G      | off | Tap Writing        | 2522       | 2460     | 2460     | 22  | 1 page, 0 data |
| 3G      | off | Tap Resume         | 4847       | 2584     | 2584     | 36  | 1 page, 0 data |
| 3G      | off | Tap Asides         | 2517       | 2464     | 2464     | 22  | 1 page, 0 data |
| 3G      | off | Return visit: home | 2490       | 2492     | 2492     | 23  |                |

### Fonts per palette (#114)

Each palette now has its own typeface; code moved to Space Mono. Measured 2026-10-04, `pnpm perf --palette <id>` (new flag) on a local build, Slow 4G, JS on, first visit:

| Palette                   | KB on a first visit | First paint |
| ------------------------- | ------------------- | ----------- |
| Newsprint (Newsreader)    | 180                 | 0.70 s      |
| Harbour (Instrument Sans) | 122                 | 0.70 s      |
| Sage (Literata)           | 150                 | 0.70 s      |

- **Newsprint visitors:** the same font files as before. The other palettes' `@font-face` rules make the compressed page about 0.6 KB bigger.
- **A false alarm, documented so it isn't chased again:** locally, a Newsprint first visit took 2.33 s to fully load against `main`'s 2.00 s. Builds with the extra rules present but inactive were just as slow, so it was the page bytes, not the rules. On Cloudflare (preview versions of `main` and the branch, timed back to back) the two were identical: Slow 4G 2.14–2.15 s vs 2.15–2.17 s, 3G 7.48 s both. The local `wrangler dev` setup exaggerates it.
- **Comparing against a `workers.dev` preview:** don't time a preview against production. The preview served the same JavaScript as 73 KB against production's 27 KB, so compare two previews instead.

### Validators (#126)

Return visits now revalidate: the browser asks whether the page changed and gets `304 Not Modified` with no body ([caching.md](caching.md#validators-126)). Production, 2026-10-04, `pnpm perf`, 3 runs, medians, home with a warm browser cache:

| Network | JS  | Before #126    | After #126    |
| ------- | --- | -------------- | ------------- |
| Fast 4G | on  | 211 ms, 23 KB  | 205 ms, 2 KB  |
| Slow 4G | on  | 717 ms, 23 KB  | 619 ms, 2 KB  |
| 3G      | on  | 2487 ms, 23 KB | 2084 ms, 2 KB |
| 3G      | off | 2490 ms, 23 KB | 2076 ms, 2 KB |

- **It's still one round trip:** a 304 can't skip the request, it only skips the body. A return visit costs about one round trip plus size ÷ bandwidth, so the time saved is the 21 KB no longer downloaded:

  | Network | Bandwidth   | Expected saving | Measured     |
  | ------- | ----------- | --------------- | ------------ |
  | Fast 4G | 8.1 Mbit/s  | ~21 ms          | 6 ms (noise) |
  | Slow 4G | 1.44 Mbit/s | ~117 ms         | 98 ms        |
  | 3G      | 0.4 Mbit/s  | ~420 ms         | 403 ms       |

  On Fast 4G the 165 ms round trip dominates and 21 KB barely registers; the bytes matter on slow links.

- **Real networks likely save more:** DevTools throttling only adds a fixed delay and caps bandwidth. A new real connection sends about 14 KB in its first round trip (TCP slow start; QUIC is similar), so the 23 KB page needed a second round trip and the 2 KB 304 doesn't. On real 4G that's worth about a round trip (~165 ms), not 21 ms. The emulation can't show it.
- **Everything else matches #123 within noise:** first visits and taps are unchanged.

### Analytics beacon (#154)

The beacon adds about 1.4 KB gz to the site's JavaScript (all client chunks, measured against `main`); there's no Web Vitals library, since Cloudflare Web Analytics measures those. Beacons go out with `sendBeacon`, which never holds up the page, and only when a page with events is hidden ([analytics.md](analytics.md#built-154)). Production before #154, 2026-10-05, `pnpm perf`, 3 runs, medians, JS on:

| Network | First visit: home          | Tap Writing | Return visit: home |
| ------- | -------------------------- | ----------- | ------------------ |
| Fast 4G | 590 ms (FCP 292), 199 KB   | 257 ms      | 197 ms, 2 KB       |
| Slow 4G | 2212 ms (FCP 800), 199 KB  | 1082 ms     | 612 ms, 2 KB       |
| 3G      | 7690 ms (FCP 2648), 199 KB | 2550 ms     | 2088 ms, 2 KB      |

After #154 (2026-10-06, same runs and medians; Web Analytics off, page views and events counted by our own beacon):

| Network | First visit: home          | Tap Writing | Return visit: home |
| ------- | -------------------------- | ----------- | ------------------ |
| Fast 4G | 634 ms (FCP 332), 201 KB   | 691 ms      | 206 ms, 2 KB       |
| Slow 4G | 2234 ms (FCP 816), 201 KB  | 1078 ms     | 618 ms, 2 KB       |
| 3G      | 7752 ms (FCP 2644), 201 KB | 2537 ms     | 2093 ms, 2 KB      |

- **Within noise:** 2 KB more on a first visit; times on Slow 4G and 3G match. The Fast 4G first visit's 40 ms is noise too (a rerun: 608 ms, FCP 288).
- **Fast 4G taps are bimodal, before and after:** a tap takes about 250 ms or about 670 ms, whichever tab draws it (Asides before #154, Writing after). The same tap with no beacon sent at all (`noCount`) splits the same way, six runs, so it's the network path, not analytics. The data comes from the edge cache either way (`HIT`).

## Real-world log

Add a row whenever you try the site on a slow connection. Time from tap until the page is readable, by stopwatch or by feel.

| Date | Device and browser | Network (bars, place) | From → to | JS  | Time (s) | Notes |
| ---- | ------------------ | --------------------- | --------- | --- | -------- | ----- |
|      |                    |                       |           |     |          |       |
