import { describe, expect, it } from 'vitest';
import { categorySchema, loadContent, postSchema, type RawEntry } from './index';

const category = (id: string, name = id): RawEntry => ({ id, data: { name }, body: '' });

const post = (id: string, data: Record<string, unknown> = {}): RawEntry => ({
  id,
  body: 'Body text.',
  data: {
    title: `Title of ${id}`,
    slug: id,
    summary: 'A short summary.',
    category: 'leadership',
    publishDate: '2026-09-01',
    ...data,
  },
});

const categories = [category('leadership', 'Leadership'), category('books', 'Books')];

describe('loadContent', () => {
  it('loads a valid Post with its Category and applies defaults', () => {
    const { posts } = loadContent({ categories, posts: [post('first')] });

    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      id: 'first',
      title: 'Title of first',
      slug: 'first',
      summary: 'A short summary.',
      category: { id: 'leadership', name: 'Leadership' },
      publishDate: '2026-09-01',
      draft: false,
      featured: false,
    });
    expect(posts[0].updatedDate).toBeNull();
  });

  it('orders Posts newest first by Publish Date', () => {
    const { posts } = loadContent({
      categories,
      posts: [
        post('old', { publishDate: '2026-01-05' }),
        post('new', { publishDate: '2026-09-01' }),
        post('mid', { publishDate: '2026-05-20' }),
      ],
    });

    expect(posts.map((p) => p.slug)).toEqual(['new', 'mid', 'old']);
  });

  it('accepts a Publish Date parsed from unquoted YAML as a Date', () => {
    const { posts } = loadContent({
      categories,
      posts: [post('yaml', { publishDate: new Date('2026-09-01T00:00:00.000Z') })],
    });

    expect(posts[0].publishDate).toBe('2026-09-01');
  });

  it.each(['title', 'slug', 'summary', 'category', 'publishDate'])(
    'fails the build naming the Post when %s is missing',
    (field) => {
      const entry = post('broken-post');
      delete (entry.data as Record<string, unknown>)[field];

      expect(() => loadContent({ categories, posts: [entry] })).toThrow(
        new RegExp(`Post "broken-post".*${field}`, 's'),
      );
    },
  );

  it('fails naming the Post when the body is empty', () => {
    const entry = { ...post('empty-post'), body: '   ' };

    expect(() => loadContent({ categories, posts: [entry] })).toThrow(
      /Post "empty-post".*body/s,
    );
  });

  it('fails naming the Post when its Category does not exist', () => {
    expect(() =>
      loadContent({ categories, posts: [post('lost', { category: 'nope' })] }),
    ).toThrow(/Post "lost".*Category "nope"/s);
  });

  it('fails naming the Post when the Publish Date is not a calendar date', () => {
    expect(() =>
      loadContent({ categories, posts: [post('bad-date', { publishDate: '2026-13-40' })] }),
    ).toThrow(/Post "bad-date".*publishDate/s);
  });

  it('fails naming the Category when its name is missing', () => {
    expect(() =>
      loadContent({ categories: [{ id: 'nameless', data: {}, body: '' }], posts: [] }),
    ).toThrow(/Category "nameless".*name/s);
  });

  it('fails when two Posts share a slug', () => {
    expect(() =>
      loadContent({
        categories,
        posts: [post('a', { slug: 'same' }), post('b', { slug: 'same' })],
      }),
    ).toThrow(/slug "same".*"a".*"b"/s);
  });

  it('rejects unknown fields so schema drift is caught', () => {
    expect(() =>
      loadContent({ categories, posts: [post('extra', { colour: 'red' })] }),
    ).toThrow(/Post "extra".*colour/s);
  });
});

describe('schema rule: every field is required with no default, or optional with a default', () => {
  it.each([
    ['Post', postSchema],
    ['Category', categorySchema],
  ])('holds for every field of %s', (_name, schema) => {
    for (const [field, rule] of Object.entries(schema.shape)) {
      const whenAbsent = rule.safeParse(undefined);
      // Required fields reject a missing value; optional fields must supply a default.
      const ok = !whenAbsent.success || whenAbsent.data !== undefined;
      expect(ok, `${field} is optional without a default`).toBe(true);
    }
  });
});
