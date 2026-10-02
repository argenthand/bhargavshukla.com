# Roadmap

Built on the side of a new EM role: each ticket fits **one sitting of 1–3 hours** and ends in a mergeable PR. One ticket is in flight at a time, on a branch off an up-to-date `main`. At about two tickets a week, M5 is roughly 12 weeks out. **Soft launch at M4.**

Issues: https://github.com/argenthand/bhargavshukla.com/issues

## Milestones

| Milestone                        | Done when                                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **M0 · Foundations**             | An SSR "hello" page is live at https://bhargavshukla.com; email still works after the DNS move                 |
| **M1 · Static shell**            | Home (with the about copy) and resume are live with the final layout (no CMS yet)                              |
| **M2 · CMS locally**             | Posts written in a local Strapi render in local SvelteKit, with highlighted code                               |
| **M3 · CMS in production**       | The first real post is published from production Strapi and shows on the live site (uncached)                  |
| **M4 · Edge cache + purge**      | Pages come from the edge; publishing in Strapi updates the live site within seconds — **soft launch**          |
| **M5 · All sections**            | Asides (short-form), with tag links and filters, are live                                                      |
| **M6 · Polish and distribution** | RSS, sitemap, analytics, draft preview and share images are live, with the small touches (motion, easter eggs) |

## Tickets

"Blocked by" lists hard dependencies only. UI tickets wait for the mockups in #1 (or #23 for the pages it covers); infra tickets don't. The final design is in [design.md](design.md).

### Design

| #                                                                | Ticket                                           | Blocked by |
| ---------------------------------------------------------------- | ------------------------------------------------ | ---------- |
| [#1](https://github.com/argenthand/bhargavshukla.com/issues/1)   | UI mockups                                       | —          |
| [#23](https://github.com/argenthand/bhargavshukla.com/issues/23) | UI mockups: home intro, error page, snippet tags | #1         |

### Phase 0 → M0

| #                                                              | Ticket                                 | Blocked by |
| -------------------------------------------------------------- | -------------------------------------- | ---------- |
| [#2](https://github.com/argenthand/bhargavshukla.com/issues/2) | Move DNS from Porkbun to Cloudflare    | —          |
| [#3](https://github.com/argenthand/bhargavshukla.com/issues/3) | Deploy SvelteKit on Cloudflare Workers | #2         |

### Phase 1 → M1

| #                                                              | Ticket                    | Blocked by |
| -------------------------------------------------------------- | ------------------------- | ---------- |
| [#4](https://github.com/argenthand/bhargavshukla.com/issues/4) | Layout and typography     | #1, #3     |
| [#5](https://github.com/argenthand/bhargavshukla.com/issues/5) | Resume page               | #1, #4     |
| [#6](https://github.com/argenthand/bhargavshukla.com/issues/6) | SEO basics and error page | #4, #23    |

### Phase 2 → M2

| #                                                              | Ticket                               | Blocked by |
| -------------------------------------------------------------- | ------------------------------------ | ---------- |
| [#7](https://github.com/argenthand/bhargavshukla.com/issues/7) | Scaffold Strapi in `cms/`            | —          |
| [#8](https://github.com/argenthand/bhargavshukla.com/issues/8) | Post, Category and shared components | #7         |
| [#9](https://github.com/argenthand/bhargavshukla.com/issues/9) | Strapi client and blog routes        | #1, #4, #8 |

### Phase 3 → M3

| #                                                                | Ticket                                     | Blocked by   |
| ---------------------------------------------------------------- | ------------------------------------------ | ------------ |
| [#10](https://github.com/argenthand/bhargavshukla.com/issues/10) | Provision the VPS                          | —            |
| [#11](https://github.com/argenthand/bhargavshukla.com/issues/11) | CMS image CI and compose file              | #7           |
| [#12](https://github.com/argenthand/bhargavshukla.com/issues/12) | Cloudflare Tunnel, Access and first boot   | #2, #10, #11 |
| [#13](https://github.com/argenthand/bhargavshukla.com/issues/13) | R2 media storage                           | #12          |
| [#14](https://github.com/argenthand/bhargavshukla.com/issues/14) | Backups and restore drill                  | #12, #13     |
| [#15](https://github.com/argenthand/bhargavshukla.com/issues/15) | Wire production frontend to production CMS | #9, #12      |

### Phase 4 → M4

| #                                                                | Ticket                            | Blocked by |
| ---------------------------------------------------------------- | --------------------------------- | ---------- |
| [#16](https://github.com/argenthand/bhargavshukla.com/issues/16) | Edge cache hook                   | #15        |
| [#17](https://github.com/argenthand/bhargavshukla.com/issues/17) | Purge endpoint and Strapi webhook | #16        |

### Phase 5 → M5

A vertical slice: schema in `cms/`, deploy the image, then routes. Projects, book reviews and tag pages were cut in #23 (see [design.md → Sections](design.md#sections)).

| #                                                                | Ticket                | Blocked by |
| ---------------------------------------------------------------- | --------------------- | ---------- |
| [#18](https://github.com/argenthand/bhargavshukla.com/issues/18) | Asides (was Snippets) | #1, #23    |

### Phase 6 → M6

[#22](https://github.com/argenthand/bhargavshukla.com/issues/22) was split into these on 2026-10-01. The Projects section was cut: side projects stay posts.

| #                                                                | Ticket                                                  | Blocked by |
| ---------------------------------------------------------------- | ------------------------------------------------------- | ---------- |
| [#56](https://github.com/argenthand/bhargavshukla.com/issues/56) | RSS feed and sitemap                                    | —          |
| [#57](https://github.com/argenthand/bhargavshukla.com/issues/57) | Draft preview                                           | —          |
| [#58](https://github.com/argenthand/bhargavshukla.com/issues/58) | Cloudflare Web Analytics                                | —          |
| [#59](https://github.com/argenthand/bhargavshukla.com/issues/59) | Home intro: headshot and name placement                 | —          |
| [#60](https://github.com/argenthand/bhargavshukla.com/issues/60) | Micro-interactions 1: navigation and links              | —          |
| [#61](https://github.com/argenthand/bhargavshukla.com/issues/61) | Micro-interactions 2: reading and tools                 | #60        |
| [#62](https://github.com/argenthand/bhargavshukla.com/issues/62) | Generated OG images                                     | —          |
| [#63](https://github.com/argenthand/bhargavshukla.com/issues/63) | Easter eggs                                             | #59        |
| [#64](https://github.com/argenthand/bhargavshukla.com/issues/64) | Uptime checks for the site and CMS (low priority)       | —          |
| [#66](https://github.com/argenthand/bhargavshukla.com/issues/66) | Tailwind cleanup: theme tokens and shared utilities     | —          |
| [#77](https://github.com/argenthand/bhargavshukla.com/issues/77) | Quiet redesign: fewer borders; Back to top              | —          |
| [#79](https://github.com/argenthand/bhargavshukla.com/issues/79) | Brand icons (Feather)                                   | —          |
| [#80](https://github.com/argenthand/bhargavshukla.com/issues/80) | Theme toggle: Light / Dark / System                     | —          |
| [#81](https://github.com/argenthand/bhargavshukla.com/issues/81) | Colour themes: palettes and a picker                    | #80        |
| [#82](https://github.com/argenthand/bhargavshukla.com/issues/82) | Explore: view counts ([view-counts.md](view-counts.md)) | —          |

## Checks for every ticket

`pnpm check`, `pnpm lint` and `pnpm test` pass, and the Workers Builds preview deploy works.
