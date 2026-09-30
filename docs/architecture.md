# Architecture

A personal tech blog documenting the move from senior engineer / tech lead to engineering manager, "and beyond". Content: blog posts, code snippets, side projects and ideas, book reviews, and a resume page. Design: extremely minimalist and content-focused; small animations are a later nice-to-have. The final design and its tokens are in [design.md](design.md).

## At a glance

```
 reader ──► Cloudflare edge ──► SvelteKit Worker (SSR) ──► Strapi REST API
               │   ▲                   │                   cms.bhargavshukla.com
               │   └── Cache API ◄─────┘                   (Hetzner VPS, via Cloudflare Tunnel)
               │        (Cache-Tag)                               │
               │                                                  │ webhook on publish
               └──────────── zone purge API ◄── /api/purge ◄──────┘
```

- **Frontend:** SvelteKit with `@sveltejs/adapter-cloudflare`, deployed as a **Cloudflare Worker with Static Assets** on the free plan. Pages are server-rendered per request (SEO matters); prerenderable pages (resume, about) ship as static assets.
- **CMS:** Strapi 5, self-hosted with Docker Compose on a small VPS, SQLite database. SvelteKit reads its REST API with a read-only token.
- **Decoupling:** content changes go live without redeploying the frontend. Rendered pages are cached at the edge with a short TTL and tagged with the content types they read; a Strapi webhook purges those tags on publish. See [caching.md](caching.md).
- **Media:** Cloudflare R2 through Strapi's S3 upload provider, served from `media.bhargavshukla.com`.
- **Content ownership:** content lives in our own SQLite file on our own server. Moving between Strapi instances uses `strapi export/import/transfer`; moving to a different CMS would need a script against Strapi's API (accepted trade-off).

## Decisions

| Decision                                                      | Why                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Workers + Static Assets, not Pages                            | Cloudflare steers new SSR projects to Workers; same free tier; `adapter-cloudflare` supports it. The cache/purge design is identical on either.                                                                                                                    |
| Purge by `Cache-Tag`, not `cache.delete()`                    | `cache.delete()` only clears the data center it runs in, and URL purge doesn't work on Cache API entries. Tag purge is global and on the Free plan.                                                                                                                |
| Tag pages by content **type** (`type:post`), not per document | Every page that shows posts is purged when any post changes — index, home, tag pages, RSS, sitemap, `__data.json`. Slug renames can't leave stale pages. Over-purging is free at this scale.                                                                       |
| Resume is a static SvelteKit page                             | One layout-heavy page, edited a few times a year; needs a tuned print stylesheet; must stay up even if the VPS is down; git versions it. The one deliberate exception to "no redeploy for content". Data is shaped so it can move into a Strapi single type later. |
| No separate "Idea" type                                       | A side-project idea is a Project with `status: idea`; any other idea is a short Post in the Ideas category.                                                                                                                                                        |
| SQLite, not Postgres                                          | Single author, low write volume, one container instead of two, less RAM, backup is one file. `strapi transfer` moves to Postgres if that ever changes.                                                                                                             |
| Markdown fields, not Strapi Blocks                            | Code-heavy writing; simple server-side rendering with Shiki highlighting.                                                                                                                                                                                          |
| Cloudflare Tunnel in front of Strapi                          | No inbound 80/443 on the VPS, no reverse proxy, no certificates to manage.                                                                                                                                                                                         |
| Build the Strapi image in CI                                  | The admin build needs ~2 GB+ RAM; the VPS only runs the image.                                                                                                                                                                                                     |
| Strapi lives in `cms/` in this repo (npm, own lockfile)       | One repo, one issue tracker, one ticket queue. npm is Strapi's documented path and keeps it out of the root pnpm project.                                                                                                                                          |

## Running cost (checked 2026-09-28)

| Item                                                                  | Cost              |
| --------------------------------------------------------------------- | ----------------- |
| Hetzner CX23 (EU) + IPv4 + automated backups                          | ~€7.1/mo (~$8.30) |
| Cloudflare Workers, Cache, purge API, Tunnel, Access, R2 (free tiers) | $0                |
| Domain (Porkbun)                                                      | ~$11/yr           |
| **Total**                                                             | **~$9/mo**        |

Details and the VPS comparison are in [infrastructure.md](infrastructure.md).
