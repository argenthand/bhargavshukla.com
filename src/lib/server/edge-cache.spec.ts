import { version } from '$app/environment';
import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import {
	EDGE_TTL,
	cacheKey,
	isCacheableData,
	edgeCache,
	isCacheable,
	shouldBypass,
	type PageCache
} from './edge-cache';

describe('cacheKey', () => {
	const key = (url: string, build = 'v1') => cacheKey(new URL(url), build);

	it('lives under /__edge/<build>/ and keeps only the params that change the page, sorted', () => {
		expect(key('https://b.com/blog?utm_source=x&q=svelte&cat=tools&fbclid=1')).toBe(
			'https://b.com/__edge/v1/blog?cat=tools&q=svelte'
		);
		expect(key('https://b.com/asides?page=2&tag=git&kind=')).toBe(
			'https://b.com/__edge/v1/asides?page=2&tag=git'
		);
		expect(key('https://b.com/blog/__data.json?x-sveltekit-invalidated=01')).toBe(
			'https://b.com/__edge/v1/blog/__data.json?x-sveltekit-invalidated=01'
		);
		expect(key('https://b.com/blog/post?ref=hn#top')).toBe('https://b.com/__edge/v1/blog/post');
	});

	it('keeps a page, its data and each invalidation mask apart (#108)', () => {
		const keys = [
			key('https://b.com/blog'),
			key('https://b.com/blog/__data.json?x-sveltekit-invalidated=01'),
			key('https://b.com/blog/__data.json?x-sveltekit-invalidated=11')
		];
		expect(new Set(keys).size).toBe(3);
	});

	it('changes with every build', () => {
		expect(key('https://b.com/blog', 'v1')).not.toBe(key('https://b.com/blog', 'v2'));
	});
});

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

describe('edgeCache', () => {
	function setup(page: (event: RequestEvent) => Response, tags = ['type:post']) {
		const store = new Map<string, Response>();
		const cache: PageCache = {
			match: async (key) => store.get(key)?.clone(),
			put: async (key, response) => void store.set(key, response)
		};
		const pending: Promise<unknown>[] = [];
		const run = async (method: string, path: string, locals: Partial<App.Locals> = {}) => {
			const e = {
				...event(method, path),
				isDataRequest: path.includes('/__data.json'),
				locals: { cacheTags: new Set(tags), ...locals },
				platform: {
					caches: { default: cache },
					ctx: { waitUntil: (p: Promise<unknown>) => pending.push(p) }
				}
			} as unknown as RequestEvent;
			const response = await edgeCache({ event: e, resolve: async () => page(e) });
			await Promise.all(pending);
			return response;
		};
		return { store, run };
	}

	it('misses, stores with tags and TTL, then hits; browsers never see Cache-Tag', async () => {
		const resolve = vi.fn(
			() => new Response('<h1>post</h1>', { headers: { 'content-type': 'text/html' } })
		);
		const { store, run } = setup(resolve, ['type:post', 'type:category']);

		const first = await run('GET', '/blog/a?utm_source=x');
		expect(first.headers.get('x-edge-cache')).toBe('MISS');
		expect(first.headers.get('cache-tag')).toBeNull();
		expect(first.headers.get('cache-control')).toBe('no-cache');
		const [stored] = store.values();
		expect(stored.headers.get('cache-tag')).toBe('type:post,type:category');
		expect(stored.headers.get('cache-control')).toBe(`public, max-age=${EDGE_TTL}`);

		const second = await run('GET', '/blog/a');
		expect(second.headers.get('x-edge-cache')).toBe('HIT');
		expect(second.headers.get('cache-tag')).toBeNull();
		expect(await second.text()).toBe('<h1>post</h1>');
		expect(resolve).toHaveBeenCalledTimes(1);
	});

	it('does not store errors, untagged pages or HEAD responses', async () => {
		const notFound = setup(() => new Response('nope', { status: 404 }));
		await notFound.run('GET', '/blog/missing');
		expect(notFound.store.size).toBe(0);

		const untagged = setup(() => new Response('static'), []);
		await untagged.run('GET', '/');
		expect(untagged.store.size).toBe(0);

		const head = setup(() => new Response(null));
		await head.run('HEAD', '/blog/a');
		expect(head.store.size).toBe(0);
	});

	it('stores page data apart from its page, though SvelteKit strips event.url (#108)', async () => {
		const data = '{"type":"data","nodes":[{"type":"data","data":[]}]}';
		const { store, run } = setup((e) =>
			e.isDataRequest
				? // SvelteKit's own headers on __data.json.
					new Response(data, {
						headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' }
					})
				: new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } })
		);
		await run('GET', '/blog');
		const first = await run('GET', '/blog/__data.json?x-sveltekit-invalidated=01');
		expect(first.headers.get('x-edge-cache')).toBe('MISS');
		expect(await first.text()).toBe(data);
		expect([...store.keys()]).toContain(
			`https://b.com/__edge/${encodeURIComponent(version)}/blog/__data.json?x-sveltekit-invalidated=01`
		);
		const second = await run('GET', '/blog/__data.json?x-sveltekit-invalidated=01');
		expect(second.headers.get('x-edge-cache')).toBe('HIT');
		expect(await second.text()).toBe(data);
		expect(store.size).toBe(2); // the page's own entry is separate
	});

	it('stores nothing when a load opted out', async () => {
		const { store, run } = setup(() => new Response('<h1>home</h1>'));
		const res = await run('GET', '/', { noStore: true });
		expect(res.headers.get('x-edge-cache')).toBe('MISS');
		expect(store.size).toBe(0);
	});

	it('answers HEAD from the cache without a body', async () => {
		const { run } = setup(() => new Response('<h1>post</h1>'));
		await run('GET', '/blog/a');
		const head = await run('HEAD', '/blog/a');
		expect(head.headers.get('x-edge-cache')).toBe('HIT');
		expect(head.body).toBeNull();
	});

	it('bypasses /api/ entirely', async () => {
		const { store, run } = setup(() => new Response('ok'));
		const res = await run('GET', '/api/purge');
		expect(res.headers.get('x-edge-cache')).toBe('BYPASS');
		expect(store.size).toBe(0);
	});
});
