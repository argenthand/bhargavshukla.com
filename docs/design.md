# Design

The final design is **Broadsheet**, an editorial reading room: one serif carries everything, hairline rules do the structure, a single newsprint red points the way.

Source of truth: the "Final · Broadsheet" page of the [design canvas](https://claude.ai/artifact/EoXwo1PDymUt3i87cVjiiG) (concepts A–C were explored first; F is the final set). This doc is its handoff spec, adapted to our stack — see [Adaptations](#adaptations). When this doc and an artboard disagree, the artboard wins for looks and this doc wins for behaviour and data.

## Decisions

| Area                | Decision                                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visual direction    | Broadsheet: one serif for all text, hairline rules, red accent.                                                                                                              |
| Table of contents   | Below `lg`: sticky "On this page" pill that opens a bottom sheet. `lg+`: sticky right sidebar with scroll-spy. No progress bar or percentage: the highlighted heading is it. |
| Recommended reading | "Next up" card for the first pick plus a compact "Also:" line for the second. 0 items → nothing rendered.                                                                    |
| Dark mode           | Follows the system (`prefers-color-scheme`) through Tailwind's default `dark:` variant. No toggle in v1.                                                                     |
| Scope               | Home, Writing, Post, Snippets (with tag links), Resume, error page, global nav. No projects, book or tag-page sections in v1: see [Sections](#sections).                     |

## Sections

Decided in #23: the site stays small so the nav stays at three items (Writing · Snippets · Resume) and the phone tab bar stays at three tabs.

| Section      | Decision                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| About        | No `/about` page. The home intro carries the bio (2–3 short paragraphs) and the Resume · Email · LinkedIn · GitHub links. |
| Book reviews | Ordinary posts in the **Books** category. They get the Writing filter, Next up and the post layout for free.              |
| Tags         | On snippets only. Each tag links to `/snippets?tag=<slug>`. Posts have no tags; their category does the grouping.         |
| Projects     | Not in v1. Parked in the backlog ([#22](https://github.com/argenthand/bhargavshukla.com/issues/22)).                      |

## Artboards

| Artboard            | Shows                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `F-components`      | All states of the ToC pill, sheet and sidebar; Next up with 0/1/2 items; category label, meta, draft badge, focus ring; nav.                          |
| `F-home-*`          | Home at phone (light, dark), tablet, desktop (light, dark).                                                                                           |
| `F-writing-*`       | Writing list: phone in preview mode, phone no-results (dark), tablet, desktop, desktop no-results (dark).                                             |
| `F-post-*`          | Post: phone with cover + pill, phone with sheet open, phone dark no cover, tablet (pill), desktop with sidebar, dark 1-rec variant.                   |
| `F-snippet*`        | Snippets list and detail at every size; dark detail shows the "Copied" state.                                                                         |
| `F-resume-*`        | Resume on screen at every size, and Letter print pages 1 and 2.                                                                                       |
| `F-home-v2-*`       | Home with the about copy in the intro and an Email link; a Books post in Featured. Replaces `F-home-*` for the intro.                                 |
| `F-error-*`         | Error page: 404 on phone (light, dark) and desktop (light), 500 on desktop (dark).                                                                    |
| `F-snippets-tags-*` | Snippets list with tag links; filtered by `?tag=` (phone dark, desktop light); unknown tag (desktop dark). Supersedes the tag line in `F-snippets-*`. |

## CSS entry

Tailwind CSS v4 with the typography plugin. Default theme only; the overrides below are the whole custom theme.

```css
@import 'tailwindcss';
@plugin '@tailwindcss/typography';

@theme {
	--font-sans: 'Newsreader', ui-serif, Georgia, serif;
	--font-mono: 'JetBrains Mono', ui-monospace, monospace;
}

@page {
	size: letter;
	margin: 0.6in 0.75in;
}

/* Shiki dual themes: render with
   codeToHtml(code, { lang, themes: { light: 'github-light', dark: 'github-dark' } })
   then switch on prefers-color-scheme: */
@media (prefers-color-scheme: dark) {
	.shiki,
	.shiki span {
		color: var(--shiki-dark) !important;
		background-color: var(--shiki-dark-bg) !important;
	}
}

html {
	scroll-padding-top: 4.5rem; /* sticky top bar + pill */
}
@media (width >= 64rem) {
	html {
		scroll-padding-top: 6rem;
	}
}
@media (prefers-reduced-motion: no-preference) {
	html {
		scroll-behavior: smooth;
	}
}
```

## Fonts

- **Newsreader** (Google Fonts; 400, 500, 600, italic 400; optical sizing on) for every piece of text.
- **JetBrains Mono** (400, 500) for code only.
- Load with `display=swap`; preconnect to `fonts.gstatic.com`.

## Breakpoints

| Range        | Layout                                                                                         |
| ------------ | ---------------------------------------------------------------------------------------------- |
| < 768 (base) | Slim top bar with name + fixed bottom tab bar (Writing, Snippets, Resume). ToC = pill + sheet. |
| `md` ≥ 768   | Header with name + nav; tab bar hidden. ToC still pill + sheet.                                |
| `lg` ≥ 1024  | Post becomes 2 columns: 680px article + 220px sticky ToC sidebar with scroll-spy.              |

## Colour roles

| Role                                                  | Light         | vs bg  | Dark          | vs bg  |
| ----------------------------------------------------- | ------------- | ------ | ------------- | ------ |
| Page background                                       | `white`       |        | `neutral-950` |        |
| Surface: Next up card, code, preview banner           | `neutral-50`  |        | `neutral-900` |        |
| Headings, primary text                                | `neutral-900` | 17.9:1 | `neutral-100` | 18.2:1 |
| Body copy (prose)                                     | `neutral-700` | 10.4:1 | `neutral-300` | 13.4:1 |
| Dates, captions, inactive nav                         | `neutral-600` | 7.8:1  | `neutral-400` | 7.8:1  |
| Rules and borders                                     | `neutral-200` |        | `neutral-800` |        |
| Strong rules: section tops, table heads               | `neutral-900` |        | `neutral-100` |        |
| Links, active tab, category labels, focus, ToC active | `red-700`     | 6.5:1  | `red-400`     | 7.2:1  |
| Link hover                                            | `red-800`     | 8.3:1  | `red-300`     | 10.4:1 |
| Inline code background                                | `neutral-100` |        | `neutral-800` |        |

## Type scale

| Token       | Size | Use                                                              |
| ----------- | ---- | ---------------------------------------------------------------- |
| `text-xs`   | 12px | Category labels, tab labels, badges (uppercase, tracking-widest) |
| `text-sm`   | 14px | Dates, captions, footer                                          |
| `text-base` | 16px | UI text, ToC items                                               |
| `text-lg`   | 18px | Body copy (`prose-lg`), nav, blurb                               |
| `text-xl`   | 20px | Mobile title bar, list titles (phone)                            |
| `text-2xl`  | 24px | List titles, h2 (phone), pull quote                              |
| `text-3xl`  | 30px | Post title (phone), h2 (desktop)                                 |
| `text-4xl`  | 36px | Page titles, post title (desktop)                                |

## Components

`›` separates an element from its children.

| Component          | Tailwind classes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Body               | `bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100`                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Mobile top bar     | `sticky top-0 z-10 flex h-14 items-center border-b border-neutral-200 bg-white px-5 md:hidden dark:border-neutral-800 dark:bg-neutral-950`                                                                                                                                                                                                                                                                                                                                                                |
| Header (md+)       | `hidden md:block border-b border-neutral-200 dark:border-neutral-800` › `mx-auto flex h-20 max-w-5xl items-center justify-between px-8`                                                                                                                                                                                                                                                                                                                                                                   |
| Nav link           | `inline-flex min-h-11 items-center px-3 text-lg text-neutral-600 hover:text-neutral-900 aria-[current=page]:text-neutral-900 aria-[current=page]:underline aria-[current=page]:decoration-red-700 aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8 dark:text-neutral-400 dark:aria-[current=page]:text-neutral-100 dark:aria-[current=page]:decoration-red-400`                                                                                                                    |
| Bottom tab bar     | `fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden dark:border-neutral-800 dark:bg-neutral-950`                                                                                                                                                                                                                                                                                                                              |
| Tab                | `-mt-px flex min-h-14 flex-col items-center justify-center gap-1 border-t-2 border-transparent text-xs text-neutral-600 aria-[current=page]:border-red-700 aria-[current=page]:font-semibold aria-[current=page]:text-red-700 dark:text-neutral-400 dark:aria-[current=page]:border-red-400 dark:aria-[current=page]:text-red-400`                                                                                                                                                                        |
| Category label     | `text-xs font-semibold uppercase tracking-widest text-red-700 dark:text-red-400`                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Post row           | `block border-b border-neutral-200 py-5 dark:border-neutral-800` › title: `text-xl md:text-2xl font-semibold text-balance`                                                                                                                                                                                                                                                                                                                                                                                |
| Draft badge        | `rounded-xs border border-dashed border-neutral-600 px-1.5 text-xs uppercase tracking-wide text-neutral-600 dark:border-neutral-400 dark:text-neutral-400`                                                                                                                                                                                                                                                                                                                                                |
| Search             | `h-11 w-full border-0 border-b border-neutral-900 bg-transparent text-lg placeholder:text-neutral-500 focus:border-b-2 focus:border-red-700 focus:outline-none`                                                                                                                                                                                                                                                                                                                                           |
| Category filter    | phone: native `<select>` `h-11 w-full appearance-none border-b border-neutral-900 text-lg` · md+: button `min-h-11 px-2.5 text-lg aria-pressed:underline aria-pressed:decoration-red-700 aria-pressed:decoration-2 aria-pressed:underline-offset-8`                                                                                                                                                                                                                                                       |
| Article            | `prose prose-lg prose-neutral max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-red-700 prose-a:underline-offset-4 dark:prose-a:text-red-400 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none prose-blockquote:border-y prose-blockquote:border-l-0 prose-blockquote:py-6 prose-blockquote:text-2xl prose-blockquote:font-normal prose-figcaption:text-sm`                                                          |
| Code block (Shiki) | `not-prose -mx-5 border-y border-neutral-200 bg-neutral-50 font-mono text-sm md:mx-0 dark:border-neutral-800 dark:bg-neutral-900`                                                                                                                                                                                                                                                                                                                                                                         |
| Focus ring         | `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 dark:focus-visible:outline-red-400`                                                                                                                                                                                                                                                                                                                                                                                 |
| ToC pill (< lg)    | `sticky top-16 z-10 lg:hidden` › button: `flex min-h-11 w-full items-center gap-2.5 border border-neutral-200 bg-white px-4 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-950` › label: `text-neutral-600` · current: `truncate font-semibold`                                                                                                                                                                                                                                                |
| ToC sheet          | `<dialog>` `fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none border-t border-neutral-200 bg-white px-5 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl backdrop:bg-black/45 dark:border-neutral-800 dark:bg-neutral-950` · handle: `mx-auto h-1 w-9 rounded-full bg-neutral-900/30`                                                                                                                                                                                                  |
| ToC sidebar (lg+)  | `hidden lg:block sticky top-24 self-start` › heading: `text-xs font-semibold uppercase tracking-widest`                                                                                                                                                                                                                                                                                                                                                                                                   |
| ToC item           | `flex min-h-10 items-center border-l-2 border-neutral-200 pl-3 text-[15px] text-neutral-900 data-[level=3]:pl-7 data-[level=3]:text-neutral-600 aria-[current=location]:border-red-700 aria-[current=location]:font-semibold aria-[current=location]:text-red-700 dark:border-neutral-800 dark:text-neutral-100 dark:aria-[current=location]:border-red-400 dark:aria-[current=location]:text-red-400`                                                                                                    |
| Post grid (lg+)    | `lg:grid lg:grid-cols-[minmax(0,42.5rem)_13.75rem] lg:justify-center lg:gap-16`                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Next up card       | `flex flex-col gap-2 border border-neutral-200 bg-neutral-50 p-5 hover:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-100` › eyebrow: `flex justify-between text-sm font-semibold text-red-700 dark:text-red-400` › title: `text-xl md:text-2xl font-semibold text-balance` › summary: `line-clamp-2 text-neutral-600`                                                                                                                                          |
| Tag link           | `inline-flex min-h-11 items-center text-[15px] italic text-neutral-600 underline decoration-neutral-200 underline-offset-[5px] hover:text-neutral-900 aria-[current=true]:text-neutral-900 aria-[current=true]:decoration-red-700 aria-[current=true]:decoration-2 dark:text-neutral-400 dark:decoration-neutral-800 dark:hover:text-neutral-100 dark:aria-[current=true]:text-neutral-100 dark:aria-[current=true]:decoration-red-400` · list: `flex flex-wrap gap-x-3.5` with a visually hidden "Tags:" |
| Tag filter bar     | `flex min-h-13 items-center justify-between gap-3 border border-neutral-200 bg-neutral-50 pl-4 pr-2 dark:border-neutral-800 dark:bg-neutral-900` (`role="status"`) › text: `text-[17px] text-neutral-700 dark:text-neutral-300` with the tag in `<em class="font-semibold not-italic">` › Clear: `inline-flex min-h-11 items-center gap-1.5 px-2 text-red-700 dark:text-red-400`                                                                                                                          |
| Error page         | `max-w-[35rem] py-14 md:py-24` › status: category label (`404 · Not found`) › h1: `text-4xl md:text-5xl font-medium tracking-tight text-balance` › copy: `text-lg text-neutral-700` › links: intro link style, in a row with `border-t border-neutral-200 pt-2`                                                                                                                                                                                                                                           |
| "Also:" line       | `flex flex-wrap items-baseline gap-3 px-1 pt-3` › link: `inline-flex min-h-11 items-center font-medium underline decoration-neutral-200 underline-offset-4 hover:decoration-red-700`                                                                                                                                                                                                                                                                                                                      |

## Table of contents: behaviour

- Build the list from the rendered post's h2 and h3 (ids from our `marked` pipeline — see [Adaptations](#adaptations)). Render the ToC only when there are **2 or more h2s**.
- One list component, rendered twice: inside the sheet (< `lg`) and the sidebar (`lg+`); only one is visible via `lg:hidden` / `hidden lg:block`.
- Scroll-spy: `IntersectionObserver` on every heading with `rootMargin: "-72px 0px -65% 0px"`; the active item is the last heading that has crossed that line. Before the first heading, the first item is active.
- The active item gets `aria-current="location"`. It is the only progress cue: no progress bar, no percentage.
- Pill: sits directly after the post header (and cover), then sticks under the top bar (`top-16`, 8px gap). Its text is the active heading, truncated with an ellipsis. It is a `<button aria-haspopup="dialog">`.
- Sheet: native `<dialog>` opened with `showModal()` (focus trap and Esc for free). Closes on Esc, backdrop tap, the ✕ button, or choosing an item. Choosing an item closes first, then scrolls to the heading and moves focus to it (`tabindex="-1"`).
- Headings land below the sticky bars through `scroll-padding-top` on `html`. Smooth scroll only under `prefers-reduced-motion: no-preference`.
- Without JS (progressive enhancement): hide the pill and render the same list as a collapsed `<details>` above the body.

## Recommended reading: behaviour

- Up to 2 posts. Pick order: the post's `related` list if set; otherwise same category, newest first; then newest overall. Always exclude the current post and drafts.
- 2 items: Next up card (item 1) + "Also:" line (item 2: title link + date).
- 1 item: Next up card only. 0 items: render nothing — no section, no heading, no top margin.
- The whole card is one `<a>` (the title is the accessible name). The arrow icon is `aria-hidden`. Wrap in `<section aria-label="Recommended reading">`.
- Sits 48px after the last paragraph, inside the article column (not in the sidebar).

## Routes

| Route             | Notes                                                                                                                                                                                                                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`               | Intro (name, tagline, 2–3 paragraph bio, Resume · Email · LinkedIn · GitHub), the 3 newest featured posts, "View all writing →". Lead story large at `md+`, the other two in a 2-col grid.                                                                                                                                  |
| `/blog`           | Newest first, no sort control. Grouped by year. Client-side title search (case-insensitive) + category filter, mirrored to `?q=&cat=`. Phone: native select; `md+`: underlined filter buttons with `aria-pressed`. Empty state with "Clear filters". Preview-mode banner + Draft badge.                                     |
| `/blog/:slug`     | Category · title · published date · "Updated …" (only if a different calendar day). Optional cover (full-bleed on phone). ToC, prose body, Next up.                                                                                                                                                                         |
| `/snippets`       | Rows: title (the only link to the snippet; the row itself is not a link, so tags can be links), language (mono, accent), description, tag links. `?tag=` filters client-side like `/blog` (not part of the cache key); the filter bar shows the count and Clear; no match → "Nothing here yet" with a link to all snippets. |
| `/snippets/:slug` | Back link, title, language + tag links, description, Shiki code block with a Copy button (label → "Copied" for 2s, `aria-live`), notes in prose.                                                                                                                                                                            |
| `+error`          | 404 and 5xx inside the site chrome, no active nav item. Static copy only (no data load). 404: Browse writing · Go home. 5xx: Try again (reload) · Go home.                                                                                                                                                                  |
| `/resume`         | On screen inside the site chrome, with a "Save as PDF" button that calls `window.print()`. Print rules below.                                                                                                                                                                                                               |

## Resume print

- `print:hidden` on the top bar, header, tab bar, footer, preview banner and the Save as PDF button.
- `print:bg-white print:text-black`; all rules black 1px; links print as plain text with full URLs (bhargavshukla.com, linkedin.com/in/…, github.com/…).
- `break-inside-avoid` on every job; `break-after-avoid` on section headings; `@page { size: letter; margin: 0.6in 0.75in }`.
- Target: page 1 = header, summary, all experience; page 2 = skills and education.
- Not built: the mockup's page-2 running header and "Page n of 2" footer. Browsers can't place running content from CSS alone; the browser's own print header/footer option covers page numbers.

## Accessibility checklist

- Landmarks: `header`, `nav[aria-label=Primary]`, `main`, `article`, `aside` (ToC sidebar), `footer`. The bottom tab bar is the same Primary nav, shown only below `md`.
- Active nav: `aria-current="page"`. Active ToC item: `aria-current="location"`. Filters: `aria-pressed`.
- Touch targets ≥ 44px (`min-h-11`), including tab bar items, filter buttons, intro links and the Copy button.
- Focus: the focus ring above. Never remove outlines without it.
- Tab bar: `pb-[env(safe-area-inset-bottom)]`; `main` gets bottom padding equal to the bar height so the footer is never hidden.
- Contrast: every text role is ≥ 4.5:1 on its background in both themes (see [Colour roles](#colour-roles)).

## Adaptations

The handoff was written as if posts were Markdown files. Our posts come from Strapi and render through `marked` + Shiki, so:

| Handoff says                  | We do                                                                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Heading ids via `rehype-slug` | `src/lib/server/markdown.ts` gives h2/h3 slug ids in a custom `marked` heading renderer and returns the heading list for the ToC. |
| `draft?: boolean`             | Strapi Draft & Publish status. Drafts are only fetched in preview mode (`status=draft`).                                          |
| `publishedAt: Date`           | `displayDate ?? publishedAt`.                                                                                                     |
| `updatedAt?: Date`            | Strapi `updatedAt`; show "Updated …" only on a different calendar day from the shown publish date.                                |
| `category` enum               | `category` relation → Category collection type ([content-model.md](content-model.md)), so a new category needs no redeploy.       |
| `related?: string[]` (slugs)  | `related` relation → Post.                                                                                                        |
| `cover: { src, alt }`         | `cover` media; `alt` from its `alternativeText`.                                                                                  |
| `featured?: boolean`          | `featured`; home shows the 3 newest featured posts (the 3 newest posts, headed "Latest", while none are featured).                |
| Snippet frontmatter           | Snippet type as is (`title`, `language`, `description`, `tags`, `code`, `notes`).                                                 |

The handoff's "build it all at once" prompt is not used. The design is built ticket by ticket: #4 layout and typography, #5 resume, #6 SEO/error, #9 blog routes, #18 snippets — see [roadmap.md](roadmap.md).
