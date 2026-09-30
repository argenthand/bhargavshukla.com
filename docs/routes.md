# Routes and source layout

```
src/
  hooks.server.ts                 edge-cache wrapper around resolve() — see caching.md
  app.d.ts                        App.Locals { cacheTags: Set<string> }, App.Platform
  lib/
    content/resume.ts             static resume data (typed)
    types/content.ts              Post, Category, Snippet, Tag, Seo, Link
    components/                   Seo.svelte, Nav.svelte (header nav + phone tab bar), PostList.svelte,
                                  TagList.svelte (snippets), Prose.svelte, Toc.svelte (pill, sheet, sidebar), NextUp.svelte
    server/
      strapi.ts                   typed REST client; records cache tags into locals
      markdown.ts                 marked + Shiki (fine-grained bundle, JS regex engine); h2/h3 ids + ToC list
      edge-cache.ts               cache key, bypass rules, TTL constants
      purge.ts                    webhook payload → tags; Cloudflare purge API call
  routes/
    +layout.svelte                nav (Writing · Snippets · Resume; bottom tab bar below md), footer
    +page.svelte, +page.server.ts /                 static intro (includes the about copy) + 3 newest featured posts
    +error.svelte                 404 / 5xx
    resume/+page.svelte           /resume           prerendered, print stylesheet, Save as PDF button
    blog/+page.server.ts          /blog             all posts by year; client-side search + category filter (?q=&cat=)
    blog/[slug]/+page.server.ts   /blog/:slug       ToC + up to 2 recommended posts ("Next up")
    snippets/…                    /snippets (tag filter ?tag=, client-side), /snippets/:slug
    rss.xml/+server.ts            posts feed
    sitemap.xml/+server.ts        all published slugs + static pages
    api/purge/+server.ts          Strapi webhook target (POST)
    api/preview/+server.ts        (later) Strapi Preview → draft-mode cookie
```

## Conventions

- Layout, tokens, component classes and behaviour follow [design.md](design.md). The nav stays at three items; see [design.md → Sections](design.md#sections).
- Every `load` that reads content goes through `strapi(locals)`. The client fetches the data and records a `type:<model>` cache tag for the page (see [caching.md](caching.md)).
- A missing slug throws `error(404)`. Error responses are never cached.
- Cacheable `load`s await everything — no streamed promises — so the cached body is complete.
- The prerendered route (`/resume`) is a static asset and never invoke the Worker.
- Svelte code follows AGENTS.md: run the Svelte MCP `svelte-autofixer` on every `.svelte` file written.
