// Every page's server load (#142), run against a fake Strapi: what each page shows when the CMS
// answers, has nothing saved, or is down (docs/caching.md → Degraded pages).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ dev: false }));
vi.mock('$env/dynamic/private', () => ({
	env: { STRAPI_URL: 'http://cms.test', STRAPI_TOKEN: 'secret' }
}));

const { pageActions } = await import('$lib/contact/server/contact');

type Answer = 'down' | 'missing' | unknown[] | Record<string, unknown>;
/** Strapi's answer per REST path (`posts`, `profile`…); anything not listed is an empty list. */
let answers: Record<string, Answer>;
let requested: URL[];

beforeEach(() => {
	answers = {};
	requested = [];
	vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.stubGlobal('fetch', async (input: string) => {
		const url = new URL(input);
		requested.push(url);
		const answer = answers[url.pathname.replace('/api/', '')] ?? [];
		if (answer === 'down') throw new TypeError('fetch failed');
		if (answer === 'missing') return new Response('{}', { status: 404 });
		const body = Array.isArray(answer)
			? { data: answer, meta: { pagination: { page: 1, pageCount: 1 } } }
			: { data: answer };
		return Response.json(body);
	});
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

/** What SvelteKit hands a load, as far as the loads read it. */
function event(params: Record<string, string> = {}, preview = false) {
	const locals: App.Locals = { cacheTags: new Set(), preview };
	return { locals, params, route: { id: '/' } };
}

type Load = (event: never) => Promise<Record<string, unknown> & { degraded: boolean }>;
const run = (load: unknown, e: ReturnType<typeof event>) => (load as Load)(e as never);

const post = {
	documentId: 'p1',
	title: 'Hello',
	slug: 'hello',
	summary: 'A summary.',
	body: '## Hi',
	publishedAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z',
	displayDate: null,
	category: null,
	related: [],
	cover: null,
	seo: null
};
const aside = {
	documentId: 'a1',
	kind: 'tip',
	title: 'A tip',
	slug: 'a-tip',
	body: 'Use the platform.',
	sourceAuthor: null,
	sourceTitle: null,
	sourceUrl: null,
	publishedAt: '2026-01-01T00:00:00.000Z',
	tags: []
};
const profile = { name: 'Bhargav', tagline: 'Hi', bio: 'Bio.', linkedin: null, github: null };

describe('every page route', () => {
	const routes = import.meta.glob<{ actions?: unknown }>('./**/+page.server.ts', { eager: true });
	const pages = Object.keys(import.meta.glob('./**/+page.svelte'));

	it('has a server module for every page', () => {
		expect(pages.length).toBeGreaterThanOrEqual(6);
		expect(Object.keys(routes).sort()).toEqual(
			pages.map((p) => p.replace('+page.svelte', '+page.server.ts')).sort()
		);
	});

	// The contact card is on every page (#135), and without JavaScript it posts to the page it's
	// on, so a page without the action answers that visitor with a 405.
	it.each(Object.entries(routes))('%s exports the page actions', (_, mod) => {
		expect(mod.actions).toBe(pageActions);
	});
});

describe('home', async () => {
	const { load } = await import('./+page.server');

	it('shows the profile and posts', async () => {
		answers = { profile, posts: [post] };
		const data = await run(load, event());
		expect(data).toMatchObject({ profile: { name: 'Bhargav' }, degraded: false });
		expect(data.home).toMatchObject({ heading: 'Latest', posts: [{ slug: 'hello' }] });
	});

	it('is a normal page while the profile is unsaved (#142)', async () => {
		answers = { profile: 'missing' };
		const e = event();
		const data = await run(load, e);
		expect(data).toMatchObject({ profile: undefined, degraded: false });
		expect(e.locals.degraded).toBeUndefined();
	});

	it('degrades without Strapi: the name alone, no posts', async () => {
		answers = { profile: 'down', posts: 'down' };
		const e = event();
		const data = await run(load, e);
		expect(data).toMatchObject({ profile: undefined, home: { posts: [] }, degraded: true });
		expect(e.locals.degraded).toBe(true);
	});
});

describe('/blog', async () => {
	const { load } = await import('./blog/+page.server');

	it('lists posts, with drafts in preview', async () => {
		answers = { posts: [post] };
		const data = await run(load, event({}, true));
		expect(data).toMatchObject({ posts: [{ slug: 'hello' }], degraded: false });
		expect(requested.some((url) => url.searchParams.get('status') === 'draft')).toBe(true);
	});

	it('degrades to an empty list without Strapi', async () => {
		answers = { posts: 'down' };
		expect(await run(load, event())).toMatchObject({ posts: [], categories: [], degraded: true });
	});
});

describe('/blog/[slug]', async () => {
	const { load } = await import('./blog/[slug]/+page.server');

	it('shows the post with its SEO fallbacks and Next up', async () => {
		answers = { posts: [post] };
		const data = await run(load, event({ slug: 'hello' }));
		expect(data).toMatchObject({
			post: { slug: 'hello', seo: { title: 'Hello', description: 'A summary.', canonical: null } },
			degraded: false
		});
	});

	it('is a 404 for a post that isn’t there', async () => {
		await expect(run(load, event({ slug: 'nope' }))).rejects.toMatchObject({ status: 404 });
	});

	it('fails to the error page without the post', async () => {
		answers = { posts: 'down' };
		await expect(run(load, event({ slug: 'hello' }))).rejects.toThrow('fetch failed');
	});

	it('degrades to no Next up when only the other posts fail', async () => {
		let calls = 0;
		vi.stubGlobal('fetch', async () => {
			if (calls++ > 0) throw new TypeError('fetch failed');
			return Response.json({ data: [post], meta: { pagination: { page: 1, pageCount: 1 } } });
		});
		const e = event({ slug: 'hello' });
		expect(await run(load, e)).toMatchObject({
			post: { slug: 'hello' },
			nextUp: [],
			degraded: true
		});
		expect(e.locals.degraded).toBe(true);
	});
});

describe('/asides', async () => {
	const { load } = await import('./asides/+page.server');

	it('lists asides', async () => {
		answers = { asides: [aside] };
		expect(await run(load, event())).toMatchObject({
			asides: [{ slug: 'a-tip' }],
			degraded: false
		});
	});

	it('degrades to an empty list without Strapi', async () => {
		answers = { asides: 'down' };
		expect(await run(load, event())).toMatchObject({ asides: [], degraded: true });
	});
});

describe('/asides/[slug]', async () => {
	const { load } = await import('./asides/[slug]/+page.server');

	it('shows the aside', async () => {
		answers = { asides: [aside] };
		expect(await run(load, event({ slug: 'a-tip' }))).toMatchObject({
			aside: { slug: 'a-tip' },
			degraded: false
		});
	});

	it('is a 404 for an aside that isn’t there', async () => {
		await expect(run(load, event({ slug: 'nope' }))).rejects.toMatchObject({ status: 404 });
	});

	it('fails to the error page without Strapi', async () => {
		answers = { asides: 'down' };
		await expect(run(load, event({ slug: 'a' }))).rejects.toThrow('fetch failed');
	});
});

describe('/resume', async () => {
	const { load } = await import('./resume/+page.server');

	it('shows the empty state while the resume is unpublished (#91)', async () => {
		answers = { resume: 'missing', profile };
		expect(await run(load, event())).toMatchObject({ resume: null, degraded: false });
	});

	it('degrades without the resume, keeping the header', async () => {
		answers = { resume: 'down', profile };
		expect(await run(load, event())).toMatchObject({
			resume: null,
			profile: { name: 'Bhargav' },
			degraded: true
		});
	});

	it('degrades without the profile, keeping the resume', async () => {
		answers = {
			resume: { location: 'Here', summary: 'S', updatedAt: '2026-01-01', experience: [] },
			profile: 'down'
		};
		expect(await run(load, event())).toMatchObject({
			resume: { location: 'Here' },
			profile: undefined,
			degraded: true
		});
	});
});
