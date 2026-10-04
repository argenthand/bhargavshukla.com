import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import {
	EDGE_CACHE_CONTROL,
	bypass,
	edgeCache,
	etagFor,
	isCacheable,
	isCacheableData,
	shouldBypass,
	withCacheHeaders
} from './edge-cache';

/** Like SvelteKit, `event.url` drops `/__data.json` and its params; the request keeps them. */
function event(method: string, path: string, cookies: Record<string, string> = {}) {
	const url = new URL(`https://b.com${path}`);
	url.pathname = url.pathname.replace(/\/__data\.json$/, '') || '/';
	url.searchParams.delete('x-sveltekit-invalidated');
	return {
		request: new Request(`https://b.com${path}`, { method }),
		url,
		cookies: { get: (name: string) => cookies[name] }
	};
}

describe('shouldBypass', () => {
	it('bypasses non-GET/HEAD requests, /api/ and previews', () => {
		expect(shouldBypass(event('GET', '/blog') as never)).toBe(false);
		expect(shouldBypass(event('HEAD', '/blog') as never)).toBe(false);
		expect(shouldBypass(event('POST', '/blog') as never)).toBe(true);
		expect(shouldBypass(event('GET', '/api/purge') as never)).toBe(true);
		expect(shouldBypass(event('GET', '/blog', { __preview: '1' }) as never)).toBe(true);
	});
});

describe('isCacheable', () => {
	const tags = new Set(['type:post']);
	it('needs a 200 with at least one tag', () => {
		expect(isCacheable(new Response('ok'), tags)).toBe(true);
		expect(isCacheable(new Response('ok'), new Set())).toBe(false);
		expect(isCacheable(new Response('no', { status: 404 }), tags)).toBe(false);
		expect(isCacheable(new Response('no', { status: 502 }), tags)).toBe(false);
	});

	it('never stores cookies or a page that opted out', () => {
		expect(isCacheable(new Response('ok', { headers: { 'set-cookie': 'a=1' } }), tags)).toBe(false);
		expect(
			isCacheable(new Response('ok', { headers: { 'cache-control': 'no-store' } }), tags)
		).toBe(false);
	});
});

describe('isCacheableData', () => {
	const tags = new Set(['type:post']);
	const json = (body: string, status = 200) =>
		isCacheableData(
			new Response(body, { status, headers: { 'content-type': 'application/json' } }),
			body,
			tags
		);

	it('keeps a data answer whose nodes hold no error', () => {
		expect(json('{"type":"data","nodes":[{"type":"skip"},{"type":"data","data":[]}]}')).toBe(true);
		expect(json('{"type":"data","nodes":[null,{"type":"data","data":[]}]}')).toBe(true);
	});

	it('never keeps errors, redirects, streams or unparseable bodies', () => {
		expect(json('{"type":"data","nodes":[{"type":"data"},{"type":"error","status":404}]}')).toBe(
			false
		);
		expect(json('{"type":"redirect","location":"/"}')).toBe(false);
		expect(json('{"type":"error"}', 500)).toBe(false);
		expect(json('<!doctype html>')).toBe(false);
		const body = '{"type":"data","nodes":[]}';
		const stream = new Response(body, { headers: { 'content-type': 'text/sveltekit-data' } });
		expect(isCacheableData(stream, body, tags)).toBe(false);
		expect(isCacheableData(new Response(body), body, new Set())).toBe(false);
	});
});

describe('withCacheHeaders', () => {
	const tags = new Set(['type:post', 'type:category']);

	it('lets Cloudflare keep a cacheable page, tagged and varied on Cookie; browsers revalidate', () => {
		const res = withCacheHeaders(new Response('<h1>post</h1>'), tags, true);
		expect(res.headers.get('cloudflare-cdn-cache-control')).toBe(EDGE_CACHE_CONTROL);
		expect(EDGE_CACHE_CONTROL).toBe('max-age=86400, stale-while-revalidate=604800');
		expect(res.headers.get('cache-tag')).toBe('type:post,type:category');
		expect(res.headers.get('vary')).toBe('Cookie');
		expect(res.headers.get('cache-control')).toBe('no-cache');
	});

	it('keeps an existing Vary', () => {
		const res = withCacheHeaders(
			new Response('ok', { headers: { vary: 'Accept-Encoding' } }),
			tags,
			true
		);
		expect(res.headers.get('vary')).toBe('Accept-Encoding, Cookie');
	});

	it('dates a cacheable response with Last-Modified (#126), and nothing else', () => {
		const when = new Date('2026-10-04T18:00:00Z');
		const kept = withCacheHeaders(new Response('ok'), tags, true, () => when);
		expect(kept.headers.get('last-modified')).toBe('Sun, 04 Oct 2026 18:00:00 GMT');
		const own = new Response('ok', {
			headers: { 'last-modified': 'Thu, 01 Oct 2026 00:00:00 GMT' }
		});
		expect(withCacheHeaders(own, tags, true).headers.get('last-modified')).toBe(
			'Thu, 01 Oct 2026 00:00:00 GMT'
		);
		expect(withCacheHeaders(new Response('no'), tags, false).headers.has('last-modified')).toBe(
			false
		);
	});

	it('tells Cloudflare never to store anything else', () => {
		const res = withCacheHeaders(
			new Response('nope', { status: 404, headers: { 'cache-tag': 'type:post' } }),
			tags,
			false
		);
		expect(res.headers.get('cloudflare-cdn-cache-control')).toBe('no-store');
		expect(res.headers.get('cache-tag')).toBeNull();
		expect(res.headers.get('cache-control')).toBe('no-cache');
	});
});

describe('etagFor (#126)', () => {
	it('is a quoted hash that changes with the body', () => {
		expect(etagFor('{"type":"data"}')).toMatch(/^"[0-9a-z]+"$/);
		expect(etagFor('a')).toBe(etagFor('a'));
		expect(etagFor('a')).not.toBe(etagFor('b'));
	});
});

describe('bypass', () => {
	it('keeps a response that asked to be public, as /api/views does', () => {
		const res = bypass(new Response('{}', { headers: { 'cache-control': 'public, max-age=60' } }));
		expect(res.headers.get('cloudflare-cdn-cache-control')).toBeNull();
	});

	it('stops the two-hour heuristic for everything else', () => {
		expect(bypass(new Response('ok')).headers.get('cloudflare-cdn-cache-control')).toBe('no-store');
		const preview = new Response('draft', { headers: { 'cache-control': 'private, no-store' } });
		expect(bypass(preview).headers.get('cloudflare-cdn-cache-control')).toBe('no-store');
	});
});

describe('edgeCache', () => {
	const run = (
		method: string,
		path: string,
		page: () => Response,
		{ tags = ['type:post'], cookies = {}, noStore = false } = {}
	) =>
		edgeCache({
			event: {
				...event(method, path, cookies),
				isDataRequest: path.includes('/__data.json'),
				locals: { cacheTags: new Set(tags), noStore }
			} as unknown as RequestEvent,
			resolve: async () => page()
		});

	it('marks a page cacheable', async () => {
		const res = await run('GET', '/blog/a', () => new Response('<h1>post</h1>'));
		expect(res.headers.get('cloudflare-cdn-cache-control')).toBe(EDGE_CACHE_CONTROL);
		expect(await res.text()).toBe('<h1>post</h1>');
	});

	it('marks page data cacheable despite SvelteKit’s private, no-store (#108)', async () => {
		const data = '{"type":"data","nodes":[{"type":"data","data":[]}]}';
		const res = await run(
			'GET',
			'/blog/__data.json?x-sveltekit-invalidated=01',
			() =>
				new Response(data, {
					headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' }
				})
		);
		expect(res.headers.get('cloudflare-cdn-cache-control')).toBe(EDGE_CACHE_CONTROL);
		expect(res.headers.get('cache-control')).toBe('no-cache');
		expect(res.headers.get('etag')).toBe(etagFor(data));
		expect(await res.text()).toBe(data);
	});

	it('gives page data with an error no ETag (#126)', async () => {
		const data = '{"type":"data","nodes":[{"type":"error","status":404}]}';
		const res = await run(
			'GET',
			'/blog/x/__data.json?x-sveltekit-invalidated=01',
			() => new Response(data, { headers: { 'content-type': 'application/json' } })
		);
		expect(res.headers.has('etag')).toBe(false);
	});

	it('never stores errors, untagged pages or a load that opted out', async () => {
		const notFound = await run('GET', '/blog/x', () => new Response('nope', { status: 404 }));
		expect(notFound.headers.get('cloudflare-cdn-cache-control')).toBe('no-store');
		const untagged = await run('GET', '/', () => new Response('static'), { tags: [] });
		expect(untagged.headers.get('cloudflare-cdn-cache-control')).toBe('no-store');
		const optedOut = await run('GET', '/', () => new Response('home'), { noStore: true });
		expect(optedOut.headers.get('cloudflare-cdn-cache-control')).toBe('no-store');
	});

	it('never stores a preview', async () => {
		const res = await run('GET', '/blog/a', () => new Response('draft'), {
			cookies: { __preview: 'x' }
		});
		expect(res.headers.get('cloudflare-cdn-cache-control')).toBe('no-store');
		expect(res.headers.get('cache-tag')).toBeNull();
	});
});
