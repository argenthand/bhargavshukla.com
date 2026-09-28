# Routes and source layout

```
src/
  hooks.server.ts                 edge-cache wrapper around resolve() — see caching.md
  app.d.ts                        App.Locals { cacheTags: Set<string> }, App.Platform
  lib/
    content/resume.ts             static resume data (typed)
    types/content.ts              Post, Snippet, Project, BookReview, Tag, Seo, Link
    components/                   Seo.svelte, PostList.svelte, TagList.svelte, Prose.svelte
    server/
      strapi.ts                   typed REST client; records cache tags into locals
      markdown.ts                 marked + Shiki (fine-grained bundle, JS regex engine)
      edge-cache.ts               cache key, bypass rules, TTL constants
      purge.ts                    webhook payload → tags; Cloudflare purge API call
  routes/
    +layout.svelte                nav (Writing · Projects · Snippets · Books · Resume), footer
    +page.svelte, +page.server.ts /                 static intro + latest posts + featured projects
    +error.svelte                 404 / 5xx
    about/+page.svelte            /about            prerendered
    resume/+page.svelte           /resume           prerendered, print stylesheet
    blog/+page.server.ts          /blog             post index (?page=N)
    blog/[slug]/+page.server.ts   /blog/:slug
    snippets/…                    /snippets, /snippets/:slug
    projects/…                    /projects (grouped by status; "Ideas" = status idea), /projects/:slug
    books/…                       /books, /books/:slug
    tags/[slug]/+page.server.ts   /tags/:slug       everything with that tag, across types
    rss.xml/+server.ts            posts feed
    sitemap.xml/+server.ts        all published slugs + static pages
    api/purge/+server.ts          Strapi webhook target (POST)
    api/preview/+server.ts        (later) Strapi Preview → draft-mode cookie
```

## Conventions

- Every `load` that reads content goes through `strapi(locals)`. The client fetches the data and records a `type:<model>` cache tag for the page (see [caching.md](caching.md)).
- A missing slug throws `error(404)`. Error responses are never cached.
- Cacheable `load`s await everything — no streamed promises — so the cached body is complete.
- Prerendered routes (`/resume`, `/about`) are static assets and never invoke the Worker.
- Svelte code follows AGENTS.md: run the Svelte MCP `svelte-autofixer` on every `.svelte` file written.
