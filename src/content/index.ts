import { z } from 'astro/zod';

/** A raw entry as a loader hands it over: id (file name), parsed data and body text. */
export interface RawEntry {
  id: string;
  data: unknown;
  body?: string;
}

// Schema rule: every field is either required with no default, or optional with a default.
const calendarDate = z
  .union([z.string(), z.date()])
  .transform((value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value))
  .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && isRealDate(value), {
    message: 'must be a calendar date like 2026-09-01',
  });

function isRealDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const categorySchema = z.strictObject({
  name: z.string().min(1),
});

export const settingsSchema = z.strictObject({
  writingPageSize: z.number().int().min(1).default(10),
});

// "page" is reserved: the Writing list's numbered pages live at /writing/page/<n>.
const RESERVED_SLUGS = ['page'];

export const postSchema = z.strictObject({
  title: z.string().min(1),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be lowercase words joined by hyphens')
    .refine((slug) => !RESERVED_SLUGS.includes(slug), { message: 'is reserved and cannot be used as a slug' }),
  summary: z.string().min(1),
  category: z.string().min(1),
  publishDate: calendarDate,
  updatedDate: calendarDate.nullable().default(null),
  draft: z.boolean().default(false),
  featured: z.boolean().default(false),
  // Book Reviews (Posts in the Books Category) must set both; see loadContent.
  bookTitle: z.string().min(1).nullable().default(null),
  bookAuthor: z.string().min(1).nullable().default(null),
});

const SETTINGS_ID = 'site';
const BOOKS_CATEGORY_ID = 'books';
const WORDS_PER_MINUTE = 200;

function readingTime(body: string): number {
  const words = body.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

/** Returns the source of the first image with empty or missing alt text, ignoring code. */
function findImageWithoutAlt(body: string): string | null {
  const prose = body
    .replace(/^[ \t]*(```+|~~~+)[\s\S]*?^[ \t]*\1.*$/gm, '')
    .replace(/(`+)[^\n]*?\1/g, '');
  for (const match of prose.matchAll(/!\[([^\]]*)\]\(\s*<?([^)\s>]*)/g)) {
    if (match[1].trim() === '') return `"${match[2]}"`;
  }
  for (const match of prose.matchAll(/<img\b[^>]*>/gi)) {
    const alt = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(match[0]);
    if (!alt || (alt[1] ?? alt[2]).trim() === '') {
      return `"${/\bsrc\s*=\s*["']([^"']*)/i.exec(match[0])?.[1] ?? 'unknown'}"`;
    }
  }
  return null;
}

export interface Category {
  id: string;
  name: string;
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  summary: string;
  category: Category;
  /** Calendar date, YYYY-MM-DD, read in America/Toronto. */
  publishDate: string;
  updatedDate: string | null;
  draft: boolean;
  featured: boolean;
  bookTitle: string | null;
  bookAuthor: string | null;
  /** The Updated Date, only when it is later than the Publish Date. */
  updatedDateToShow: string | null;
  /** Whole minutes, at least 1. */
  readingTime: number;
  body: string;
}

export interface Settings {
  writingPageSize: number;
}

export interface ContentInput {
  categories: RawEntry[];
  posts: RawEntry[];
  /** Site settings files; the only one allowed is "site", and defaults apply when it is absent. */
  settings?: RawEntry[];
}

export interface Content {
  settings: Settings;
  categories: Category[];
  /** Newest first. */
  posts: Post[];
}

export interface LoadOptions {
  /** The build time. Injected so tests can fix the clock. */
  now: Date;
  /** Local development: include Drafts (flagged) so the author can preview them. Scheduled items stay hidden. */
  includeDrafts?: boolean;
}

/**
 * Validate raw entries against the schema and return the visible Posts, newest first.
 * Every entry is validated, visible or not. Throws an error naming the failing entry.
 */
export function loadContent(input: ContentInput, options: LoadOptions): Content {
  for (const entry of input.settings ?? []) {
    if (entry.id !== SETTINGS_ID) fail('Settings', entry.id, `unknown settings file; the only one allowed is "${SETTINGS_ID}"`);
  }
  const siteSettings = input.settings?.find((entry) => entry.id === SETTINGS_ID);
  const settings = siteSettings
    ? parse('Settings', siteSettings.id, settingsSchema, siteSettings.data)
    : settingsSchema.parse({});
  const categories = input.categories.map((entry) => {
    const data = parse('Category', entry.id, categorySchema, entry.data);
    return { id: entry.id, name: data.name };
  });
  const categoriesById = new Map(categories.map((category) => [category.id, category]));

  const slugOwners = new Map<string, string>();
  const posts = input.posts.map((entry): Post => {
    const data = parse('Post', entry.id, postSchema, entry.data);
    const body = entry.body ?? '';
    if (body.trim() === '') fail('Post', entry.id, 'body: must not be empty');

    const category = categoriesById.get(data.category);
    if (!category) fail('Post', entry.id, `category: Category "${data.category}" does not exist`);

    if (category.id === BOOKS_CATEGORY_ID) {
      if (!data.bookTitle) fail('Post', entry.id, 'bookTitle: required for a Book Review');
      if (!data.bookAuthor) fail('Post', entry.id, 'bookAuthor: required for a Book Review');
    }
    if (category.id !== BOOKS_CATEGORY_ID && (data.bookTitle || data.bookAuthor)) {
      fail('Post', entry.id, 'bookTitle/bookAuthor: only allowed on Posts in the Books Category');
    }
    const missingAlt = findImageWithoutAlt(body);
    if (missingAlt) fail('Post', entry.id, `body: image ${missingAlt} has no alt text`);

    const owner = slugOwners.get(data.slug);
    if (owner) throw new Error(`Duplicate slug "${data.slug}" used by Posts "${owner}" and "${entry.id}"`);
    slugOwners.set(data.slug, entry.id);

    return {
      id: entry.id,
      ...data,
      category,
      body,
      updatedDateToShow: data.updatedDate && data.updatedDate > data.publishDate ? data.updatedDate : null,
      readingTime: readingTime(body),
    };
  });

  const today = torontoDate(options.now);
  const visible = posts.filter(
    (post) => post.publishDate <= today && (!post.draft || options.includeDrafts === true),
  );
  // Newest first; slug breaks ties so pages never shuffle between builds.
  visible.sort((a, b) => b.publishDate.localeCompare(a.publishDate) || a.slug.localeCompare(b.slug));
  return { settings, categories, posts: visible };
}

export interface Page<T> {
  items: T[];
  /** 1-based, clamped into range. */
  page: number;
  /** At least 1, even for an empty list. */
  pageCount: number;
  pageSize: number;
  total: number;
  /** 1-based position of the first and last item on this page; 0 when the list is empty. */
  firstItem: number;
  lastItem: number;
}

/** Slice a list into one page. An out-of-range page is clamped, so a stale URL still lands somewhere valid. */
export function paginate<T>(items: readonly T[], options: { page: number; pageSize: number }): Page<T> {
  const { pageSize } = options;
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error(`pageSize must be a whole number of at least 1, got ${pageSize}`);

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.trunc(options.page) || 1), pageCount);
  const start = (page - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  return {
    items: slice,
    page,
    pageCount,
    pageSize,
    total,
    firstItem: total === 0 ? 0 : start + 1,
    lastItem: total === 0 ? 0 : start + slice.length,
  };
}

/** The calendar date at `now` in America/Toronto, as YYYY-MM-DD. */
function torontoDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function parse<T extends z.ZodType>(kind: string, id: string, schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const problems = result.error.issues.map((issue) => {
    const path = issue.path.join('.');
    const detail =
      issue.code === 'unrecognized_keys' ? `unknown field ${issue.keys.join(', ')}` : issue.message;
    return `${path || 'entry'}: ${detail}`;
  });
  return fail(kind, id, problems.join('; '));
}

function fail(kind: string, id: string, message: string): never {
  throw new Error(`${kind} "${id}" is invalid: ${message}`);
}
