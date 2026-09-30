# bhargavshukla.com

Source for [bhargavshukla.com](https://bhargavshukla.com) — a personal tech blog about moving from senior engineer / tech lead into engineering management, and beyond. Posts (including book reviews), code snippets and a resume.

- **Frontend:** SvelteKit (SSR) on Cloudflare Workers
- **CMS:** Strapi 5, self-hosted (in `cms/`, once scaffolded)
- **Content updates** go live without a redeploy: edge cache + webhook purge

Design, decisions and the roadmap are in [docs/](docs/README.md).

## Develop

```sh
pnpm install
pnpm dev
```

| Command                       | Does                               |
| ----------------------------- | ---------------------------------- |
| `pnpm dev`                    | Dev server                         |
| `pnpm build` / `pnpm preview` | Production build and preview       |
| `pnpm check`                  | Type-check (svelte-check)          |
| `pnpm lint` / `pnpm format`   | Prettier + ESLint                  |
| `pnpm test`                   | Vitest (server + browser projects) |
