import { describe, expect, it } from 'vitest';
import { loadContent as loadContentAt, snippetSchema, type ContentInput, type RawEntry } from './index';

const now = new Date('2026-09-15T16:00:00Z'); // 12:00 in Toronto
const load = (input: Partial<ContentInput>, options: { includeDrafts?: boolean } = {}) =>
  loadContentAt({ categories, posts: [], snippets: [], ...input }, { now, ...options });

const categories: RawEntry[] = [
  { id: 'engineering', data: { name: 'Engineering' } },
  { id: 'leadership', data: { name: 'Leadership' } },
];

const lines = (n: number) => Array.from({ length: n }, (_, i) => `const line${i + 1} = ${i + 1};`).join('\n');

const snippet = (id: string, data: Record<string, unknown> = {}): RawEntry => ({
  id,
  data: {
    title: `Snippet ${id}`,
    explanation: 'What it does.',
    code: 'const a = 1;\n',
    language: 'ts',
    category: 'engineering',
    publishDate: '2026-09-01',
    ...data,
  },
});

const slugs = (input: Partial<ContentInput>, options?: { includeDrafts?: boolean }) =>
  load(input, options).snippets.map((s) => s.id);

describe('Snippets', () => {
  it('loads a valid Snippet with its Category and applies defaults', () => {
    const { snippets } = load({ snippets: [snippet('first')] });
    expect(snippets).toHaveLength(1);
    expect(snippets[0]).toMatchObject({
      id: 'first',
      title: 'Snippet first',
      explanation: 'What it does.',
      code: 'const a = 1;\n',
      language: 'ts',
      category: { id: 'engineering', name: 'Engineering' },
      publishDate: '2026-09-01',
      updatedDate: null,
      updatedDateToShow: null,
      draft: false,
    });
  });

  it.each(['title', 'explanation', 'code', 'language', 'category', 'publishDate'])(
    'fails the build naming the Snippet when %s is missing',
    (field) => {
      const entry = snippet('broken-snippet');
      delete (entry.data as Record<string, unknown>)[field];
      expect(() => load({ snippets: [entry] })).toThrow(new RegExp(`Snippet "broken-snippet".*${field}`, 's'));
    },
  );

  it('fails naming the Snippet when the code is blank', () => {
    expect(() => load({ snippets: [snippet('blank', { code: '  \n' })] })).toThrow(/Snippet "blank".*code/s);
  });

  it('fails naming the Snippet when the Category does not exist', () => {
    expect(() => load({ snippets: [snippet('lost', { category: 'nope' })] })).toThrow(
      /Snippet "lost".*Category "nope"/s,
    );
  });

  it('fails naming the Snippet when the programming language is not one the site can highlight', () => {
    expect(() => load({ snippets: [snippet('odd', { language: 'klingon' })] })).toThrow(
      /Snippet "odd".*language.*klingon/s,
    );
    expect(() => load({ snippets: [snippet('proto', { language: 'constructor' })] })).toThrow(/Snippet "proto".*language/s);
    expect(() => load({ snippets: [snippet('plain', { language: 'text' })] })).not.toThrow();
  });

  it('has no Featured flag', () => {
    expect(() => load({ snippets: [snippet('star', { featured: true })] })).toThrow(/Snippet "star".*featured/s);
  });

  it('needs a file name that works as a link anchor', () => {
    expect(() => load({ snippets: [snippet('Not A Slug')] })).toThrow(/Snippet "Not A Slug".*anchor/s);
  });

  it('follows the schema rule: every field is required, or optional with a default', () => {
    for (const [field, rule] of Object.entries(snippetSchema.shape)) {
      const whenAbsent = rule.safeParse(undefined);
      expect(!whenAbsent.success || whenAbsent.data !== undefined, `${field} is optional without a default`).toBe(true);
    }
  });
});

describe('Snippet line count and collapsing', () => {
  const one = (code: string) => load({ snippets: [snippet('s', { code })] }).snippets[0];

  it('counts lines, ignoring the trailing newline', () => {
    expect(one('a').lineCount).toBe(1);
    expect(one('a\n').lineCount).toBe(1);
    expect(one('a\nb\nc\n').lineCount).toBe(3);
    expect(one('a\n\nc').lineCount).toBe(3);
  });

  it('collapses only Snippets longer than 15 lines', () => {
    expect(one(lines(15)).collapsedByDefault).toBe(false);
    expect(one(lines(16)).collapsedByDefault).toBe(true);
    expect(one(lines(3)).collapsedByDefault).toBe(false);
  });
});

describe('Snippet visibility and order', () => {
  it('lists Snippets newest first, breaking date ties by name', () => {
    expect(
      slugs({
        snippets: [
          snippet('b', { publishDate: '2026-05-01' }),
          snippet('c', { publishDate: '2026-08-01' }),
          snippet('a', { publishDate: '2026-05-01' }),
        ],
      }),
    ).toEqual(['c', 'a', 'b']);
  });

  it('hides Drafts and Scheduled Snippets in production, even a Draft with a past date', () => {
    expect(
      slugs({
        snippets: [
          snippet('live'),
          snippet('wip', { draft: true }),
          snippet('old-wip', { draft: true, publishDate: '2020-01-01' }),
          snippet('later', { publishDate: '2026-09-16' }),
        ],
      }),
    ).toEqual(['live']);
  });

  it('includes Drafts locally, flagged, but never Scheduled Snippets', () => {
    const { snippets } = load(
      { snippets: [snippet('live'), snippet('wip', { draft: true }), snippet('later', { publishDate: '2026-12-01' })] },
      { includeDrafts: true },
    );
    expect(snippets.map((s) => [s.id, s.draft]).sort()).toEqual([['live', false], ['wip', true]]);
  });

  it('reads the Publish Date in America/Toronto', () => {
    const at = (iso: string) =>
      loadContentAt(
        { categories, posts: [], snippets: [snippet('s', { publishDate: '2026-09-02' })] },
        { now: new Date(iso) },
      ).snippets.length;
    expect(at('2026-09-02T03:59:59Z')).toBe(0);
    expect(at('2026-09-02T04:00:00Z')).toBe(1);
  });

  it('shows the Updated Date only when later than the Publish Date', () => {
    const shown = (updatedDate: string) =>
      load({ snippets: [snippet('s', { updatedDate })] }).snippets[0].updatedDateToShow;
    expect(shown('2026-09-01')).toBeNull();
    expect(shown('2026-09-10')).toBe('2026-09-10');
  });

  it('still validates hidden Snippets, so a broken Draft fails the build', () => {
    const broken = snippet('broken-wip', { draft: true });
    delete (broken.data as Record<string, unknown>).title;
    expect(() => load({ snippets: [broken] })).toThrow(/Snippet "broken-wip"/);
  });
});
