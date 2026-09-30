# Content model (Strapi 5)

Draft & Publish is **on** for every collection type except Tag and Category. Long-form fields use Strapi's **Rich text (Markdown)** field, not Blocks.

## Shared components

| Component     | Fields                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `shared.seo`  | `metaTitle` string (≤60), `metaDescription` text (≤160), `ogImage` media (image), `canonicalUrl` string (for cross-posts) |
| `shared.link` | `label` string (required), `url` string (required)                                                                        |

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
- **Home intro** — static copy in SvelteKit. It includes the about copy; there is no `/about` page.
- **Projects** — not in v1; see the backlog in [roadmap.md](roadmap.md).

## Working rules

- The Content-Type Builder only works in `develop` mode. Schema changes are made locally in `cms/`, committed as `src/api/**/content-types/**/schema.json` and `src/components/**`, and shipped as a new image. Content is edited in the production admin.
- The **Public** role gets no permissions. SvelteKit reads with a **read-only API token** (custom token: `find` and `findOne` on the four types: Post, Category, Snippet, Tag).
- Strapi 5 REST responses are flattened (no `attributes` wrapper) and entries have a `documentId`. Only published entries are returned unless `status=draft` is asked for.
