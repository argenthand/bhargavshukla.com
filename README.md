# bhargavshukla.com

Source for [bhargavshukla.com](https://bhargavshukla.com) — a personal tech blog about moving from senior engineer / tech lead into engineering management, and beyond. Posts (including book reviews), code snippets and a resume.

- **Frontend:** SvelteKit (SSR) on Cloudflare Workers
- **CMS:** Strapi 5, self-hosted, SQLite (in `cms/`)
- **Content updates** go live without a redeploy: edge cache + webhook purge

Design, decisions and the roadmap are in [docs/](docs/README.md).

## Develop

```sh
pnpm install
cp .env.example .env   # STRAPI_URL and the local read-only STRAPI_TOKEN (see ## CMS)
pnpm dev
```

| Command                       | Does                               |
| ----------------------------- | ---------------------------------- |
| `pnpm dev`                    | Dev server                         |
| `pnpm build` / `pnpm preview` | Production build and preview       |
| `pnpm check`                  | Type-check (svelte-check)          |
| `pnpm lint` / `pnpm format`   | Prettier + ESLint                  |
| `pnpm test`                   | Vitest (server + browser projects) |

## CMS

`cms/` is its own npm project (not part of the pnpm workspace; root lint and format skip it).

```sh
cd cms
cp .env.example .env   # then fill in secrets: openssl rand -base64 16
npm install
npm run develop        # admin at http://localhost:1337/admin
```

The local database is `cms/.tmp/data.db` (gitignored). `cms/Dockerfile` builds the production image.
