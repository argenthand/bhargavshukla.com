import { describe, expect, it } from 'vitest';
import { categorySchema, loadContent as loadContentAt, postSchema, type ContentInput, type RawEntry } from './index';

const now = new Date('2026-09-15T16:00:00Z'); // 12:00 in Toronto
const loadContent = (input: ContentInput, options: { now?: Date; includeDrafts?: boolean } = {}) =>
  loadContentAt(input, { now, ...options });

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

describe('visibility', () => {
  const visible = (posts: RawEntry[], options: { includeDrafts?: boolean } = {}) =>
    loadContent({ categories, posts }, options).posts.map((p) => p.slug);

  it('shows a Post whose Publish Date is today or earlier', () => {
    expect(visible([post('past', { publishDate: '2026-09-14' }), post('today', { publishDate: '2026-09-15' })]))
      .toEqual(['today', 'past']);
  });

  it('hides a Scheduled Post until its Publish Date', () => {
    expect(visible([post('later', { publishDate: '2026-09-16' }), post('now', { publishDate: '2026-09-15' })]))
      .toEqual(['now']);
  });

  it('hides Drafts in production', () => {
    expect(visible([post('wip', { draft: true }), post('done')])).toEqual(['done']);
  });

  it('keeps a Draft hidden after its Publish Date has passed', () => {
    expect(visible([post('old-wip', { draft: true, publishDate: '2020-01-01' })])).toEqual([]);
  });

  it('includes Drafts locally, flagged as Drafts', () => {
    const { posts } = loadContent(
      { categories, posts: [post('wip', { draft: true }), post('done')] },
      { includeDrafts: true },
    );
    expect(posts.map((p) => p.slug).sort()).toEqual(['done', 'wip']);
    expect(posts.find((p) => p.slug === 'wip')?.draft).toBe(true);
  });

  it('still hides Scheduled Posts locally, even Drafts with a future date', () => {
    expect(
      visible([post('later', { publishDate: '2026-12-01' }), post('later-wip', { publishDate: '2026-12-01', draft: true })], {
        includeDrafts: true,
      }),
    ).toEqual([]);
  });

  it('reads the Publish Date in America/Toronto: the day flips at Toronto midnight (summer, UTC-4)', () => {
    const at = (iso: string) =>
      loadContent({ categories, posts: [post('p', { publishDate: '2026-09-02' })] }, { now: new Date(iso) }).posts.length;
    expect(at('2026-09-02T03:59:59Z')).toBe(0); // 23:59:59 on Sep 1 in Toronto
    expect(at('2026-09-02T04:00:00Z')).toBe(1); // 00:00:00 on Sep 2 in Toronto
  });

  it('reads the Publish Date in America/Toronto: the day flips at Toronto midnight (winter, UTC-5)', () => {
    const at = (iso: string) =>
      loadContent({ categories, posts: [post('p', { publishDate: '2026-01-02' })] }, { now: new Date(iso) }).posts.length;
    expect(at('2026-01-02T04:59:59Z')).toBe(0);
    expect(at('2026-01-02T05:00:00Z')).toBe(1);
  });

  it('still validates hidden entries, so a broken Draft fails the build', () => {
    const broken = post('broken-wip', { draft: true });
    delete (broken.data as Record<string, unknown>).title;
    expect(() => loadContent({ categories, posts: [broken] })).toThrow(/Post "broken-wip"/);
  });
});

describe('reading time', () => {
  const minutes = (body: string) => loadContent({ categories, posts: [{ ...post('p'), body }] }).posts[0].readingTime;
  const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ');

  it('is at least one minute', () => {
    expect(minutes('Short.')).toBe(1);
  });

  it('rounds up at 200 words per minute', () => {
    expect(minutes(words(200))).toBe(1);
    expect(minutes(words(201))).toBe(2);
    expect(minutes(words(1000))).toBe(5);
  });
});

describe('Updated Date display', () => {
  const shown = (data: Record<string, unknown>) => loadContent({ categories, posts: [post('p', data)] }).posts[0].updatedDateToShow;

  it('is hidden when there is no Updated Date', () => {
    expect(shown({})).toBeNull();
  });

  it('is hidden when the Updated Date equals the Publish Date', () => {
    expect(shown({ updatedDate: '2026-09-01' })).toBeNull();
  });

  it('is hidden when the Updated Date is earlier than the Publish Date', () => {
    expect(shown({ updatedDate: '2026-08-01' })).toBeNull();
  });

  it('is shown when the Updated Date is later than the Publish Date', () => {
    expect(shown({ updatedDate: '2026-09-10' })).toBe('2026-09-10');
  });
});

describe('Book Reviews', () => {
  const review = (data: Record<string, unknown> = {}) =>
    post('review', { category: 'books', bookTitle: 'High Output Management', bookAuthor: 'Andrew Grove', ...data });

  it('loads a Post in the Books Category with its book title and author', () => {
    const { posts } = loadContent({ categories, posts: [review()] });
    expect(posts[0]).toMatchObject({ bookTitle: 'High Output Management', bookAuthor: 'Andrew Grove' });
  });

  it.each(['bookTitle', 'bookAuthor'])('fails naming the Post when %s is missing', (field) => {
    const entry = review();
    delete (entry.data as Record<string, unknown>)[field];
    expect(() => loadContent({ categories, posts: [entry] })).toThrow(new RegExp(`Post "review".*${field}`, 's'));
  });

  it('rejects book fields on a Post outside the Books Category', () => {
    expect(() => loadContent({ categories, posts: [post('plain', { bookTitle: 'A Book' })] })).toThrow(
      /Post "plain".*Books Category/s,
    );
  });

  it('does not require a book for other Categories', () => {
    const { posts } = loadContent({ categories, posts: [post('plain')] });
    expect(posts[0].bookTitle).toBeNull();
    expect(posts[0].bookAuthor).toBeNull();
  });
});

describe('image alt text', () => {
  const withBody = (body: string) => () => loadContent({ categories, posts: [{ ...post('pic'), body }] });

  it('accepts images with alt text', () => {
    expect(withBody('![A diagram of a team](/a.png)')).not.toThrow();
    expect(withBody('<img src="/a.png" alt="A diagram">')).not.toThrow();
  });

  it('fails naming the Post when a Markdown image has empty alt text', () => {
    expect(withBody('Text\n\n![](/a.png)')).toThrow(/Post "pic".*"\/a\.png".*alt text/s);
    expect(withBody('![   ](/a.png)')).toThrow(/Post "pic".*alt text/s);
  });

  it('fails naming the Post when an HTML image has no alt attribute', () => {
    expect(withBody('<img src="/a.png">')).toThrow(/Post "pic".*alt text/s);
    expect(withBody('<img src="/a.png" alt="">')).toThrow(/Post "pic".*alt text/s);
  });

  it('ignores image syntax in indented code fences and double-backtick inline code', () => {
    expect(withBody('- item\n\n  ```md\n  ![](/a.png)\n  ```')).not.toThrow();
    expect(withBody('Use ``![](/a.png)`` for images.')).not.toThrow();
  });

  it('ignores image syntax inside code blocks', () => {
    expect(withBody('```md\n![](/a.png)\n```')).not.toThrow();
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
