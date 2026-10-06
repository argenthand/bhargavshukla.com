// The post, aside and resume queries against a fake Strapi client: what is asked for, how drafts
// merge in preview, and the shape each page gets back.

import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: { STRAPI_URL: 'https://cms.test' } }));

type Doc = Record<string, unknown> & { documentId: string; slug?: string };
type Query = {
	status?: string;
	filters?: { slug?: { $eq: string }; documentId?: { $eq: string } };
};

/** A Strapi with a published list and a drafts list; `find` filters by slug or document. */
const store = { published: [] as Doc[], drafts: [] as Doc[], single: undefined as unknown };
const calls: { method: string; type: string; query: Query }[] = [];

const listFor = (query: Query) => (query.status === 'draft' ? store.drafts : store.published);
const client = {
	findAll: vi.fn(async (type: string, query: Query = {}) => {
		calls.push({ method: 'findAll', type, query });
		return [...listFor(query)];
	}),
	find: vi.fn(async (type: string, query: Query = {}) => {
		calls.push({ method: 'find', type, query });
		const { slug, documentId } = query.filters ?? {};
		const data = listFor(query).filter(
			(doc) =>
				(!slug || doc.slug === slug.$eq) && (!documentId || doc.documentId === documentId.$eq)
		);
		return { data: data.slice(0, 1) };
	}),
	get: vi.fn(async (type: string, query: Query = {}) => {
		calls.push({ method: 'get', type, query });
		return store.single;
	})
};
vi.mock('../../server/strapi', async (original) => ({
	...(await original<typeof import('../../server/strapi')>()),
	strapi: () => client
}));

const { getPost, homePosts, listPosts, postPage } = await import('../../server/posts');
const { getAside, listAsides } = await import('../../server/asides');
const { getResume } = await import('../../server/resume');

const locals = {} as App.Locals;

function reset(published: Doc[] = [], drafts: Doc[] = [], single?: unknown) {
	Object.assign(store, { published, drafts, single });
	calls.length = 0;
}

const post = (slug: string, publishedAt: string, extra: Doc | object = {}): Doc => ({
	documentId: `doc-${slug}`,
	slug,
	title: slug,
	summary: `About ${slug}`,
	publishedAt,
	updatedAt: publishedAt,
	...extra
});

describe('listPosts', () => {
	it('lists published posts, newest by the date readers see first', async () => {
		reset([
			post('old', '2026-01-01T00:00:00.000Z'),
			post('backdated', '2026-03-01T00:00:00.000Z', { displayDate: '2025-06-01' }),
			post('new', '2026-02-01T00:00:00.000Z')
		]);
		expect((await listPosts(locals)).map((p) => p.slug)).toEqual(['new', 'old', 'backdated']);
		expect(calls.map((c) => c.query.status)).toEqual([undefined]); // no drafts asked for
	});

	it('passes the filters on to Strapi', async () => {
		reset([post('a', '2026-01-01T00:00:00.000Z')]);
		await listPosts(locals, { featured: { $eq: true } });
		expect(calls[0].query).toMatchObject({ filters: { featured: { $eq: true } } });
	});

	it('shows the latest draft of every post in preview, marking the unpublished ones', async () => {
		reset(
			[post('live', '2026-01-01T00:00:00.000Z')],
			[
				post('live', '2026-01-01T00:00:00.000Z', { title: 'live (edited)' }),
				post('wip', '2026-02-01T00:00:00.000Z', {
					publishedAt: null,
					updatedAt: '2026-02-05T00:00:00.000Z'
				})
			]
		);
		const posts = await listPosts(locals, {}, { drafts: true });
		expect(posts.map((p) => [p.slug, p.draft])).toEqual([
			['wip', true],
			['live', false]
		]);
		expect(posts.find((p) => p.slug === 'live')?.title).toBe('live (edited)');
	});
});

describe('getPost', () => {
	it('finds a published post by slug', async () => {
		reset([post('a', '2026-01-01T00:00:00.000Z')]);
		expect((await getPost(locals, 'a'))?.slug).toBe('a');
		expect(await getPost(locals, 'missing')).toBeUndefined();
	});

	it('in preview finds the draft, keeping the publish date of its live version', async () => {
		reset(
			[post('a', '2026-01-01T00:00:00.000Z', { title: 'live' })],
			[post('a-renamed', '2026-01-09T00:00:00.000Z', { documentId: 'doc-a', title: 'edited' })]
		);
		const found = await getPost(locals, 'a-renamed', { drafts: true });
		expect(found).toMatchObject({
			title: 'edited',
			publishedAt: '2026-01-01T00:00:00.000Z',
			draft: false
		});
	});

	it('in preview marks a post that was never published as a draft', async () => {
		reset([], [post('wip', '2026-02-01T00:00:00.000Z', { publishedAt: null })]);
		expect(await getPost(locals, 'wip', { drafts: true })).toMatchObject({ draft: true });
	});

	it('in preview finds nothing for a slug that has no draft', async () => {
		reset([post('a', '2026-01-01T00:00:00.000Z')], []);
		expect(await getPost(locals, 'a', { drafts: true })).toBeUndefined();
	});
});

describe('homePosts', () => {
	const posts = (featured: string[]) =>
		['a', 'b', 'c', 'd', 'e'].map((slug, i) =>
			post(slug, `2026-01-0${5 - i}T00:00:00.000Z`, { featured: featured.includes(slug) })
		);

	it('shows up to three featured posts', async () => {
		reset(posts(['b', 'c', 'd', 'e']));
		const home = await homePosts(locals);
		expect(home.heading).toBe('Featured');
		expect(home.posts.map((p) => p.slug)).toEqual(['b', 'c', 'd']);
	});

	it('shows the three newest, headed Latest, while none is featured', async () => {
		reset(posts([]));
		const home = await homePosts(locals);
		expect(home.heading).toBe('Latest');
		expect(home.posts.map((p) => p.slug)).toEqual(['a', 'b', 'c']);
	});
});

describe('postPage', () => {
	const base = post('a', '2026-01-01T00:00:00.000Z') as never;

	it('keeps only what the page shows', () => {
		const page = postPage({ ...(base as object), body: 'secret', documentId: 'x' } as never);
		expect(Object.keys(page).sort()).toEqual(
			[
				'category',
				'cover',
				'displayDate',
				'draft',
				'publishedAt',
				'seo',
				'slug',
				'summary',
				'title',
				'updatedAt'
			].sort()
		);
	});

	it('falls back to the title and summary when the author left the SEO fields empty', () => {
		const { seo } = postPage({
			...(base as object),
			seo: { metaTitle: '', metaDescription: null }
		} as never);
		expect(seo).toMatchObject({ title: 'a', description: 'About a', canonical: null });
		expect(postPage(base).seo.title).toBe('a');
	});

	it('uses the SEO fields the author wrote, and a Media URL for the share image', () => {
		const { seo } = postPage({
			...(base as object),
			seo: {
				metaTitle: 'Better title',
				metaDescription: 'Better description',
				canonicalUrl: 'https://elsewhere.test/a',
				ogImage: { url: '/uploads/og.png', width: 1200, height: 630 }
			}
		} as never);
		expect(seo).toMatchObject({
			title: 'Better title',
			description: 'Better description',
			canonical: 'https://elsewhere.test/a'
		});
		expect(seo.ogImage).toMatchObject({
			url: expect.stringContaining('/uploads/og.png'),
			width: 1200
		});
	});

	it('has no cover when the post has none', () => {
		expect(postPage(base).cover).toBeNull();
	});
});

const aside = (slug: string, publishedAt: string, extra: Doc | object = {}): Doc => ({
	documentId: `doc-${slug}`,
	slug,
	kind: 'tip',
	title: null,
	body: `Body of ${slug}.`,
	publishedAt,
	updatedAt: publishedAt,
	...extra
});

describe('listAsides', () => {
	it('renders each body to HTML, labels it, and gives it a tag list', async () => {
		reset([aside('a', '2026-01-01T00:00:00.000Z', { body: 'Some **bold** words.' })]);
		const [first] = await listAsides(locals);
		expect(first.html).toContain('<strong>bold</strong>');
		expect(first.label).toBe('Some bold words.');
		expect(first.tags).toEqual([]);
		expect('body' in first).toBe(false);
	});

	it('shows unpublished asides in preview, newest edit first', async () => {
		reset(
			[aside('live', '2026-01-01T00:00:00.000Z')],
			[
				aside('live', '2026-01-01T00:00:00.000Z'),
				aside('wip', '2026-02-01T00:00:00.000Z', {
					publishedAt: null,
					updatedAt: '2026-02-02T00:00:00.000Z'
				})
			]
		);
		const asides = await listAsides(locals, { drafts: true });
		expect(asides.map((a) => a.slug)).toEqual(['wip', 'live']);
	});
});

describe('getAside', () => {
	const stream = () =>
		reset([
			aside('c', '2026-03-01T00:00:00.000Z', { title: 'Third' }),
			aside('b', '2026-02-01T00:00:00.000Z', { title: 'Second' }),
			aside('a', '2026-01-01T00:00:00.000Z', { title: 'First' })
		]);

	it('has the neighbours in the stream: newer and older, by label', async () => {
		stream();
		const found = await getAside(locals, 'b');
		expect(found?.newer).toEqual({ slug: 'c', label: 'Third' });
		expect(found?.older).toEqual({ slug: 'a', label: 'First' });
	});

	it('has no newer neighbour at the top and no older one at the end', async () => {
		stream();
		expect((await getAside(locals, 'c'))?.newer).toBeUndefined();
		expect((await getAside(locals, 'a'))?.older).toBeUndefined();
	});

	it('is undefined for an aside that is not there', async () => {
		stream();
		expect(await getAside(locals, 'nope')).toBeUndefined();
	});

	it('describes a quote with who said it, and anything else with its first paragraph', async () => {
		reset([
			aside('q', '2026-02-01T00:00:00.000Z', {
				kind: 'quote',
				body: 'Make it work.',
				sourceAuthor: 'Kent Beck',
				sourceTitle: 'Tidy First?'
			}),
			aside('q2', '2026-01-02T00:00:00.000Z', {
				kind: 'quote',
				body: 'Anon.',
				sourceTitle: 'A Book'
			}),
			aside('t', '2026-01-01T00:00:00.000Z', { body: 'A tip.\n\nMore.' })
		]);
		expect((await getAside(locals, 'q'))?.description).toBe(
			'“Make it work.” — Kent Beck, Tidy First?'
		);
		expect((await getAside(locals, 'q2'))?.description).toBe('“Anon.” — A Book');
		const tip = await getAside(locals, 't');
		expect(tip?.description).toBe('A tip.');
		expect(tip?.text).toBe('A tip.');
	});

	it('finds an aside that only has a draft in preview', async () => {
		reset([], [aside('wip', '2026-02-01T00:00:00.000Z', { publishedAt: null })]);
		expect(await getAside(locals, 'wip')).toBeUndefined();
		expect((await getAside(locals, 'wip', { drafts: true }))?.aside.slug).toBe('wip');
	});
});

describe('getResume', () => {
	it('is undefined until a resume is saved', async () => {
		reset();
		expect(await getResume(locals)).toBeUndefined();
	});

	it('gives the page its sections, with experience grouped by employer', async () => {
		reset([], [], {
			location: 'Toronto',
			summary: 'Summary',
			updatedAt: '2026-01-01T00:00:00.000Z',
			experience: [
				{
					role: 'Engineer',
					company: 'Acme',
					location: 'Toronto',
					startDate: '2020-01-01',
					endDate: '2022-01-01',
					highlights: '- Built it'
				},
				{
					role: 'Lead',
					company: 'Acme',
					location: 'Toronto',
					startDate: '2022-01-01',
					endDate: null,
					highlights: null
				}
			],
			skillGroups: [{ name: 'Languages' }],
			education: [{ school: 'U' }],
			certifications: [{ name: 'C' }]
		});
		const resume = await getResume(locals);
		expect(resume?.employers).toHaveLength(1);
		expect(resume?.employers[0].roles.map((r) => r.role)).toEqual(['Lead', 'Engineer']);
		expect(resume).toMatchObject({
			location: 'Toronto',
			skillGroups: [{ name: 'Languages' }],
			education: [{ school: 'U' }],
			certifications: [{ name: 'C' }]
		});
	});

	it('has empty lists for sections the author has not filled in', async () => {
		reset([], [], { location: null, summary: '', updatedAt: '2026-01-01T00:00:00.000Z' });
		expect(await getResume(locals)).toMatchObject({
			employers: [],
			skillGroups: [],
			education: [],
			certifications: []
		});
	});

	it('asks for the draft only in preview', async () => {
		reset([], [], { updatedAt: '2026-01-01T00:00:00.000Z' });
		await getResume(locals);
		await getResume(locals, { drafts: true });
		expect(calls[0].query.status).toBeUndefined();
		expect(calls[1].query.status).toBe('draft');
	});
});
