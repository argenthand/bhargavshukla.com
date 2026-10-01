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
| Scope               | Home, Writing, Post, Asides (with tag links), Resume, error page, global nav. No projects, book or tag-page sections in v1: see [Sections](#sections).                       |

## Sections

Decided in #23: the site stays small so the nav stays at three items (Writing · Asides · Resume; Asides replaced Snippets in #18) and the phone tab bar stays at three tabs.

| Section      | Decision                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| About        | No `/about` page. The home intro carries the bio (2–3 short paragraphs) and the Resume · Email · LinkedIn · GitHub links. |
| Book reviews | Ordinary posts in the **Books** category. They get the Writing filter, Next up and the post layout for free.              |
| Tags         | On asides only. Each tag links to `/asides?tag=<slug>`. Posts have no tags; their category does the grouping.             |
| Projects     | Not in v1. Parked in the backlog ([#22](https://github.com/argenthand/bhargavshukla.com/issues/22)).                      |

## Artboards

| Artboard                  | Shows                                                                                                                                                                                                                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `F-components`            | All states of the ToC pill, sheet and sidebar; Next up with 0/1/2 items; category label, meta, draft badge, focus ring; nav.                                                                                                                                                                                    |
| `F-home-*`                | Home at phone (light, dark), tablet, desktop (light, dark).                                                                                                                                                                                                                                                     |
| `F-writing-*`             | Writing list: phone in preview mode, phone no-results (dark), tablet, desktop, desktop no-results (dark).                                                                                                                                                                                                       |
| `F-post-*`                | Post: phone with cover + pill, phone with sheet open, phone dark no cover, tablet (pill), desktop with sidebar, dark 1-rec variant.                                                                                                                                                                             |
| `F-snippet*`              | Snippets list and detail at every size; dark detail shows the "Copied" state.                                                                                                                                                                                                                                   |
| `F-resume-*`              | Resume on screen at every size, and Letter print pages 1 and 2.                                                                                                                                                                                                                                                 |
| `F-home-v2-*`             | Home with the about copy in the intro and an Email link; a Books post in Featured. Replaces `F-home-*` for the intro.                                                                                                                                                                                           |
| `F-intro-*`               | Home intro rework (#59). Option A (name only in the intro; it fades into the sticky phone header once the intro scrolls away) was picked over B. Built from `F-intro-r-desktop-768-round` and `F-intro-r-phone-round`: the home page is 768 wide like Writing, with an optional round headshot beside the name. |
| `F-error-*`               | Error page: 404 on phone (light, dark) and desktop (light), 500 on desktop (dark).                                                                                                                                                                                                                              |
| `F-asides-*`, `F-aside-*` | Asides (#18) replaced Snippets: the stream on phone and desktop with every kind, `?tag=` filtered (phone dark), no results (desktop dark), and an aside's page (code on desktop, untitled quote on phone dark). The `F-snippet*` artboards are superseded.                                                      |
| `F-snippets-tags-*`       | Snippets list with tag links; filtered by `?tag=` (phone dark, desktop light); unknown tag (desktop dark). Supersedes the tag line in `F-snippets-*`.                                                                                                                                                           |

## CSS entry

Tailwind CSS v4 with the typography plugin. Default theme apart from the fonts below; [`src/routes/layout.css`](../src/routes/layout.css) is the source of truth and also holds the layout tokens and component classes ([Styling rules](#styling-rules)).

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

| Range        | Layout                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------- |
| < 768 (base) | Slim top bar with name + fixed bottom tab bar (Writing, Asides, Resume). ToC = pill + sheet. |
| `md` ≥ 768   | Header with name + nav; tab bar hidden. ToC still pill + sheet.                              |
| `lg` ≥ 1024  | Post becomes 2 columns: 672px article + 224px sticky ToC sidebar with scroll-spy.            |

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

## Styling rules

Decided 2026-10-01 (#66):

- **No raw values in classes.** Use Tailwind's default scale (font size, leading, spacing, widths). When two defaults are equally close, round up.
- **A size with no default gets a name** in `@theme` (layout tokens below) and is used by that name.
- **Same role, same style.** Elements that do the same job use the same component class, everywhere. Every item in a list looks alike: no lead item, no kind or page that gets a bigger size.
- Not covered: variant selectors (`aria-[current=page]`, `data-[level=3]`), `env(safe-area-inset-*)` padding and `content-['…']`.

## Type scale

| Token       | Size | Use                                                                       |
| ----------- | ---- | ------------------------------------------------------------------------- |
| `text-xs`   | 12px | Labels, section headings, tab labels, badges (uppercase, tracking-widest) |
| `text-sm`   | 14px | Meta: dates, captions, attributions, tag links, footer; code-block header |
| `text-base` | 16px | UI text, ToC items                                                        |
| `text-lg`   | 18px | Body copy (`prose-lg`), every aside's text, summaries, nav, links         |
| `text-xl`   | 20px | Standfirst, mobile title bar, list titles (phone)                         |
| `text-2xl`  | 24px | List titles (`md+`), h2 (phone)                                           |
| `text-3xl`  | 30px | h2 (desktop), the resume name in print                                    |
| `text-4xl`  | 36px | Page titles: every h1, including posts and the error page                 |

## Layout tokens

In `@theme`, built from the default scale:

| Token                      | Value                     | Class                | Use                                       |
| -------------------------- | ------------------------- | -------------------- | ----------------------------------------- |
| `--container-article`      | `--container-2xl` (42rem) | `max-w-article`      | A post's text column                      |
| `--spacing-toc`            | 14rem                     | `w-toc`              | ToC sidebar at `lg`                       |
| `--spacing-article-gap`    | 4rem                      |                      | Between the text column and the ToC       |
| `--container-article-wide` | article + gap + ToC       | `max-w-article-wide` | Post header and cover when there is a ToC |
| `--spacing-resume-label`   | 9rem                      |                      | The resume's skill-group label column     |

## Component classes

One `@utility` per role in `layout.css`. Change it there and every use follows.

| Class                | Role                                                                                                            | Definition                                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `page`               | Every page's shell (width set per page: `max-w-3xl`, `max-w-200`, …)                                            | `mx-auto px-5 pt-8 pb-14 md:px-8 md:pt-12`                                                                                              |
| `page-title`         | Every h1                                                                                                        | `text-4xl font-medium tracking-tight text-balance`                                                                                      |
| `standfirst`         | The italic line under an h1 (home tagline, Writing, Asides, resume)                                             | `text-xl italic text-neutral-600 dark:text-neutral-400`                                                                                 |
| `body-copy`          | Running text outside articles: home bio, error copy, resume, statuses                                           | `text-lg/relaxed text-neutral-700 dark:text-neutral-300`                                                                                |
| `meta`               | Dates, captions, attributions, tag links, footer, "Also:"                                                       | `text-sm text-neutral-600 dark:text-neutral-400`                                                                                        |
| `label`              | Small uppercase heading (ToC "Contents")                                                                        | `text-xs font-semibold uppercase tracking-widest`                                                                                       |
| `label-accent`       | Category and kind labels, "Next up", error status                                                               | `label` + `text-red-700 dark:text-red-400`                                                                                              |
| `label-muted`        | Form field labels (Search titles, Category, Kind)                                                               | `label` + `text-neutral-600 dark:text-neutral-400`                                                                                      |
| `section-heading`    | Featured, Writing's years, resume sections: rule **below**                                                      | `label` + `border-b-2 border-neutral-900 pb-1.5 dark:border-neutral-100`                                                                |
| `list-entry`         | A row in a list of posts (Featured, Writing)                                                                    | `flex flex-col gap-2 py-5`                                                                                                              |
| `list-title`         | A post or aside title in any list, and the Next up card                                                         | `text-xl/snug md:text-2xl/snug font-semibold text-balance`                                                                              |
| `summary`            | A post summary in any list                                                                                      | `line-clamp-2 text-lg text-neutral-600 dark:text-neutral-400`                                                                           |
| `tap-target`         | Anything tappable: 44px tall                                                                                    | `inline-flex min-h-11 items-center`                                                                                                     |
| `link-cta`           | Accent links and actions: intro links, View all, Clear, Newer/Older, Go home                                    | `tap-target gap-1.5 text-lg text-red-700 underline decoration-1 underline-offset-4` + hover (`decoration-2`, darker red), dark          |
| `link-quiet`         | Secondary links: dates in the stream, sources, tags, credits, "Also:"                                           | `underline decoration-neutral-200 underline-offset-4 hover:text-neutral-900 hover:decoration-current` + dark                            |
| `filter-button`      | Writing and Asides filter links (`md+`): `<a>`, so the browser shows a pointer and they work without JavaScript | `tap-target px-2.5 text-lg text-neutral-600 hover:text-neutral-900` + `aria-[current=true]:` underline in red, `decoration-2`, offset 8 |
| `select-underline`   | The phone filter `<select>`                                                                                     | `h-11 w-full appearance-none border-b border-neutral-900 text-lg` + focus/dark                                                          |
| `article-grid`       | Post text + ToC at `lg`                                                                                         | `minmax(0, --container-article)` and `--spacing-toc` columns, `--spacing-article-gap` gap                                               |
| `resume-skills-grid` | Skill group label + skills (`sm+` and print)                                                                    | `--spacing-resume-label` and `minmax(0, 1fr)` columns                                                                                   |
| `max-h-sheet`        | The ToC bottom sheet                                                                                            | `max-height: 80dvh`                                                                                                                     |
| `transition-fade`    | Fades that also hide (the home header name)                                                                     | `transition-property: opacity, visibility` with the default timing                                                                      |

## Components

`›` separates an element from its children. Component classes above are used by name.

| Component          | Tailwind classes                                                                                                                                                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Body               | `bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100`                                                                                                                                                                                           |
| Header             | `sticky top-0 z-10 border-b border-neutral-200 bg-white md:static` › `mx-auto flex h-14 max-w-5xl items-center justify-between px-5 md:h-20 md:px-8` › name: `tap-target text-xl md:text-2xl font-semibold tracking-tight`                                                  |
| Nav link (md+)     | `tap-target px-3 text-lg text-neutral-600 hover:text-neutral-900` + `aria-[current=page]:` underline in red, `decoration-2`, `underline-offset-8`                                                                                                                           |
| Bottom tab bar     | `fixed inset-x-0 bottom-0 z-20 grid auto-cols-fr grid-flow-col border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden`                                                                                                                             |
| Tab                | `flex min-h-14 flex-col items-center justify-center gap-1 text-xs text-neutral-600` + `aria-[current=page]:` red text and `font-semibold`; the red marker above slides between tabs ([Motion](#motion))                                                                     |
| Post row (Writing) | `li.border-b` › `a.group.list-entry` › `list-title` + `PostMeta`                                                                                                                                                                                                            |
| Featured (home)    | `section-heading` › each post: `article.list-entry.border-b` › `PostMeta`, `h3.list-title`, `p.summary` (all three alike) › `link-cta` "View all writing"                                                                                                                   |
| Draft badge        | `rounded-xs border border-dashed border-neutral-600 px-1.5 text-xs uppercase tracking-wide text-neutral-600 dark:border-neutral-400 dark:text-neutral-400`                                                                                                                  |
| Search             | `h-11 w-full border-0 border-b border-neutral-900 bg-transparent text-lg placeholder:text-neutral-500 focus:border-b-2 focus:border-red-700 focus:outline-none`                                                                                                             |
| Filters            | phone: `select-underline` with a `label-muted` label · `md+`: a `nav` of `filter-button` links. Writing filters in place (the click sets the filter; the `href` is for no-JS and new tabs); Asides links navigate with `data-sveltekit-replacestate`/`noscroll`/`keepfocus` |
| Article            | `prose prose-lg prose-neutral max-w-none dark:prose-invert …` (see `Prose.svelte`)                                                                                                                                                                                          |
| Code block (Shiki) | `not-prose -mx-5 border-y border-neutral-200 bg-neutral-50 font-mono text-sm md:mx-0` › header: `min-h-11 px-4 text-sm text-neutral-600`                                                                                                                                    |
| Focus ring         | `:focus-visible` outline 2px `red-700` (dark `red-400`), offset 2px (`layout.css`)                                                                                                                                                                                          |
| ToC pill (< lg)    | `sticky top-16 z-10` › button: `flex min-h-11 w-full items-center gap-2.5 border border-neutral-200 bg-white px-4 text-sm shadow-sm` › label: `text-neutral-600` · current: `truncate font-semibold`                                                                        |
| ToC sheet          | `<dialog>` `fixed inset-x-0 bottom-0 top-auto m-0 max-h-sheet w-full max-w-none border-t border-neutral-200 bg-white px-5 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl` › heading: `label`                                                                 |
| ToC sidebar (lg+)  | `hidden lg:block sticky top-24 self-start` › heading: `label`                                                                                                                                                                                                               |
| ToC item           | `flex min-h-10 items-center border-l-2 border-neutral-200 py-1.5 pl-3 text-base/snug` + `data-[level=3]:pl-7 data-[level=3]:text-sm` + `aria-[current=location]:` red border, text, semibold                                                                                |
| Post layout        | header and cover: `max-w-article` (`lg:max-w-article-wide` with a ToC) · body: `max-w-article`, with a ToC `lg:grid lg:article-grid lg:justify-center`                                                                                                                      |
| Next up card       | `flex flex-col gap-2 border border-neutral-200 bg-neutral-50 p-5 hover:border-neutral-900` › `label-accent` "Next up →", `list-title`, `summary`, `PostMeta`                                                                                                                |
| "Also:" line       | `flex flex-wrap items-baseline gap-3 px-1 pt-3` › `meta` "Also:", link: `tap-target link-quiet font-medium`, `meta` date                                                                                                                                                    |
| Aside              | `label-accent` kind · `meta link-quiet` date › title: `list-title` (stream) or `page-title` (its page) › body: `Prose` for every kind; a quote is `body-copy italic` between `border-y` rules, curly quotes added, `meta` attribution                                       |
| Tag link           | `meta tap-target link-quiet italic` + `aria-[current=true]:` red `decoration-2`                                                                                                                                                                                             |
| Tag filter bar     | `flex min-h-13 items-center justify-between gap-3 border border-neutral-200 bg-neutral-50 pl-4 pr-2` (`role="status"`) › `body-copy` text, `link-cta` Clear                                                                                                                 |
| Error page         | `page max-w-3xl` › `max-w-140 flex flex-col gap-4` › `label-accent` status (`404 · Not found`), `page-title`, `body-copy`, `link-cta` links in a row with `border-t border-neutral-200 pt-2`                                                                                |

## Motion

Small, quick and optional (#60; part 2 is #61).

**Rules**

- Tokens in `@theme`: `--duration-motion` (200 ms: fades, nudges, the tab marker, the page cross-fade), `--duration-title` (300 ms: titles moving between pages), `--duration-hover` (300 ms: link and button hovers), `--ease-motion` (`--ease-out`), `--distance-nudge` (2 px). Every animation uses them.
- Only `transform`/`translate`, `opacity`, or paint-only properties (colour, underline thickness): nothing that moves layout.
- Nothing animates with `prefers-reduced-motion: reduce`, and everything works without JavaScript.
- Svelte transitions (`fade`, `flip`) take numbers, not CSS values: use `motionMs()` from `src/lib/motion.ts` (`--duration-motion`, or 0 with reduced motion) and `cubicOut`. `--animate-confirm` (`confirm-in`: fade and scale in) is for a confirmation appearing.

**Interactions**

| Interaction      | Where                                                            | How                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page transitions | Every navigation to another page                                 | View Transitions via `onNavigate` in the layout: a cross-fade. The header and tab bar have their own `view-transition-name`, so they stay still. Skipped without browser support, with reduced motion, and for query-only changes (filters).                                                                                                                                                                                                                                        |
| Title moves      | Writing and Featured entries, titled asides ↔ their page heading | One `view-transition-name` per title (`titleTransition(kind, slug)` in `src/lib/motion.ts`, plus `data-title-transition`), so the title moves and resizes over `--duration-title` (300 ms; the page cross-fade stays at 200 ms). Only between a list and a post or aside page: between two lists (home → Writing) the layout sets `data-plain-transition` on `<html>` and titles just fade. Not on the Next up card: its move looked wrong. Names must be unique on a page.         |
| Arrow nudge      | Any → or ← icon inside a link or button                          | On hover and keyboard focus the arrow moves `--distance-nudge` in its direction (`translate`). Driven by the icon's `data-icon` in `layout.css`.                                                                                                                                                                                                                                                                                                                                    |
| Hover easing     | Every link and button                                            | A base rule on `a, button` eases colour, background, border and underline colour and thickness over `--duration-hover` (300 ms): `link-cta` thickens 1 → 2 px, `link-quiet` darkens to the text colour. Chrome doesn't interpolate underline thickness, so the thickness steps there while the colour still fades. `list-title` eases its own colour (the Writing list colours the title, not the link).                                                                            |
| Tab marker       | Phone tab bar                                                    | One red marker (`h-0.5`, `-top-px`) whose `translate` moves to the current tab; hidden when no tab is current. Replaces the per-tab top border.                                                                                                                                                                                                                                                                                                                                     |
| Header name      | Home page header (#59)                                           | `transition-fade` over `--duration-motion`.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Copy feedback    | Code blocks' Copy button (#61)                                   | The button shows a check and "Copied" for 1.5 s (`data-copied`; the check uses `--animate-confirm`); another click starts the 1.5 s again. Prose's `role="status"` region tells screen readers "Code copied to clipboard".                                                                                                                                                                                                                                                          |
| Heading links    | h2 and h3 in posts (#61)                                         | `renderMarkdown(…, { headingLinks: true })` adds a muted `#` after the heading text (`heading-link`): hidden until the heading is hovered or the link has keyboard focus, always shown at half strength on touch screens (`hover: none`). Clicking copies the section URL, puts the hash in the address bar and shows "Link copied" above the `#` for 1.5 s (`heading-toast`); the status region announces it. Without JavaScript it is a plain link to the section. Not in asides. |
| ToC marker       | ToC sidebar and sheet (#61)                                      | One red marker per list moves to the current entry with `translate` and `scale` (it is 1 px tall, scaled to the entry's height, so wrapped entries fit). It is placed without moving at first and re-measured when the list resizes (the sheet opening). Without JavaScript the current entry's own border is red.                                                                                                                                                                  |
| Reading progress | Posts (#61)                                                      | A red hairline (`h-0.5`) that fills with `scale` as the article scrolls past: along the bottom of the sticky top bar on phones, at the top of the window from md. It follows the scroll, so reduced motion doesn't change it. JavaScript only; hidden in print.                                                                                                                                                                                                                     |
| Filtering        | Writing and Asides lists (#61)                                   | When filters or the search change, rows that stay slide into place (`animate:flip`) and new rows and year headings fade in. Rows that go leave at once, so the rest can move straight away.                                                                                                                                                                                                                                                                                         |

## Easter eggs

For people who go looking (#63). Each one stays invisible otherwise and never gets in the way of reading. Change them on purpose, not by accident. Copy lives in `src/lib/easter-eggs.ts` unless noted.

| Egg                | Where                                          | How                                                                                                                                                                                                                                                                                                     |
| ------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Console note       | Every page, browser console                    | `consoleNote()` from the layout's `onMount`: a red heading and a line pointing to the contact links and `?`.                                                                                                                                                                                            |
| Keyboard shortcuts | Everywhere (`Shortcuts.svelte`, F-shortcuts-*) | `?` toggles a `<dialog>` listing them. `g` then a letter within 1.5 s goes to Home (`h`) or a live section (`shortcut` in `site.ts`: `w`, `a`, `r`). `/` focuses search on Writing. Ignored while typing in a field (`isTyping`), during IME composition, and with Ctrl/⌘/Alt held. Keys are `key-cap`. |
| Konami code        | Everywhere                                     | ↑↑↓↓←→←→BA (`konamiMatcher`) shows "You found it." at the bottom (a `role="status"`, so screen readers hear it) and, without reduced motion, drops accent-red confetti. `src/lib/confetti.ts` is a dynamic import, loaded only then; it uses transform and opacity and removes itself.                  |
| Headshot           | Home intro                                     | Five clicks within 2 s swap in the Profile's optional `photoAlt` (and back). Without one, the photo winks (`--animate-wink`; nothing with reduced motion). Mouse only on purpose: no button, so no extra tab stop.                                                                                      |
| 404 line           | `+error.svelte`, 404 only                      | One line from `NOT_FOUND_LINES` under the heading, picked from the path (`notFoundLine`), so server and browser agree and each broken link gets its own.                                                                                                                                                |
| Printed resume     | `/resume`, print only                          | A small line at the end, `hidden print:block`; copy in the page.                                                                                                                                                                                                                                        |

## Table of contents: behaviour

- Build the list from the rendered post's h2 and h3 (ids from our `marked` pipeline — see [Adaptations](#adaptations)). Render the ToC only when there are **2 or more h2s**.
- One list component, rendered twice: inside the sheet (< `lg`) and the sidebar (`lg+`); only one is visible via `lg:hidden` / `hidden lg:block`.
- Scroll-spy: on every scroll and resize (once per animation frame), the active item is the last heading whose top has crossed the line 72 px from the top (under the sticky bars). Not an `IntersectionObserver` band: a jump or fast fling could land with no heading in the band and leave the old item active (#61). Before the first heading, the first item is active.
- The active item gets `aria-current="location"`; a red marker slides to it (see [Motion](#motion)). Posts also have a reading progress hairline (#61); no percentage.
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

| Route           | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`             | `max-w-3xl`. Intro: optional round headshot (`size-28`, `md:size-30`) beside the name (`h1#intro-name`) and tagline, then the 2–3 paragraph bio and Resume · Email · LinkedIn · GitHub. Then up to 3 featured posts in one list, all styled alike (#66), and "View all writing →". The header leaves the name out on this page while the intro's `h1` is on screen (an IntersectionObserver in the layout; `js:` variant, so it stays without JavaScript), then fades it in (200 ms, none with reduced motion). |
| `/blog`         | Newest first, no sort control. Grouped by year. Client-side title search (case-insensitive) + category filter, mirrored to `?q=&cat=`. Phone: native select; `md+`: underlined filter links with `aria-current`. Empty state with "Clear filters". Preview-mode banner + Draft badge.                                                                                                                                                                                                                           |
| `/blog/:slug`   | Category · title · published date · "Updated …" (only if a different calendar day). Optional cover (full-bleed on phone). ToC, prose body, Next up.                                                                                                                                                                                                                                                                                                                                                             |
| `/asides`       | Every aside in full, newest first: kind · date (the date links to its page), optional title, the body, the same size for every kind (quote = italic between rules with “ ” and "— Author, _Title_"; code = the post code block), tag links. Filter by kind (select on phone, underlined buttons md+) and `?tag=` (filter bar with count and Clear), both client-side from the URL; no match → "Nothing here yet" + See all asides. 20 per page, "Older asides".                                                 |
| `/asides/:slug` | "All asides" back link, the aside (untitled ones get a visually hidden h1), tags, Newer / Older links.                                                                                                                                                                                                                                                                                                                                                                                                          |
| `+error`        | 404 and 5xx inside the site chrome, no active nav item. Static copy only (no data load). 404: Browse writing · Go home. 5xx: Try again (reload) · Go home.                                                                                                                                                                                                                                                                                                                                                      |
| `/resume`       | On screen inside the site chrome, with a "Save as PDF" button that calls `window.print()`. Print rules below.                                                                                                                                                                                                                                                                                                                                                                                                   |

## Resume print

- `print:hidden` on the top bar, header, tab bar, footer, preview banner and the Save as PDF button.
- `print:bg-white print:text-black`; all rules black 1px; links print as plain text with full URLs (bhargavshukla.com, linkedin.com/in/…, github.com/…).
- `break-inside-avoid` on every job; `break-after-avoid` on section headings; `@page { size: letter; margin: 0.6in 0.75in }`.
- Target: page 1 = header, summary, all experience; page 2 = skills and education.
- Not built: the mockup's page-2 running header and "Page n of 2" footer. Browsers can't place running content from CSS alone; the browser's own print header/footer option covers page numbers.

## Accessibility checklist

- Landmarks: `header`, `nav[aria-label=Primary]`, `main`, `article`, `aside` (ToC sidebar), `footer`. The bottom tab bar is the same Primary nav, shown only below `md`.
- Active nav: `aria-current="page"`. Active ToC item: `aria-current="location"`. Active filter link and tag: `aria-current="true"`.
- Touch targets ≥ 44px (`min-h-11`), including tab bar items, filter links, intro links and the Copy button.
- Focus: the focus ring above. Never remove outlines without it.
- Tab bar: `pb-[env(safe-area-inset-bottom)]`; `main` gets bottom padding equal to the bar height so the footer is never hidden.
- Contrast: every text role is ≥ 4.5:1 on its background in both themes (see [Colour roles](#colour-roles)).

## Adaptations

The handoff was written as if posts were Markdown files. Our posts come from Strapi and render through `marked` + Shiki, so:

| Handoff says                  | We do                                                                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Heading ids via `rehype-slug` | `src/lib/server/markdown.ts` gives h2/h3 slug ids in a custom `marked` heading renderer and returns the heading list for the ToC.  |
| `draft?: boolean`             | Strapi Draft & Publish status. Drafts are only fetched in preview mode (`status=draft`).                                           |
| `publishedAt: Date`           | `displayDate ?? publishedAt`.                                                                                                      |
| `updatedAt?: Date`            | Strapi `updatedAt`; show "Updated …" only on a different calendar day from the shown publish date.                                 |
| `category` enum               | `category` relation → Category collection type ([content-model.md](content-model.md)), so a new category needs no redeploy.        |
| `related?: string[]` (slugs)  | `related` relation → Post.                                                                                                         |
| `cover: { src, alt }`         | `cover` is a `shared.image`: an upload, or a linked photo with a "Photo by … on …" caption ([content-model.md](content-model.md)). |
| `featured?: boolean`          | `featured`; home shows the 3 newest featured posts (the 3 newest posts, headed "Latest", while none are featured).                 |
| Snippet frontmatter           | Replaced by the Aside type (#18): `kind`, optional `title`, Markdown `body`, quote source fields, `tags`.                          |

The handoff's "build it all at once" prompt is not used. The design is built ticket by ticket: #4 layout and typography, #5 resume, #6 SEO/error, #9 blog routes, #18 asides — see [roadmap.md](roadmap.md).
