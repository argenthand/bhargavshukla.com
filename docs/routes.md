# Routes and source layout

```
src/
  hooks.server.ts                 the look's first-paint script (#141), cache tags, draft-preview cookie check (#57), edge-cache wrapper — see caching.md
  app.d.ts                        App.Locals { cacheTags: Set<string> }, App.Platform
  lib/                            one folder per domain (CONTEXT.md); each has an index.ts, and index.server.ts for server code
    site/                         the site and its chrome: Sections, nav, share cards, page motion
      site.ts                     name, links, Primary nav (`live` flags hide sections until they ship)
      share.ts                    share card size and URLs (cardUrl), for <Seo>
      motion.ts, transitions.ts   reduced motion and motionMs; page and title view transitions
      toast.svelte.ts             the bottom-of-screen message (#143)
      components/                 Seo, Icon, NavProgress, BackToTop (posts: ring = reading progress, #77), Toast
      server/                     og.ts (share cards: satori 0.32 + resvg-wasm, #62), feeds.ts (RSS and sitemap, #56)
    content/                      Content types: posts, asides, profile, resume, privacy note
      types.ts                    Post, PostSummary, Category, Media, Seo, Link, Heading, Tag, Aside, RenderedAside
      format.ts, asides.ts        dates as shown (UTC); aside kinds and page size
      components/                 PostMeta, Prose (+ code Copy), Toc, NextUp, AsideItem, ProfileHeader
      server/                     strapi.ts (typed REST client; records cache tags into locals), posts.ts, asides.ts (#18),
                                  single-types.ts (Profile and Privacy note, #42, #154), resume.ts (#5), markdown.ts (marked + Shiki, firstParagraph;
                                  h2/h3 ids + ToC list), image.ts, images.ts (credited external images, #40)
    look/                         the look (#141): theme, chosen palette, 8-bit mode and the easter eggs
      look.svelte.ts              the look: the only writer of its storage and <html> attributes
      palettes.ts                 PALETTES (#81): plain data, shared with scripts/print-notes.mjs
      boot/                       look-boot.ts, the first-paint script (look-boot.script.js, raw text), put in app.html by the hooks
      eight-bit/                  8-bit mode's sound switch, blips and the Konami unlock (#111)
      easter-eggs/                gestures.ts (quick taps, the Konami code, #143), easter-eggs.ts (copy), disco.ts, intro.svelte.ts
      components/                 ThemeToggle (#80), PalettePicker (#81), EightBitBanner, Controller, Shortcuts (#63)
    analytics/                    events and read counts (#154)
      events.ts, analytics.ts     the events and their properties, shared by the beacon and the Worker; the beacon
      reads.ts, components/       client read counts; ReadCount
      server/                     events.ts (checks the beacon, counts in Analytics Engine), reads.ts (D1)
    contact/                      the contact card (#135): rules shared by card and server, Turnstile, the form action
    publishing/                   publish, purge, repopulate, degraded pages (server only)
      server/                     content-map.ts, purge.ts, repopulate.ts, edge-cache.ts (cache key, bypass rules, TTL),
                                  preview.ts (draft preview, #57), page-load.ts
      tests/                      the content map's integration spec
  routes/
    +layout.svelte                header nav (md+) and bottom tab bar (below md), footer; preview banner
    +layout.server.ts             { preview } for the banner (#57)
    +page.svelte, +page.server.ts /                 intro + up to 3 featured posts (the newest posts while none are featured)
    +error.svelte                 404 / 5xx
    resume/+page.server.ts        /resume           Strapi Resume + Profile (an empty state until published, #91); print styles, Save as PDF
    privacy/+page.server.ts       /privacy          Strapi Privacy: the privacy note, linked from the footer (#154); 404 until saved
    blog/+page.server.ts          /blog             all posts by year; client-side search + category filter (?q=&cat=)
    blog/[slug]/+page.server.ts   /blog/:slug       ToC + up to 2 recommended posts ("Next up")
    asides/+page.server.ts        /asides           every aside in full; ?kind= ?tag= ?page= from the URL, client-side
    asides/[slug]/+page.server.ts /asides/:slug     one aside, Newer / Older
    rss.xml/+server.ts            /rss.xml          RSS 2.0, newest 20 posts; linked from the layout head and footer
    sitemap.xml/+server.ts        /sitemap.xml      home, /blog, posts; /asides + asides and /resume only while live (isLive)
    og/blog/[slug].png/+server.ts   /og/blog/:slug.png    a post's share card (1200×630)
    og/asides/[slug].png/+server.ts /og/asides/:slug.png  an aside's share card
    og/default.png/+server.ts       /og/default.png       the site card: home and pages without their own
    api/purge/+server.ts          Strapi webhook target (POST)
    api/preview/+server.ts        Strapi "Open preview" → checks the signed link, sets the signed preview cookie (#57)
    api/preview/exit/+server.ts   preview banner "Exit" → clears the cookie
    api/views/+server.ts          read counts (#87): GET counts for some pages, POST the 10-second beacon
    api/print-contact/+server.ts  the printed resume's email, encoded (#135)
    api/events/+server.ts         the analytics beacon's events → Analytics Engine, always 204 (#154)

Every page route's +page.server.ts builds its load with `pageLoad` and exports `actions = pageActions` (`src/lib/publishing/server/page-load.ts`, #142): drafts in preview, degraded pages when Strapi is down (caching.md → Degraded pages), and the contact card's form (#135, contact.md).
```

## How `src/lib` is organised (#157)

Each folder in `src/lib` is one domain from [CONTEXT.md](../CONTEXT.md), and the folder's `index.ts` (and `index.server.ts`, for server code) is its interface. Routes, hooks and other domains import only from there, for example `$lib/look` or `$lib/content/index.server`, never from the files behind it. ESLint enforces this (`eslint.config.js`), including that a domain's client code can't import its own `server/` folder (SvelteKit only guards `index.server`). There are no exceptions. Analytics spells out the palette ids it accepts (`PALETTE_IDS` in `analytics/events.ts`) rather than importing the look, and `analytics/events.spec.ts` fails if they differ from `PALETTES`.

Specs sit next to the module they test. The `.svelte.spec.ts` suffix sends a spec to the browser project; every other spec runs in Node. Specs that cover more than one module are in the domain's `tests/` folder, or in `src/routes/pages.spec.ts` when they exercise the routes.

## Conventions

- Layout, tokens, component classes and behaviour follow [design.md](design.md). The nav stays at three items; see [design.md → Sections](design.md#sections).
- `app.html` adds a `js` class to `<html>`; the `js:` Tailwind variant shows JavaScript-only UI (ToC pill, Copy buttons) and hides no-JS fallbacks.
- Every page renders `<Seo>`: title (+ site name), description, canonical on the production origin without the query string, Open Graph and Twitter tags. Posts use `seo.metaTitle`, `seo.metaDescription`, `seo.canonicalUrl` and `seo.ogImage` when set, else title, summary and cover. Error pages are `noindex`.
- Every `load` that reads content goes through `strapi(locals)`. The client fetches the data and records a `type:<content type>` cache tag for the page (see [caching.md](caching.md)). Every route that shows content is declared in the content map (`src/lib/publishing/server/content-map.ts`, #140) with the content types it shows; a test runs the real loads and fails if they read anything else, and another fails if a route is missing.
- A missing slug throws `error(404)`. Error responses are never cached.
- `+server.ts` routes that read Strapi (RSS, sitemap) are edge-cached and purged like pages: the cache keeps their `content-type`. `static/robots.txt` points to the sitemap.
- Cacheable `load`s await everything — no streamed promises — so the cached body is complete.
- Svelte code follows AGENTS.md: run the Svelte MCP `svelte-autofixer` on every `.svelte` file written.
