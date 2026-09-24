# Handoff: bhargavshukla.com — implementing the MVP tickets

- **Date:** 2026-09-23 23:30 EDT
- **Previous handoff:** none (first)
- **Next session focus:** implementing the MVP tickets from spec #1, starting with #2
- **Repo state:** https://github.com/argenthand/bhargavshukla.com (public), branch `main` at commit 2d54e4b

## Read these first (source of truth; not repeated here)
- Spec: https://github.com/argenthand/bhargavshukla.com/issues/1 (80 user stories, implementation + testing decisions, out-of-scope list)
- Tickets: issues #2–#19, each links to #1 with acceptance criteria. Blocking uses GitHub's native issue dependencies and is also listed in each body under "Blocked by".
- Glossary: `CONTEXT.md` (Post, Writing, Snippet, Book Review, Category, Summary, Publish Date, Updated Date, Draft, Scheduled, Featured, Recommended Post, Resume). Use these terms exactly in code, tests, commits and PRs.
- ADR: `docs/adr/0001-private-content-repo-fetched-at-build.md`
- Agent config: `AGENTS.md` (`CLAUDE.md` is a symlink to it). `docs/agents/*.md` explain the issue tracker (GitHub via `gh`), triage labels, and domain-doc rules.
- Design: `docs/design-mockups.html` (see "Reading the mockups" below; it can't be read as plain HTML).

## Where things stand
- Code is still the untouched Astro starter: `src/pages/index.astro`, an empty `astro.config.mjs`, strict tsconfig. No tests, no CI, no content yet.
- Toolchain: Node 24.21, pnpm 12.4, **Astro 7.3.4**. Astro 7 may be newer than your training data. Check https://docs.astro.build (guide links in AGENTS.md) before using content collections, loaders, routing or image APIs. Don't rely on memory.
- AGENTS.md rule: start the dev server with `astro dev --background`, and manage it with `astro dev stop|status|logs`.
- The private content repo and the GitHub App **do not exist yet**. All work before #17 must use sample test content committed in this repo. Never assume access to real content.

## Which tickets to work on
Ticket numbers here are GitHub issue numbers. The drafting order was off by one, so ignore any "ticket N" wording elsewhere.
- Only **#2** (walking skeleton) can start now. After it: #3, #6, #12, #13 in parallel. Once #3 and #6 are done: #4, #7, #8, #9, #10, #14, #15. Later: #5 (after #4), #11 (after #5 and #10), #16 (after #4, #6, #10, #12), #18 (after #5, #6, #11, #14).
- `ready-for-human`: **#17** (build pipeline; the user must first create the content repo and GitHub App) and **#19** (manual a11y pass). Don't take these on.
- Check what can start: `gh issue view <n>` plus `gh api repos/argenthand/bhargavshukla.com/issues/<n> --jq .issue_dependencies_summary` (blocked_by counts only open blockers).
- Don't edit or close the parent #1.

## Decisions settled in conversation that shape implementation (beyond the spec)
- The **content module** is the main seam: one module owns validation, visibility (Draft/Scheduled with a fixed "now"), ordering, Featured with its fallback, Recommended Posts, and the search/filter/sort/paginate logic plus URL (de)serialization. The **same list functions** must run at build time (no-JS paginated pages) and in the browser. The user approved exactly two test seams: (1) Vitest on the content module's public interface with sample content, (2) Playwright + axe against a build of the sample content (both themes). Don't add more seams without asking.
- Publish Date is date-only, read in America/Toronto. Tests need a fixed clock and a Toronto-midnight boundary case.
- Where the spec and the mockups disagree, the spec wins. The mockups show tags on Posts and Featured Snippets and Book Reviews sections on the homepage; all three were dropped on purpose. Snippets use layout **A** (B and C were rejected).
- Mockup text such as "[City, ON]", "[Email]" and "[Summary from CMS]" is placeholder text. Don't invent personal details; take them from sample content.
- The Resume has no PDF file: print button → `window.print()`, and the QR code and hidden easter-egg line appear only in print.

## Reading the mockups
`docs/design-mockups.html` is a nested JS bundle (about 12 MB). Top level: `<script type="__bundler/manifest">` (JSON of uuid → {mime, compressed, data=base64 gzip}) and `<script type="__bundler/template">` (JSON string of HTML with `<iframe src="about:blank#<uuid>">` per board). Each board page is itself a bundle of the same shape, and its **template** holds the page's real markup and CSS (fonts and a shared runtime are in its manifest). Extract with Python: json-load the manifest, base64-decode + gzip-decompress each entry, then json-load the inner page's `__bundler/template`. Boards: Home, Writing list, Blog post, Resume, Snippets A/B/C (mobile + desktop), and Dark variants of Home, Writing and Blog post. Pull colors, type and spacing tokens from the inner templates' `<style>`. To compare visually, open the file in a browser.

## Working conventions the user expects
- Replies should be concise. For design choices, the user wants a recommendation and usually accepts it. Ask only when it's genuinely their decision.
- Commit or push only when the user asks. Work on a branch per ticket and open a PR that closes the issue (`Closes #N`). End commits with the Co-Authored-By line from the session's attribution reminder, and end PR bodies with the Claude Code footer.
- Never force-push or rewrite history without the user explicitly asking. In this session, auto mode blocked a force-push and the user ran it themselves.
- `gh` is authenticated and git uses gh's credential helper.
- Accessibility (WCAG 2.2 AA) is a core requirement, not polish: skip link, focus styles, reduced motion, live-region announcements, alt text enforced at build time.
- Deferred ideas the user mentioned (TIL section, Projects, view- and like-driven Featured, Tags) are out of scope; don't start them.

## Suggested skills
- `mattpocock-skills:tdd`: build each ticket test-first through the two approved seams.
- `mattpocock-skills:codebase-design`: when shaping the content module's interface in #2 (keep it deep: small interface, rules hidden inside).
- `mattpocock-skills:domain-modeling`: if a new domain term comes up; update `CONTEXT.md` inline and offer an ADR only for hard-to-reverse choices.
- `mattpocock-skills:diagnosing-bugs`: for failing builds or flaky Playwright tests.
- `mattpocock-skills:code-review`: review each ticket branch against the spec and the ticket before opening the PR.
- `run`: launch the dev server or build and check a ticket in the real app.
- `anthropic-skills:built-in-browser` or `anthropic-skills:chrome-browser`: compare rendered pages with the mockups.
