import { z } from 'astro/zod';
import { bundledLanguages } from 'shiki/langs';

// List logic has no dependencies so the browser can import it directly and run the same code as the build.
export * from './list';

/** A raw entry as a loader hands it over: id (file name), parsed data and body text. */
export interface RawEntry {
  id: string;
  data: unknown;
  body?: string;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

// Languages Shiki can highlight, plus its plain-text names.
const PLAIN_TEXT_LANGUAGES = ['text', 'plaintext', 'txt', 'plain'];
const isKnownLanguage = (language: string) => Object.hasOwn(bundledLanguages, language) || PLAIN_TEXT_LANGUAGES.includes(language);

// "page" is reserved: the Writing list's numbered pages live at /writing/page/<n>.
const RESERVED_SLUGS = ['page'];

export const postSchema = z.strictObject({
  title: z.string().min(1),
  slug: z
    .string()
    .regex(SLUG, 'must be lowercase words joined by hyphens')
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
const RESUME_ID = 'resume';
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

export const snippetSchema = z.strictObject({
  title: z.string().min(1),
  explanation: z.string().min(1),
  code: z.string().refine((code) => code.trim() !== '', { message: 'must not be blank' }),
  language: z.string().min(1).superRefine((language, ctx) => {
    if (!isKnownLanguage(language)) ctx.addIssue({ code: 'custom', message: `"${language}" is not a language the site can highlight` });
  }),
  category: z.string().min(1),
  publishDate: calendarDate,
  updatedDate: calendarDate.nullable().default(null),
  draft: z.boolean().default(false),
});

const DEFAULT_PRINT_EASTER_EGG = 'You found the hidden line. It only shows up on paper.';

export const resumeSchema = z.strictObject({
  name: z.string().min(1),
  headline: z.string().min(1),
  location: z.string().min(1),
  email: z.email(),
  linkedin: z.url().nullable().default(null),
  github: z.url().nullable().default(null),
  summary: z.string().min(1),
  experience: z
    .array(
      z.strictObject({
        role: z.string().min(1),
        company: z.string().min(1),
        /** Shown as written, for example "2026 — Present". */
        dates: z.string().min(1),
        detail: z.string().min(1),
      }),
    )
    .min(1),
  skills: z
    .array(z.strictObject({ group: z.string().min(1), items: z.array(z.string().min(1)).min(1) }))
    .min(1),
  education: z
    .array(z.strictObject({ year: z.string().min(1), degree: z.string().min(1), school: z.string().min(1) }))
    .default([]),
  /** A line that appears only on the printed Resume. */
  printEasterEgg: z.string().min(1).default(DEFAULT_PRINT_EASTER_EGG),
});

export type Resume = z.output<typeof resumeSchema>;

/** Snippets longer than this many lines start collapsed. */
export const SNIPPET_COLLAPSE_LINES = 15;

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

export interface Snippet {
  /** The file name; also the anchor in /snippets#<id>, so it must stay fixed once published. */
  id: string;
  title: string;
  explanation: string;
  code: string;
  language: string;
  category: Category;
  /** Calendar date, YYYY-MM-DD, read in America/Toronto. */
  publishDate: string;
  updatedDate: string | null;
  /** The Updated Date, only when it is later than the Publish Date. */
  updatedDateToShow: string | null;
  draft: boolean;
  lineCount: number;
  collapsedByDefault: boolean;
}

export interface Settings {
  writingPageSize: number;
}

export interface ContentInput {
  categories: RawEntry[];
  posts: RawEntry[];
  snippets?: RawEntry[];
  /** Resume content files; the only one allowed is "resume". */
  resume?: RawEntry[];
  /** Site settings files; the only one allowed is "site", and defaults apply when it is absent. */
  settings?: RawEntry[];
}

export interface Content {
  settings: Settings;
  categories: Category[];
  /** Newest first. */
  posts: Post[];
  /** Newest first. */
  snippets: Snippet[];
  /** Null when no Resume content exists. */
  resume: Resume | null;
}

export interface LoadOptions {
  /** The build time. Injected so tests can fix the clock. */
  now: Date;
  /** Local development: include Drafts (flagged) so the author can preview them. Scheduled items stay hidden. */
  includeDrafts?: boolean;
}

/**
 * Validate raw entries against the schema and return the visible Posts and Snippets, newest first.
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
  for (const entry of input.resume ?? []) {
    if (entry.id !== RESUME_ID) fail('Resume', entry.id, `unknown Resume file; the only one allowed is "${RESUME_ID}"`);
  }
  const resumeEntry = input.resume?.find((entry) => entry.id === RESUME_ID);
  const resume = resumeEntry ? parse('Resume', resumeEntry.id, resumeSchema, resumeEntry.data) : null;
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

  const snippets = (input.snippets ?? []).map((entry): Snippet => {
    const data = parse('Snippet', entry.id, snippetSchema, entry.data);
    if (!SLUG.test(entry.id)) {
      fail('Snippet', entry.id, 'file name: must be lowercase words joined by hyphens, because it is the link anchor');
    }
    const category = categoriesById.get(data.category);
    if (!category) fail('Snippet', entry.id, `category: Category "${data.category}" does not exist`);
    const lineCount = data.code.replace(/\n$/, '').split('\n').length;
    return {
      id: entry.id,
      ...data,
      category,
      updatedDateToShow: data.updatedDate && data.updatedDate > data.publishDate ? data.updatedDate : null,
      lineCount,
      collapsedByDefault: lineCount > SNIPPET_COLLAPSE_LINES,
    };
  });

  // Drafts and Scheduled items are hidden. Locally, Drafts are shown; Scheduled items never are.
  const today = torontoDate(options.now);
  const isVisible = (item: { publishDate: string; draft: boolean }) =>
    item.publishDate <= today && (!item.draft || options.includeDrafts === true);

  // Newest first; the slug (or file name) breaks ties so lists never shuffle between builds.
  const visiblePosts = posts.filter(isVisible);
  visiblePosts.sort((a, b) => b.publishDate.localeCompare(a.publishDate) || a.slug.localeCompare(b.slug));
  const visibleSnippets = snippets.filter(isVisible);
  visibleSnippets.sort((a, b) => b.publishDate.localeCompare(a.publishDate) || a.id.localeCompare(b.id));
  return { settings, categories, posts: visiblePosts, snippets: visibleSnippets, resume };
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
