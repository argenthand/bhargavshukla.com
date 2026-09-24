import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LIST_QUERY,
  listPosts,
  parseListQuery,
  serializeListQuery,
  updateListQuery,
  type ListQuery,
} from './index';

const post = (slug: string, title: string, publishDate: string, category: string) => ({
  slug,
  title,
  publishDate,
  category: { id: category },
});

const posts = [
  post('a', 'Leading a small team', '2026-09-01', 'leadership'),
  post('b', 'Reading The Manager’s Path', '2026-08-15', 'books'),
  post('c', 'Coaching engineers through change', '2026-08-15', 'leadership'),
  post('d', 'Café hours and deep work', '2026-07-01', 'engineering'),
  post('e', 'Small changes, big teams', '2026-06-01', 'engineering'),
];
const categoryIds = ['leadership', 'books', 'engineering'];
const query = (patch: Partial<ListQuery> = {}): ListQuery => ({ ...DEFAULT_LIST_QUERY, ...patch });
const slugs = (q: ListQuery, pageSize = 10) => listPosts(posts, q, { pageSize }).items.map((p) => p.slug);

describe('parseListQuery', () => {
  it('returns the defaults for an empty query string', () => {
    expect(parseListQuery('', { categoryIds })).toEqual({ q: '', category: null, sort: 'newest', page: 1 });
  });

  it('reads every parameter, with or without a leading "?", from a string or URLSearchParams', () => {
    const expected = { q: 'team', category: 'books', sort: 'oldest', page: 2 };
    const raw = 'q=team&category=books&sort=oldest&page=2';
    expect(parseListQuery(`?${raw}`, { categoryIds })).toEqual(expected);
    expect(parseListQuery(raw, { categoryIds })).toEqual(expected);
    expect(parseListQuery(new URLSearchParams(raw), { categoryIds })).toEqual(expected);
  });

  it('trims the search text', () => {
    expect(parseListQuery('q=%20%20team%20', { categoryIds }).q).toBe('team');
  });

  it('drops a Category that is not in the fixed list', () => {
    expect(parseListQuery('category=nope', { categoryIds }).category).toBeNull();
  });

  it('falls back to newest for an unknown sort', () => {
    expect(parseListQuery('sort=random', { categoryIds }).sort).toBe('newest');
  });

  it.each(['0', '-3', 'abc', '2.5', ''])('falls back to page 1 for page=%j', (page) => {
    expect(parseListQuery(`page=${page}`, { categoryIds }).page).toBe(1);
  });
});

describe('serializeListQuery', () => {
  it('is empty for the defaults, so the plain URL stays clean', () => {
    expect(serializeListQuery(DEFAULT_LIST_QUERY)).toBe('');
  });

  it('writes q, category, sort and page in that order, omitting defaults', () => {
    expect(serializeListQuery(query({ q: 'team', category: 'books', sort: 'oldest', page: 2 }))).toBe(
      '?q=team&category=books&sort=oldest&page=2',
    );
    expect(serializeListQuery(query({ sort: 'oldest' }))).toBe('?sort=oldest');
    expect(serializeListQuery(query({ page: 3 }))).toBe('?page=3');
  });

  it('encodes search text safely', () => {
    expect(serializeListQuery(query({ q: 'a&b=c d' }))).toBe('?q=a%26b%3Dc+d');
  });

  it.each([
    query(),
    query({ q: 'team' }),
    query({ q: 'a&b=c d é ✓', category: 'engineering', sort: 'oldest', page: 4 }),
    query({ page: 2 }),
  ])('round-trips through the URL: %j', (original) => {
    expect(parseListQuery(serializeListQuery(original), { categoryIds })).toEqual(original);
  });
});

describe('listPosts', () => {
  it('lists every Post newest first by default, breaking date ties by slug', () => {
    expect(slugs(query())).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('sorts oldest first', () => {
    expect(slugs(query({ sort: 'oldest' }))).toEqual(['e', 'd', 'b', 'c', 'a']);
  });

  it('searches titles, ignoring case', () => {
    expect(slugs(query({ q: 'TEAM' }))).toEqual(['a', 'e']);
  });

  it('requires every word of the search to match', () => {
    expect(slugs(query({ q: 'small team' }))).toEqual(['a', 'e']);
    expect(slugs(query({ q: 'small coaching' }))).toEqual([]);
  });

  it('ignores accents in the title and in the search', () => {
    expect(slugs(query({ q: 'cafe' }))).toEqual(['d']);
    expect(slugs(query({ q: 'CAFÉ' }))).toEqual(['d']);
  });

  it('searches across all pages, not just the current one', () => {
    const result = listPosts(posts, query({ q: 'team' }), { pageSize: 1 });
    expect(result.total).toBe(2);
    expect(result.pageCount).toBe(2);
    expect(listPosts(posts, query({ q: 'team', page: 2 }), { pageSize: 1 }).items.map((p) => p.slug)).toEqual(['e']);
  });

  it('filters by Category', () => {
    expect(slugs(query({ category: 'leadership' }))).toEqual(['a', 'c']);
  });

  it('combines search, Category and sort', () => {
    expect(slugs(query({ q: 'team', category: 'engineering' }))).toEqual(['e']);
    expect(slugs(query({ category: 'leadership', sort: 'oldest' }))).toEqual(['c', 'a']);
  });

  it('paginates the filtered results and clamps a page past the end', () => {
    const result = listPosts(posts, query({ category: 'leadership', page: 9 }), { pageSize: 1 });
    expect(result).toMatchObject({ page: 2, pageCount: 2, total: 2, firstItem: 2, lastItem: 2 });
  });

  it('returns an empty single page when nothing matches', () => {
    expect(listPosts(posts, query({ q: 'zzz' }), { pageSize: 10 })).toMatchObject({
      items: [],
      total: 0,
      pageCount: 1,
      page: 1,
      firstItem: 0,
      lastItem: 0,
    });
  });
});

describe('updateListQuery', () => {
  const onPageThree = query({ q: 'team', page: 3 });

  it.each([
    ['search', { q: 'coach' }],
    ['Category', { category: 'books' }],
    ['sort', { sort: 'oldest' as const }],
  ])('returns to page 1 when the %s changes', (_name, patch) => {
    expect(updateListQuery(onPageThree, patch).page).toBe(1);
  });

  it('keeps an explicit page change', () => {
    expect(updateListQuery(onPageThree, { page: 4 }).page).toBe(4);
  });

  it('keeps everything else as it was', () => {
    expect(updateListQuery(query({ q: 'team', sort: 'oldest' }), { category: 'books' })).toEqual({
      q: 'team',
      category: 'books',
      sort: 'oldest',
      page: 1,
    });
  });
});
