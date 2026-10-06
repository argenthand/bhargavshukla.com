// Keeps the content map (#140) honest against the code and the CMS: every route's real reads must
// show exactly the content types `PAGES` declares, every route that shows content must be in
// `PAGES`, and content types, drafts and relations must match the CMS's own schemas.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { STRAPI_URL: 'https://cms.test', STRAPI_TOKEN: 'token' }
}));

const { CONTENT_TYPES, PAGES, RELATIONS, tagOf } = await import('../server/content-map');
type ContentType = import('../server/content-map').ContentType;

/** One entry with every field any content type has, so each load gets what it reads. */
const ENTRY = {
	id: 1,
	documentId: 'doc',
	slug: 'entry',
	title: 'Title',
	name: 'Name',
	summary: 'Summary',
	body: 'Body',
	content: 'Content',
	kind: 'tip',
	featured: true,
	displayDate: null,
	publishedAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-02T00:00:00.000Z',
	createdAt: '2026-01-01T00:00:00.000Z',
	category: { documentId: 'cat', name: 'Category', slug: 'category' },
	tags: [],
	related: [],
	cover: null,
	seo: null,
	tagline: 'Tagline',
	lead: 'Lead',
	bio: 'Bio',
	linkedin: null,
	github: null,
	photo: null,
	photoAlt: null,
	location: null,
	experience: [],
	skillGroups: [],
	education: [],
	certifications: []
};

/** A fake Strapi: one entry for a single type, a one-page list for anything else. */
vi.stubGlobal('fetch', async (input: string | URL | Request) => {
	const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url);
	const single = Object.values(CONTENT_TYPES).some(
		(t) => 'single' in t && url.pathname === `/api/${t.api}`
	);
	return Response.json(
		single
			? { data: ENTRY }
			: { data: [ENTRY], meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: 1 } } }
	);
});

const event = () => {
	const locals: App.Locals = { cacheTags: new Set(), preview: false };
	return { locals, url: new URL('https://site.test/'), setHeaders: () => {} };
};

type Run = (e: ReturnType<typeof event>) => Promise<unknown>;

const home = await import('../../../routes/+page.server');
const writing = await import('../../../routes/blog/+page.server');
const post = await import('../../../routes/blog/[slug]/+page.server');
const asides = await import('../../../routes/asides/+page.server');
const aside = await import('../../../routes/asides/[slug]/+page.server');
const resume = await import('../../../routes/resume/+page.server');
const privacy = await import('../../../routes/privacy/+page.server');
const rss = await import('../../../routes/rss.xml/+server');
const sitemap = await import('../../../routes/sitemap.xml/+server');
const { getProfile } = await import('$lib/content/server/profile');
const { getPost } = await import('$lib/content/server/posts');
const { getAside } = await import('$lib/content/server/asides');

/** Calls a load or GET with the parts of SvelteKit's event they use. */
const run =
	(fn: (e: never) => unknown, params: Record<string, string> = {}): Run =>
	async (e) =>
		fn({ ...e, params } as never);

/** Every route in PAGES, run as it runs in production. Share cards render with WebAssembly, so
 *  those run the reads their routes make. */
const ROUTES: Record<string, Run> = {
	'/': run(home.load),
	'/blog': run(writing.load),
	'/blog/[slug]': run(post.load, { slug: 'entry' }),
	'/asides': run(asides.load),
	'/asides/[slug]': run(aside.load, { slug: 'entry' }),
	'/resume': run(resume.load),
	'/privacy': run(privacy.load),
	'/rss.xml': run(rss.GET),
	'/sitemap.xml': run(sitemap.GET),
	'/og/default.png': ({ locals }) => getProfile(locals),
	'/og/blog/[slug].png': ({ locals }) =>
		Promise.all([getPost(locals, 'entry'), getProfile(locals)]),
	'/og/asides/[slug].png': ({ locals }) =>
		Promise.all([getAside(locals, 'entry'), getProfile(locals)])
};

describe('PAGES', () => {
	it('has a run for every declared route', () => {
		expect(Object.keys(ROUTES).sort()).toEqual(Object.keys(PAGES).sort());
	});

	it.each(Object.keys(PAGES))('%s reads exactly the content types it declares', async (route) => {
		const e = event();
		await ROUTES[route](e);
		expect([...e.locals.cacheTags].sort()).toEqual(PAGES[route].shows.map(tagOf).sort());
	});

	it('declares every route that shows content', () => {
		const root = 'src/routes';
		const found = new Set<string>();
		const walk = (dir: string) => {
			for (const entry of readdirSync(dir, { withFileTypes: true })) {
				const path = join(dir, entry.name);
				if (entry.isDirectory()) walk(path);
				else if (entry.name === '+page.svelte' || entry.name === '+server.ts') {
					const id = `/${relative(root, dir).split(sep).join('/')}`.replace(/\/$/, '') || '/';
					if (!id.startsWith('/api')) found.add(id);
				}
			}
		};
		walk(root);
		expect([...found].sort()).toEqual(Object.keys(PAGES).sort());
	});
});

describe('CONTENT_TYPES and RELATIONS match the CMS', () => {
	const schema = (type: string) =>
		JSON.parse(readFileSync(`cms/src/api/${type}/content-types/${type}/schema.json`, 'utf8')) as {
			kind: 'collectionType' | 'singleType';
			info: { singularName: string; pluralName: string };
			options?: { draftAndPublish?: boolean };
			attributes: Record<string, { type: string; target?: string }>;
		};

	it.each(Object.keys(CONTENT_TYPES) as ContentType[])('%s', (type) => {
		const s = schema(type);
		const info = CONTENT_TYPES[type];
		const single = s.kind === 'singleType';
		expect('single' in info && info.single).toBe(single || false);
		expect(info.api).toBe(single ? s.info.singularName : s.info.pluralName);
		expect(info.drafts).toBe(s.options?.draftAndPublish === true);
		const relations = Object.fromEntries(
			Object.entries(s.attributes)
				.filter(([, a]) => a.type === 'relation')
				.map(([key, a]) => [key, /^api::([a-z0-9-]+)\./.exec(a.target ?? '')?.[1]])
		);
		expect(RELATIONS[type] ?? {}).toEqual(relations);
	});
});
