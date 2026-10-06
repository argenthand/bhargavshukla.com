import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { STRAPI_URL: 'http://cms.test/', STRAPI_TOKEN: 'secret' }
}));

const { buildUrl, mediaUrl, strapi } = await import('./strapi');

describe('buildUrl', () => {
	it('maps the content type to its REST path and trims the base slash', () => {
		expect(buildUrl('http://cms.test/', 'post')).toBe('http://cms.test/api/posts');
	});

	it('encodes filters, populate and sort with qs brackets', () => {
		const url = new URL(
			buildUrl('http://cms.test', 'post', {
				filters: { slug: { $eq: 'hello world' } },
				populate: { category: { fields: ['name'] } },
				sort: ['publishedAt:desc']
			})
		);
		expect(url.pathname).toBe('/api/posts');
		expect(url.searchParams.get('filters[slug][$eq]')).toBe('hello world');
		expect(url.searchParams.get('populate[category][fields][0]')).toBe('name');
		expect(url.searchParams.get('sort[0]')).toBe('publishedAt:desc');
	});
});

describe('mediaUrl', () => {
	it('keeps absolute URLs (R2) and prefixes relative ones (local uploads)', () => {
		expect(mediaUrl('https://media.bhargavshukla.com/a.jpg')).toBe(
			'https://media.bhargavshukla.com/a.jpg'
		);
		expect(mediaUrl('/uploads/a.jpg')).toBe('http://cms.test/uploads/a.jpg');
	});
});

describe('strapi(locals)', () => {
	const page = (data: unknown[], pageCount = 1, pageNo = 1) =>
		new Response(
			JSON.stringify({
				data,
				meta: { pagination: { page: pageNo, pageSize: 100, pageCount, total: 0 } }
			})
		);

	it('sends the token and records cache tags', async () => {
		const locals = { cacheTags: new Set<string>(), preview: false };
		const fetcher = vi.fn(async () => page([{ slug: 'a' }]));
		const res = await strapi(locals, fetcher).find('post', {
			populate: { category: { fields: ['name'] } }
		});

		expect(res.data).toEqual([{ slug: 'a' }]);
		expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('http://cms.test/api/posts?'), {
			headers: { Authorization: 'Bearer secret' }
		});
		expect([...locals.cacheTags]).toEqual(['type:post', 'type:category']);
	});

	it('reads every page in findAll', async () => {
		const locals = { cacheTags: new Set<string>(), preview: false };
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(page([1, 2], 2, 1))
			.mockResolvedValueOnce(page([3], 2, 2));
		expect(await strapi(locals, fetcher).findAll('post')).toEqual([1, 2, 3]);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('turns a Strapi error into a 502', async () => {
		const locals = { cacheTags: new Set<string>(), preview: false };
		const fetcher = vi.fn(async () => new Response('nope', { status: 403 }));
		await expect(strapi(locals, fetcher).find('post')).rejects.toMatchObject({ status: 502 });
	});

	it('reads a single type, and returns undefined before it is saved', async () => {
		const locals = { cacheTags: new Set<string>(), preview: false };
		const found = vi.fn(async () => new Response(JSON.stringify({ data: { name: 'B' } })));
		expect(await strapi(locals, found).get('profile')).toEqual({ name: 'B' });
		expect(found).toHaveBeenCalledWith('http://cms.test/api/profile', expect.anything());
		expect([...locals.cacheTags]).toEqual(['type:profile']);

		const missing = vi.fn(async () => new Response('{}', { status: 404 }));
		expect(await strapi(locals, missing).get('profile')).toBeUndefined();
	});
});
