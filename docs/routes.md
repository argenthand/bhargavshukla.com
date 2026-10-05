# Routes and source layout

```
src/
  hooks.server.ts                 the look's first-paint script (#141), cache tags, draft-preview cookie check (#57), edge-cache wrapper — see caching.md
  app.d.ts                        App.Locals { cacheTags: Set<string> }, App.Platform
  lib/
    look.svelte.ts                the look (#141, CONTEXT.md): theme, chosen palette, 8-bit mode; the only writer of their storage and <html> attributes
    look-boot.ts                  the look's first-paint script (look-boot.script.js, raw text), put in app.html by the hooks
    palettes.ts                   PALETTES (#81): plain data, shared with scripts/print-notes.mjs
    eight-bit.svelte.ts           8-bit mode's sound switch, blips and the Konami unlock (#111)
    gestures.ts                   easter eggs' gestures (#143): quick taps ({@attach taps(…)}), the Konami code
    easter-eggs.ts                easter eggs' copy (abyss line, 404 lines, console note)
    format.ts                     dates as shown (UTC), shown date = displayDate ?? publishedAt
    site.ts                       name, links, Primary nav (`live` flags hide sections until they ship)
    types/content.ts              Post, PostSummary, Category, Media, Seo, Link, Heading, Tag, Aside, RenderedAside
    components/                   Icon.svelte, PostMeta.svelte (category · date), Prose.svelte (+ code Copy),
                                  Toc.svelte (pill + sheet, or sidebar), NextUp.svelte, Seo.svelte; AsideItem.svelte;
                                  BackToTop.svelte (posts: back to the title, ring = reading progress, #77);
                                  Shortcuts.svelte (keyboard shortcuts, #63); Toast.svelte (the easter eggs' message, #143);
                                  ThemeToggle.svelte (Light / Dark / System, #80); PalettePicker.svelte (colour palettes, #81)
    server/
      strapi.ts                   typed REST client; records cache tags into locals
      posts.ts                    post queries (lists, one post, home picks, Next up)
      profile.ts, resume.ts       single types (#42, #5), Markdown fields rendered on the server
      asides.ts                   aside queries, untitled-aside labels (#18)
      markdown.ts                 marked + Shiki (fine-grained bundle, JS regex engine); h2/h3 ids + ToC list
      edge-cache.ts               cache key, bypass rules, TTL constants
      purge.ts                    webhook payload → tags; Cloudflare purge API call
      feeds.ts                    RSS and sitemap XML builders (#56)
      preview.ts                  draft preview: signed links and cookies, mergeDrafts (#57)
      og.ts                       share cards: satori (0.32) + resvg-wasm templates and renderer (#62)
    share.ts                      share card size and URLs (cardUrl), for <Seo>
  routes/
    +layout.svelte                header nav (md+) and bottom tab bar (below md), footer; preview banner
    +layout.server.ts             { preview } for the banner (#57)
    +page.svelte, +page.server.ts /                 intro + up to 3 featured posts (the newest posts while none are featured)
    +error.svelte                 404 / 5xx
    resume/+page.server.ts        /resume           Strapi Resume + Profile (an empty state until published, #91); print styles, Save as PDF
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

Every page route's +page.server.ts builds its load with `pageLoad` and exports `actions = pageActions` (`src/lib/server/page-load.ts`, #142): drafts in preview, degraded pages when Strapi is down (caching.md → Degraded pages), and the contact card's form (#135, contact.md).
```

## Conventions

- Layout, tokens, component classes and behaviour follow [design.md](design.md). The nav stays at three items; see [design.md → Sections](design.md#sections).
- `app.html` adds a `js` class to `<html>`; the `js:` Tailwind variant shows JavaScript-only UI (ToC pill, Copy buttons) and hides no-JS fallbacks.
- Every page renders `<Seo>`: title (+ site name), description, canonical on the production origin without the query string, Open Graph and Twitter tags. Posts use `seo.metaTitle`, `seo.metaDescription`, `seo.canonicalUrl` and `seo.ogImage` when set, else title, summary and cover. Error pages are `noindex`.
- Every `load` that reads content goes through `strapi(locals)`. The client fetches the data and records a `type:<content type>` cache tag for the page (see [caching.md](caching.md)). Every route that shows content is declared in the content map (`src/lib/server/content-map.ts`, #140) with the content types it shows; a test runs the real loads and fails if they read anything else, and another fails if a route is missing.
- A missing slug throws `error(404)`. Error responses are never cached.
- `+server.ts` routes that read Strapi (RSS, sitemap) are edge-cached and purged like pages: the cache keeps their `content-type`. `static/robots.txt` points to the sitemap.
- Cacheable `load`s await everything — no streamed promises — so the cached body is complete.
- Svelte code follows AGENTS.md: run the Svelte MCP `svelte-autofixer` on every `.svelte` file written.
