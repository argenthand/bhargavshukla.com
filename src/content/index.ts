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

export const postSchema = z.strictObject({
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be lowercase words joined by hyphens'),
  summary: z.string().min(1),
  category: z.string().min(1),
  publishDate: calendarDate,
  updatedDate: calendarDate.nullable().default(null),
  draft: z.boolean().default(false),
  featured: z.boolean().default(false),
});

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
  body: string;
}

export interface ContentInput {
  categories: RawEntry[];
  posts: RawEntry[];
}

export interface Content {
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

    const owner = slugOwners.get(data.slug);
    if (owner) throw new Error(`Duplicate slug "${data.slug}" used by Posts "${owner}" and "${entry.id}"`);
    slugOwners.set(data.slug, entry.id);

    return { id: entry.id, ...data, category, body };
  });

  const today = torontoDate(options.now);
  const visible = posts.filter(
    (post) => post.publishDate <= today && (!post.draft || options.includeDrafts === true),
  );
  visible.sort((a, b) => b.publishDate.localeCompare(a.publishDate));
  return { categories, posts: visible };
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
