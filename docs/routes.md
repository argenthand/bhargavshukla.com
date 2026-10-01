# Routes and source layout

```
src/
  hooks.server.ts                 edge-cache wrapper around resolve() — see caching.md
  app.d.ts                        App.Locals { cacheTags: Set<string> }, App.Platform
  lib/
    format.ts                     dates as shown (UTC), shown date = displayDate ?? publishedAt
    site.ts                       name, links, Primary nav (`live` flags hide sections until they ship)
    types/content.ts              Post, PostSummary, Category, Media, Seo, Link, Heading, Tag, Aside, RenderedAside
    components/                   Icon.svelte, PostMeta.svelte (category · date), Prose.svelte (+ code Copy),
                                  Toc.svelte (pill + sheet, or sidebar), NextUp.svelte, Seo.svelte; AsideItem.svelte
    server/
      strapi.ts                   typed REST client; records cache tags into locals
      posts.ts                    post queries (lists, one post, home picks, Next up)
      profile.ts, resume.ts       single types (#42, #5), Markdown fields rendered on the server
      asides.ts                   aside queries, untitled-aside labels (#18)
      markdown.ts                 marked + Shiki (fine-grained bundle, JS regex engine); h2/h3 ids + ToC list
      edge-cache.ts               cache key, bypass rules, TTL constants
      purge.ts                    webhook payload → tags; Cloudflare purge API call
  routes/
    +layout.svelte                header nav (md+) and bottom tab bar (below md), footer
    +page.svelte, +page.server.ts /                 intro + up to 3 featured posts (the newest posts while none are featured)
    +error.svelte                 404 / 5xx
    resume/+page.server.ts        /resume           Strapi Resume + Profile (404 until published); print styles, Save as PDF
    blog/+page.server.ts          /blog             all posts by year; client-side search + category filter (?q=&cat=)
    blog/[slug]/+page.server.ts   /blog/:slug       ToC + up to 2 recommended posts ("Next up")
    asides/+page.server.ts        /asides           every aside in full; ?kind= ?tag= ?page= from the URL, client-side
    asides/[slug]/+page.server.ts /asides/:slug     one aside, Newer / Older
    rss.xml/+server.ts            posts feed
    sitemap.xml/+server.ts        all published slugs + static pages
    api/purge/+server.ts          Strapi webhook target (POST)
    api/preview/+server.ts        (later) Strapi Preview → draft-mode cookie
```

## Conventions

- Layout, tokens, component classes and behaviour follow [design.md](design.md). The nav stays at three items; see [design.md → Sections](design.md#sections).
- `app.html` adds a `js` class to `<html>`; the `js:` Tailwind variant shows JavaScript-only UI (ToC pill, Copy buttons) and hides no-JS fallbacks.
- Every page renders `<Seo>`: title (+ site name), description, canonical on the production origin without the query string, Open Graph and Twitter tags. Posts use `seo.metaTitle`, `seo.metaDescription`, `seo.canonicalUrl` and `seo.ogImage` when set, else title, summary and cover. Error pages are `noindex`.
- Every `load` that reads content goes through `strapi(locals)`. The client fetches the data and records a `type:<model>` cache tag for the page (see [caching.md](caching.md)).
- A missing slug throws `error(404)`. Error responses are never cached.
- Cacheable `load`s await everything — no streamed promises — so the cached body is complete.
- Svelte code follows AGENTS.md: run the Svelte MCP `svelte-autofixer` on every `.svelte` file written.
