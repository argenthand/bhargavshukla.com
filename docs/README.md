# Docs

Planning and reference docs for bhargavshukla.com.

| Doc                                          | What's in it                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| [architecture.md](architecture.md)           | The system at a glance, decisions made (and why), running cost                |
| [design.md](design.md)                       | Final design: tokens, component classes, ToC and Next up behaviour            |
| [content-model.md](content-model.md)         | Strapi content types, components, and CMS working rules                       |
| [routes.md](routes.md)                       | SvelteKit route and `src/` layout                                             |
| [edge-cache-misses.md](edge-cache-misses.md) | Why cold visits miss the edge cache, options, recommendation (#120)           |
| [caching.md](caching.md)                     | Edge cache + webhook purge design, step by step                               |
| [infrastructure.md](infrastructure.md)       | DNS, Cloudflare Workers, VPS, tunnel, media, backups                          |
| [performance.md](performance.md)             | Slow-network timings: how to measure (`pnpm perf`), results, real-world log   |
| [view-counts.md](view-counts.md)             | Read counts: options, decisions and what was built (#82, #87)                 |
| [contact.md](contact.md)                     | The contact card: checks, spam, delivery, the printed email, setup (#135)     |
| [analytics.md](analytics.md)                 | Analytics: options (#136); built as our own counts in Analytics Engine (#154) |
| [roadmap.md](roadmap.md)                     | Phases, milestones and tickets (GitHub issues)                                |
| [../CONTEXT.md](../CONTEXT.md)               | The glossary: the site's domain language                                      |
| [adr/](adr/)                                 | Architecture decisions and why they were made                                 |
| [agents/](agents/)                           | How the agent skills use the issue tracker, triage labels and domain docs     |

Work happens one ticket at a time: each issue gets a branch off an up-to-date `main` and a PR that is merged before the next issue starts.
