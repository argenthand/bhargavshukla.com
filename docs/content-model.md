# Content model (Strapi 5)

Draft & Publish is **on** for every collection type except Tag and Category. Long-form fields use Strapi's **Rich text (Markdown)** field, not Blocks.

## Shared components

| Component      | Fields                                                                                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared.seo`   | `metaTitle` string (≤60), `metaDescription` text (≤160), `ogImage` media (image), `canonicalUrl` string (for cross-posts)                                        |
| `shared.link`  | `label` string (required), `url` string (required)                                                                                                               |
| `shared.image` | `file` media (image) **or** `url` string (https), `alt` string (required), `creditName`, `creditUrl`, `source` enum (`unsplash`, `pexels`, `other`), `sourceUrl` |

## Single types

### Profile — `profile` (Draft & Publish off)

The home intro and contact links (#42); the resume header reuses them. Edits go live as soon as they're saved.

| Field      | Type                 | Notes                                                      |
| ---------- | -------------------- | ---------------------------------------------------------- |
| `name`     | string               | required; the intro heading                                |
| `tagline`  | string               | required; the italic line under the name                   |
| `bio`      | rich text (Markdown) | required; the intro paragraphs (there is no `/about` page) |
| `email`    | email                | optional; the Email link (`mailto:`)                       |
| `linkedin` | string               | optional; full URL                                         |
| `github`   | string               | optional; full URL                                         |

Until the profile is saved, or when Strapi can't be reached, the home page shows the name from `src/lib/site.ts` and no bio or links.

### Resume — `resume` (Draft & Publish on)

The `/resume` page (#5). The header (name, tagline, email, LinkedIn, GitHub) comes from the Profile. Work on it as a draft; the page shows only the published version and returns 404 until the first publish.

| Field         | Type                                       | Notes                                                             |
| ------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| `location`    | string                                     | optional; printed in the header only, e.g. "Guelph, ON, Canada"   |
| `summary`     | text                                       | required                                                          |
| `experience`  | component `resume.experience`, repeatable  | shown newest first by start date, whatever the order in the admin |
| `skillGroups` | component `resume.skill-group`, repeatable | shown in admin order                                              |
| `education`   | component `resume.education`, repeatable   | shown in admin order                                              |

| Component            | Fields                                                                                                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resume.experience`  | `role` string (required), `company` string (required), `location` string (e.g. "Kitchener, ON · Hybrid"), `startDate` date (required), `endDate` date (empty = Present), `highlights` rich text (a Markdown list) |
| `resume.skill-group` | `label` string (required), `skills` text (required; comma-separated)                                                                                                                                              |
| `resume.education`   | `credential` string (required; e.g. "BEng, Computer Engineering"), `school` string (required), `year` string                                                                                                      |

Dates show as month and year ("Mar 2026"); the day is ignored.

## Collection types

### Tag — `tag` (Draft & Publish off)

Used by asides only. Each tag links to `/asides?tag=<slug>`.

| Field  | Type         | Notes            |
| ------ | ------------ | ---------------- |
| `name` | string       | required, unique |
| `slug` | uid ← `name` | required         |

### Category — `category` (Draft & Publish off)

Every post has exactly one category. It is shown in the post heading and list rows, and drives the Writing filter ([design.md](design.md)). It is a collection type rather than an enumeration so a new category needs no schema change or redeploy.

| Field  | Type         | Notes            |
| ------ | ------------ | ---------------- |
| `name` | string       | required, unique |
| `slug` | uid ← `name` | required         |

Initial categories: Leadership, Engineering, Tools, Ideas, Books.

### Post — `post`

| Field         | Type                             | Notes                                                      |
| ------------- | -------------------------------- | ---------------------------------------------------------- |
| `title`       | string                           | required                                                   |
| `slug`        | uid ← `title`                    | required                                                   |
| `summary`     | text (≤280)                      | required; used in lists, RSS, meta description fallback    |
| `body`        | rich text (Markdown)             | required                                                   |
| `cover`       | `shared.image`                   | optional; an upload (no credit) or a credited linked photo |
| `category`    | relation, many-to-one → Category | required                                                   |
| `related`     | relation, one-way → Post (many)  | optional; overrides "Next up" picks, frontend uses ≤ 2     |
| `featured`    | boolean                          | default `false`; home shows the 3 newest featured          |
| `displayDate` | date                             | optional backdate override; falls back to `publishedAt`    |
| `seo`         | `shared.seo`                     | optional                                                   |

Ideas are short posts in the Ideas category. Book reviews are posts in the Books category: put the author in the title or summary, and the takeaway in the summary.

The post page shows "Updated …" from Strapi's `updatedAt` when it falls on a different calendar day from the shown publish date.

### Aside — `aside`

Short-form (#18): a code snippet, a quote, a practical tip or a thought, anything too small for a post. It replaces the code-only Snippet type, and is shown in full in the `/asides` stream with its own page at `/asides/<slug>`.

| Field          | Type                         | Notes                                                                              |
| -------------- | ---------------------------- | ---------------------------------------------------------------------------------- |
| `kind`         | enumeration                  | required: `code`, `quote`, `tip`, `thought`; the label, the filter and the styling |
| `title`        | string                       | optional; most quotes and thoughts don't need one                                  |
| `slug`         | uid ← `title`                | required; type one yourself when there's no title                                  |
| `body`         | rich text (Markdown)         | required; code goes in a fenced block (see below)                                  |
| `sourceAuthor` | string                       | optional; for quotes: "— Author, _Title_"                                          |
| `sourceTitle`  | string                       | optional; the book, talk or article                                                |
| `sourceUrl`    | string                       | optional; links the title                                                          |
| `tags`         | relation, many-to-many → Tag |                                                                                    |

- **Quote:** write only the words; the page adds the curly quotes and the attribution.
- **Untitled asides** get a name for links, page titles and screen readers: "Quote from _Title_", or the first words of the body.

## Not in the CMS

- **Projects** — not in v1; see the backlog in [roadmap.md](roadmap.md).

## Writing in Markdown

- Code fences take the language and an optional filename: ` ```ts rotation.ts `. The block header shows both, with a Copy button.
- Highlighted languages: TypeScript (`ts`), JavaScript (`js`), TSX, Svelte, Python (`py`), Bash (`sh`), SQL, Go, C, C++, C# (`cs`), JSON, YAML, Dockerfile. Anything else renders as plain text. The list lives in `src/lib/server/markdown.ts`, and each language adds to the Worker size.
- `##` and `###` headings feed the table of contents, which appears once a post has two or more `##` sections.

## Images (#40)

An image is either **your own upload** (`file`, served from R2, no credit) or **a linked photo** (`url` on `images.unsplash.com` or `images.pexels.com`, never re-hosted). A save-time check in `cms/src/index.ts` rejects both or neither, a non-https URL, and a linked photo without `creditName` and `source`.

- The cover's caption reads "Photo by [creditName](creditUrl) on [Unsplash](sourceUrl)". Unsplash links get `utm_source=bhargavshukla.com&utm_medium=referral`, as Unsplash asks.
- Linked Unsplash/Pexels photos are served in four widths (640–1920) through the CDN's `w` parameter.
- In a post body, put the credit as an italic line **directly under** the image (no blank line) to get a captioned figure:

  ```md
  ![Alt text](https://images.unsplash.com/photo-…)
  _Photo by [Jane Doe](https://unsplash.com/@jane) on [Unsplash](https://unsplash.com/photos/…)_
  ```

- Terms (checked 2026-10-01): neither the Unsplash nor the Pexels license requires credit for use on a blog; both appreciate it. Unsplash's API guidelines require linking to its image URLs and the referral parameters, but only for apps using its API; picking photos by hand isn't API use. Pexels allows linking to `images.pexels.com`.
- Trade-offs: a linked photo breaks if the photographer removes it, and backups can't restore it; readers' browsers load it from Unsplash or Pexels.

## Working rules

- The Content-Type Builder only works in `develop` mode. Schema changes are made locally in `cms/`, committed as `src/api/**/content-types/**/schema.json` and `src/components/**`, and shipped as a new image. Content is edited in the production admin.
- The **Public** role gets no permissions. SvelteKit reads with a **read-only API token** (custom token: `find` and `findOne` on Post, Category, Aside and Tag, and `find` on Profile and Resume).
- Strapi 5 REST responses are flattened (no `attributes` wrapper) and entries have a `documentId`. Only published entries are returned unless `status=draft` is asked for.
