# Content model (Strapi 5)

Draft & Publish is **on** for every collection type except Tag and Category. Long-form fields use Strapi's **Rich text (Markdown)** field, not Blocks.

## Shared components

| Component     | Fields                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `shared.seo`  | `metaTitle` string (≤60), `metaDescription` text (≤160), `ogImage` media (image), `canonicalUrl` string (for cross-posts) |
| `shared.link` | `label` string (required), `url` string (required)                                                                        |

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

## Collection types

### Tag — `tag` (Draft & Publish off)

Used by snippets only. Each tag links to `/snippets?tag=<slug>`.

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

| Field         | Type                             | Notes                                                   |
| ------------- | -------------------------------- | ------------------------------------------------------- |
| `title`       | string                           | required                                                |
| `slug`        | uid ← `title`                    | required                                                |
| `summary`     | text (≤280)                      | required; used in lists, RSS, meta description fallback |
| `body`        | rich text (Markdown)             | required                                                |
| `cover`       | media (image)                    | optional; alt text from the media's `alternativeText`   |
| `category`    | relation, many-to-one → Category | required                                                |
| `related`     | relation, one-way → Post (many)  | optional; overrides "Next up" picks, frontend uses ≤ 2  |
| `featured`    | boolean                          | default `false`; home shows the 3 newest featured       |
| `displayDate` | date                             | optional backdate override; falls back to `publishedAt` |
| `seo`         | `shared.seo`                     | optional                                                |

Ideas are short posts in the Ideas category. Book reviews are posts in the Books category: put the author in the title or summary, and the takeaway in the summary.

The post page shows "Updated …" from Strapi's `updatedAt` when it falls on a different calendar day from the shown publish date.

### Snippet — `snippet`

| Field         | Type                         | Notes                                                                                                                                                                            |
| ------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`       | string                       | required                                                                                                                                                                         |
| `slug`        | uid ← `title`                | required                                                                                                                                                                         |
| `description` | text                         | optional                                                                                                                                                                         |
| `language`    | enumeration                  | `typescript`, `javascript`, `tsx`, `svelte`, `python`, `bash`, `sql`, `go`, `c`, `cpp`, `json`, `yaml`, `dockerfile`, `text` — must match the Shiki languages the frontend loads |
| `code`        | long text                    | required                                                                                                                                                                         |
| `notes`       | rich text (Markdown)         | optional                                                                                                                                                                         |
| `tags`        | relation, many-to-many → Tag |                                                                                                                                                                                  |

## Not in the CMS

- **Resume** — static page backed by typed data in `src/lib/content/resume.ts`. Shape it like future Strapi components (`experience[]`, `education[]`, `skillGroups[]`) so it can move into a `resume` single type later. Reasons are in [architecture.md](architecture.md#decisions).
- **Projects** — not in v1; see the backlog in [roadmap.md](roadmap.md).

## Writing in Markdown

- Code fences take the language and an optional filename: ` ```ts rotation.ts `. The block header shows both, with a Copy button.
- Highlighted languages: TypeScript (`ts`), JavaScript (`js`), TSX, Svelte, Python (`py`), Bash (`sh`), SQL, Go, C, C++, C# (`cs`), JSON, YAML, Dockerfile. Anything else renders as plain text. The list lives in `src/lib/server/markdown.ts`, and each language adds to the Worker size.
- `##` and `###` headings feed the table of contents, which appears once a post has two or more `##` sections.

## Working rules

- The Content-Type Builder only works in `develop` mode. Schema changes are made locally in `cms/`, committed as `src/api/**/content-types/**/schema.json` and `src/components/**`, and shipped as a new image. Content is edited in the production admin.
- The **Public** role gets no permissions. SvelteKit reads with a **read-only API token** (custom token: `find` and `findOne` on Post, Category, Snippet and Tag, and `find` on Profile).
- Strapi 5 REST responses are flattened (no `attributes` wrapper) and entries have a `documentId`. Only published entries are returned unless `status=draft` is asked for.
