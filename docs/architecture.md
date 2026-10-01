# Architecture

A personal tech blog documenting the move from senior engineer / tech lead to engineering manager, "and beyond". Content: blog posts (including ideas and book reviews, as categories), asides (short-form: code, quotes, tips, thoughts), and a resume page. Design: extremely minimalist and content-focused; small animations are a later nice-to-have. The final design and its tokens are in [design.md](design.md).

## At a glance

```
 reader ──► Cloudflare edge ──► SvelteKit Worker (SSR) ──► Strapi REST API
               │   ▲                   │                   cms.bhargavshukla.com
               │   └── Cache API ◄─────┘                   (Hetzner VPS, via Cloudflare Tunnel)
               │        (Cache-Tag)                               │
               │                                                  │ webhook on publish
               └──────────── zone purge API ◄── /api/purge ◄──────┘
```

- **Frontend:** SvelteKit with `@sveltejs/adapter-cloudflare`, deployed as a **Cloudflare Worker with Static Assets** on the free plan. Pages are server-rendered per request (SEO matters).
- **CMS:** Strapi 5, self-hosted with Docker Compose on a small VPS, SQLite database. SvelteKit reads its REST API with a read-only token.
- **Decoupling:** content changes go live without redeploying the frontend. Rendered pages are cached at the edge with a short TTL and tagged with the content types they read; a Strapi webhook purges those tags on publish. See [caching.md](caching.md).
- **Media:** Cloudflare R2 through Strapi's S3 upload provider, served from `media.bhargavshukla.com`.
- **Content ownership:** content lives in our own SQLite file on our own server. Moving between Strapi instances uses `strapi export/import/transfer`; moving to a different CMS would need a script against Strapi's API (accepted trade-off).

## Decisions

| Decision                                                      | Why                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workers + Static Assets, not Pages                            | Cloudflare steers new SSR projects to Workers; same free tier; `adapter-cloudflare` supports it. The cache/purge design is identical on either.                                                                                                                                                    |
| Purge by `Cache-Tag`, not `cache.delete()`                    | `cache.delete()` only clears the data center it runs in, and URL purge doesn't work on Cache API entries. Tag purge is global and on the Free plan.                                                                                                                                                |
| Tag pages by content **type** (`type:post`), not per document | Every page that shows posts is purged when any post changes — index, home, tag pages, RSS, sitemap. Slug renames can't leave stale pages. Over-purging is free at this scale.                                                                                                                      |
| Resume comes from a Strapi single type                        | Decided on 2026-09-30 (#5), reversing the static page: every piece of content is edited in one place with no redeploy. Draft & Publish lets it be rewritten privately. The trade-off is that `/resume` now needs the VPS, like every other page; nightly backups cover its history instead of git. |
| Few sections: no Project, Book review or cross-type tag pages | Keeps the nav at three items and M5 to one ticket. Ideas and book reviews are posts in their own categories; tags live on asides only; projects wait in the backlog. The about copy lives in the home intro.                                                                                       |
| SQLite, not Postgres                                          | Single author, low write volume, one container instead of two, less RAM, backup is one file. `strapi transfer` moves to Postgres if that ever changes.                                                                                                                                             |
| Markdown fields, not Strapi Blocks                            | Code-heavy writing; simple server-side rendering with Shiki highlighting.                                                                                                                                                                                                                          |
| Cloudflare Tunnel in front of Strapi                          | No inbound 80/443 on the VPS, no reverse proxy, no certificates to manage.                                                                                                                                                                                                                         |
| Build the Strapi image in CI                                  | The admin build needs ~2 GB+ RAM; the VPS only runs the image.                                                                                                                                                                                                                                     |
| Strapi lives in `cms/` in this repo (npm, own lockfile)       | One repo, one issue tracker, one ticket queue. npm is Strapi's documented path and keeps it out of the root pnpm project.                                                                                                                                                                          |

## Running cost (checked 2026-09-28)

| Item                                                                  | Cost              |
| --------------------------------------------------------------------- | ----------------- |
| Hetzner CX23 (EU) + IPv4 + automated backups                          | ~€7.1/mo (~$8.30) |
| Cloudflare Workers, Cache, purge API, Tunnel, Access, R2 (free tiers) | $0                |
| Domain (Porkbun)                                                      | ~$11/yr           |
| **Total**                                                             | **~$9/mo**        |

Details and the VPS comparison are in [infrastructure.md](infrastructure.md).
