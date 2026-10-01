import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { cacheKey, edgeCache, isCacheable, shouldBypass, type PageCache } from './edge-cache';

describe('cacheKey', () => {
	it('lives under /__edge/ and keeps only the params that change the page, sorted', () => {
		expect(cacheKey(new URL('https://b.com/blog?utm_source=x&q=svelte&cat=tools&fbclid=1'))).toBe(
			'https://b.com/__edge/blog?cat=tools&q=svelte'
		);
		expect(cacheKey(new URL('https://b.com/asides?page=2&tag=git&kind='))).toBe(
			'https://b.com/__edge/asides?page=2&tag=git'
		);
		expect(cacheKey(new URL('https://b.com/blog/__data.json?x-sveltekit-invalidated=01'))).toBe(
			'https://b.com/__edge/blog/__data.json?x-sveltekit-invalidated=01'
		);
		expect(cacheKey(new URL('https://b.com/blog/post?ref=hn#top'))).toBe(
			'https://b.com/__edge/blog/post'
		);
	});
});

const event = (method: string, path: string, cookies: Record<string, string> = {}) => ({
	request: new Request(`https://b.com${path}`, { method }),
	url: new URL(`https://b.com${path}`),
	cookies: { get: (name: string) => cookies[name] }
});

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

describe('edgeCache', () => {
	function setup(page: () => Response, tags = ['type:post']) {
		const store = new Map<string, Response>();
		const cache: PageCache = {
			match: async (key) => store.get(key)?.clone(),
			put: async (key, response) => void store.set(key, response)
		};
		const pending: Promise<unknown>[] = [];
		const run = async (method: string, path: string) => {
			const e = {
				...event(method, path),
				locals: { cacheTags: new Set(tags) },
				platform: {
					caches: { default: cache },
					ctx: { waitUntil: (p: Promise<unknown>) => pending.push(p) }
				}
			} as unknown as RequestEvent;
			const response = await edgeCache({ event: e, resolve: async () => page() });
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
		const stored = store.get('https://b.com/__edge/blog/a')!;
		expect(stored.headers.get('cache-tag')).toBe('type:post,type:category');
		expect(stored.headers.get('cache-control')).toBe('public, max-age=600');

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
