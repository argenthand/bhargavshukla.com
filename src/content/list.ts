/** The fields the list logic needs from a Post. */
export interface Listable {
  slug: string;
  title: string;
  /** Calendar date, YYYY-MM-DD. */
  publishDate: string;
  category: { id: string };
}

export type ListSort = 'newest' | 'oldest';

/** Search, filter, sort and page for a list, as it appears in the URL. */
export interface ListQuery {
  q: string;
  /** A Category id, or null for all Categories. */
  category: string | null;
  sort: ListSort;
  /** 1-based. */
  page: number;
}

export const DEFAULT_LIST_QUERY: ListQuery = { q: '', category: null, sort: 'newest', page: 1 };

/** Read a query from URL parameters. Anything invalid falls back to its default. */
export function parseListQuery(params: string | URLSearchParams, options: { categoryIds: readonly string[] }): ListQuery {
  const search = typeof params === 'string' ? new URLSearchParams(params) : params;
  const category = search.get('category');
  const page = search.get('page') ?? '';
  return {
    q: (search.get('q') ?? '').trim(),
    category: category !== null && options.categoryIds.includes(category) ? category : null,
    sort: search.get('sort') === 'oldest' ? 'oldest' : 'newest',
    page: /^[1-9]\d*$/.test(page) ? Number(page) : 1,
  };
}

/** Write a query as URL parameters ("?q=...&category=...&sort=...&page=..."), leaving out defaults. Empty when all defaults. */
export function serializeListQuery(query: ListQuery): string {
  const params = new URLSearchParams();
  if (query.q !== '') params.set('q', query.q);
  if (query.category !== null) params.set('category', query.category);
  if (query.sort !== DEFAULT_LIST_QUERY.sort) params.set('sort', query.sort);
  if (query.page !== DEFAULT_LIST_QUERY.page) params.set('page', String(query.page));
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}

/** Apply a change. Changing search, Category or sort returns to page 1; an explicit page is kept. */
export function updateListQuery(query: ListQuery, patch: Partial<ListQuery>): ListQuery {
  return { ...query, page: 1, ...patch };
}

/** Search titles, filter by Category, sort, then take one page. */
export function listPosts<T extends Listable>(
  posts: readonly T[],
  query: ListQuery,
  options: { pageSize: number },
): Page<T> {
  const terms = fold(query.q).split(/\s+/).filter(Boolean);
  const matches = posts.filter(
    (post) =>
      (query.category === null || post.category.id === query.category) &&
      terms.every((term) => fold(post.title).includes(term)),
  );
  // Ties on date are broken by slug so pages never shuffle between builds.
  const direction = query.sort === 'oldest' ? 1 : -1;
  matches.sort((a, b) => direction * a.publishDate.localeCompare(b.publishDate) || a.slug.localeCompare(b.slug));
  return paginate(matches, { page: query.page, pageSize: options.pageSize });
}

/** Lowercase and strip accents, so "Café" and "cafe" match. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
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
