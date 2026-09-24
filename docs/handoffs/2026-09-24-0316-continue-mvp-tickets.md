# Handoff: bhargavshukla.com — continuing the MVP tickets

- **Date:** 2026-09-24 03:16 EDT
- **Previous handoff:** 2026-09-23-2330-implement-mvp-tickets.md
- **Next session focus:** pick the next unblocked ticket (#16 was the stated goal), one ticket at a time
- **Repo state:** branch `main` at commit `bd46ef0`, clean, all work merged

## Read these first (not repeated here)
- The previous handoff for the spec, glossary, ADR, design-mockup extraction recipe and working conventions. Everything in it still holds except where noted below.
- `AGENTS.md`, especially the new **Ticket workflow** section (below).
- Spec #1 and the ticket you take: `gh issue view <n>`.

## The rule that governs the session (no exceptions, even if the user asks)
Added to `AGENTS.md` and the user's global `CLAUDE.md`:
1. One ticket in flight at a time.
2. Before starting a new ticket, the previous ticket's PR must be merged by the user and the issue closed. Verify with `gh pr view <n> --json state` and `gh issue view <n> --json state`.
3. Every feature branch is created from an up-to-date `main` (`git checkout main && git pull --ff-only`), never from another feature branch.

The user asked once for parallel work and then accepted a refusal. Do not spawn agents to work on tickets in parallel.

## Ticket status
Done and merged: #2 (skeleton), #3 (Draft/Scheduled), #4 (Writing list), #5 (search/filter/sort), #6 (Post page), #10 (Snippets list), #12 (Resume and printing).

Unblocked and `ready-for-agent`: **#16** (Sveltia CMS at /admin and local content, the user's stated goal), #7 (table of contents), #8 (Recommended Posts), #9 (Homepage), #11 (Snippets search/filter/sort), #13 (dark mode), #14 (RSS, sitemap, 404), #15 (link-preview images).

Blocked: #18 (PostHog; needs #14 and #11), plus `ready-for-human` #17 (build pipeline; the user must first create the content repo and GitHub App) and #19 (manual accessibility pass). Don't take on #17 or #19. Check blockers with `gh api repos/argenthand/bhargavshukla.com/issues/<n> --jq .issue_dependencies_summary`.

Suggestions: #16 next as the user wanted. #11 reuses the Writing list logic and unblocks #18. #13 (dark mode) is small; see "Dark mode" below because the current CSS already follows the system setting.

## Per-ticket flow used this session
1. Confirm the previous PR is merged and issue closed; update `main`; branch `ticket-<n>-<slug>` from `main`.
2. `gh issue view <n>`, then for UI work extract the relevant mockup board (recipe in the previous handoff; strip `@font-face` blocks or the output is unreadable).
3. Tests first through the two approved seams, then implement.
4. `pnpm astro check`, `pnpm test`, `pnpm test:e2e`, then the `code-review` skill, apply real fixes, rerun.
5. Commit (Co-Authored-By line from the session's attribution reminder), push, `gh pr create --base main` with `Closes #<n>` and the Claude Code footer. Then stop and wait for the user to merge.

The user's "commit or push only when asked" convention was superseded in practice: the `/implement` flow commits, and the user asked for pushes and PRs each time. Ask before pushing anything that is not a ticket branch.

## Commands
- `pnpm test` (Vitest, `src/**/*.test.ts`), `pnpm test:e2e` (Playwright + axe against a build of the sample content, light and dark), `pnpm check` (`astro check`).
- The e2e server builds with `CONTENT_PATH=./test-content` and previews on **port 4322**. Port 4321 is the user's own dev server; never kill it. Astro 7's `astro preview` needs `--ignore-lock` to stay in the foreground.
- `astro check` needs TypeScript 6 (pinned); TypeScript 7 is unsupported by it.
- The shell has `noclobber` set: overwrite files with `>|`, not `>`.
- Tests read only `test-content/`. The Playwright config forces that path.

## What exists (map of the code)
- **Content module** `src/content/index.ts`: the single owner of validation (Zod, strict objects, schema rule: every field required with no default, or optional with a default, enforced by tests) and visibility. `loadContent(input, { now, includeDrafts })` returns `{ settings, categories, posts, snippets, resume }`. Entries validated even when hidden. Errors read `Post "<id>" is invalid: <field>: ...` and name the entry.
  - Draft/Scheduled: Publish Date compared with today in America/Toronto (`formatToParts`); Drafts hidden in production, shown locally (`import.meta.env.DEV`) with a badge; Scheduled never shown.
  - Posts: reading time (200 wpm), Updated Date shown only when later than Publish Date, Book Reviews (Category id `books`) require `bookTitle`/`bookAuthor` and reject them elsewhere, image alt text enforced at build (regex over the body, ignores code), slug `page` reserved, duplicate slugs rejected.
  - Snippets: `id` is the file name and the `#anchor`; language must be a Shiki language; more than 15 lines starts collapsed.
  - Resume: single file `resume/resume.yaml`; `printEasterEgg` field with a default.
- **Shared list logic** `src/content/list.ts` (no dependencies, imported by both build and browser): `paginate`, `listPosts`, `parseListQuery`, `serializeListQuery`, `updateListQuery`. #11 should reuse these rather than fork them.
- **Astro glue:** `src/content.config.ts` (glob loaders over `CONTENT_PATH`, default `./test-content`, no Astro-side schema on purpose), `src/content/site.ts` (`getSiteContent()`).
- **Pages:** `/` (minimal placeholder, #9 not done), `/writing` and `/writing/page/<n>`, `/writing/<slug>`, `/snippets`, `/resume`. Components in `src/components/`, browser scripts in `src/lib/*-client.ts`, shared `copy.ts` and `format-date.ts`.
- **Styles:** tokens in `src/styles/tokens.css` (from the mockups), everything else in `src/styles/global.css`. Print rules are in `global.css` and `tokens.css`.
- **Sample content:** `test-content/` (categories, posts incl. a Draft and a Scheduled one, snippets, settings with page size 2, and a fake Resume).
- **Tests:** `src/content/*.test.ts` (Vitest), `e2e/site.spec.ts` (Playwright + axe; the `pages` array at the top lists every page checked for WCAG 2.2 AA; add new routes there).

## Astro 7 facts learned (do not rely on older memory)
- Markdown runs on **Sätteri**, not remark/rehype. Config: `markdown.processor: satteri({ hastPlugins: [...] })` from `@astrojs/markdown-satteri`. Callouts use `satteri-callouts` (`> [!NOTE] Title`). Legacy `markdown.remarkPlugins` needs `@astrojs/markdown-remark` and is not used.
- Shiki dual themes (`github-light-high-contrast` / `github-dark-high-contrast`, `defaultColor: false`) are set in `astro.config.mjs` and duplicated in `src/pages/snippets.astro`. The default GitHub themes failed AA contrast.
- `astro:content` `getCollection`/`render`, `glob` loader from `astro/loaders`, `z` from `astro/zod` (Zod 4: `z.email()`, `z.url()`).
- `shiki` was added as a direct dependency to validate languages.
- Docs: https://docs.astro.build.

## Decisions made that the spec did not settle
- Writing list pages live at `/writing/page/<n>`; search/filter/sort state uses `/writing?q=&category=&sort=&page=` and is rendered by the browser with the same functions as the build. Controls are hidden without JavaScript.
- A collapsed Snippet's copy button lives in its code panel (as in the mockup), so it appears once expanded. The user was told and did not object.
- Post pages show one top navigation at every width; the mobile mockup's bottom tab bar was not built.
- `site: 'https://bhargavshukla.com'` is set in the Astro config (QR code, later RSS/sitemap). Confirm this is the real domain if #14 or #17 depends on it.
- The QR code links to `/resume` with no trailing slash; the host must serve or redirect it.
- Nav links (Writing, Snippets, Resume) all resolve now.
- A missing `resume/resume.yaml` fails the build.
- No CI: the user said to skip it and handle it at deploy time, so ticket #2's CI acceptance item was intentionally dropped. Tests run locally. Do not add a workflow unless asked; #17 covers the pipeline.

## Known gaps and things to watch
- **Dark mode (#13):** the tokens already switch with `prefers-color-scheme`. The manual toggle, stored override and pre-paint script are not built. The `js` class script in `BaseLayout.astro` `<head>` is a precedent for an inline head script. Any theme override will need the Shiki CSS (`--shiki-light`/`--shiki-dark` selection in `global.css`) to follow the override, not only the media query.
- **Homepage (#9)** is a placeholder with the mockup's headline and a Writing link. No Featured Posts yet; `featured` exists in the Post schema.
- **Post page:** no table of contents (#7) or Recommended Posts (#8); the schema has no `recommended` field yet (strict objects reject it until added).
- **Reading time** counts code and table text as words. **Image alt check** does not cover reference-style images.
- The Draft badge shows on the Post page and Snippets only; Writing list rows in dev do not mark Drafts.
- Local dev reads `CONTENT_PATH` if set, else `test-content/`. #16 is meant to wire the CMS to a local clone.
- The user's own `astro dev` may be running on port 4321.

## Working conventions the user expects (reconfirmed)
- Concise replies; lead with the result. Give a recommendation for design choices and proceed unless it is genuinely their decision.
- The user reviews and merges every PR themselves and tells you when to continue.
- Never force-push or rewrite history unless explicitly asked.
- Public repo: no secrets, no personal details invented for the sample content (the sample Resume is deliberately fake), no email addresses or local paths in docs.
- Keep to the glossary in `CONTEXT.md` in code, tests, commits and PRs.
