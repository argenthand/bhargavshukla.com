// Edge cache for rendered pages (#16, docs/caching.md). Pages go into Cloudflare's Cache API
// tagged with the content types they read (`Cache-Tag: type:post,…`); the Strapi webhook (#17)
// purges by tag, which works worldwide on the Free plan, unlike cache.delete().

import type { Handle, RequestEvent } from '@sveltejs/kit';

/** Seconds a page stays cached. It only bounds staleness if a purge fails (#17). */
export const EDGE_TTL = 600;

/**
 * Query params that change what the server renders; every other param is dropped from the key.
 * `page` for paging, the /blog and /asides filters (rendered on the server too), and SvelteKit's
 * own params on `__data.json`, which pick the loads that run during client-side navigation.
 */
const KEY_PARAMS = [
	'cat',
	'kind',
	'page',
	'q',
	'tag',
	'x-sveltekit-invalidated',
	'x-sveltekit-trailing-slash'
];

/** Cookie set by draft preview (backlog, #22); previews must never be cached or served cached. */
export const PREVIEW_COOKIE = '__preview';

/**
 * The Cache API key. It lives under /__edge/ on purpose: the adapter's own worker looks up the
 * raw request URL in caches.default before SvelteKit runs, and must never find (and serve,
 * Cache-Tag and all) one of these entries.
 */
export function cacheKey(url: URL): string {
	const key = new URL(`/__edge${url.pathname}`, url.origin);
	for (const name of KEY_PARAMS) {
		for (const value of url.searchParams.getAll(name)) {
			if (value !== '') key.searchParams.append(name, value);
		}
	}
	return key.href;
}

export function shouldBypass(event: Pick<RequestEvent, 'request' | 'url' | 'cookies'>): boolean {
	const { method } = event.request;
	return (
		(method !== 'GET' && method !== 'HEAD') ||
		event.url.pathname.startsWith('/api/') ||
		event.cookies.get(PREVIEW_COOKIE) !== undefined
	);
}

/** Only complete, public, tagged pages: never errors, cookies, or a load that opted out. */
export function isCacheable(response: Response, tags: Set<string>): boolean {
	if (response.status !== 200 || tags.size === 0) return false;
	if (response.headers.has('set-cookie')) return false;
	return !/no-store|private/i.test(response.headers.get('cache-control') ?? '');
}

/** What browsers get: revalidate every time, so a purge is visible on the next load. */
function forBrowser(response: Response, status: 'HIT' | 'MISS' | 'BYPASS'): Response {
	const out = new Response(response.body, response);
	out.headers.delete('cache-tag');
	// `no-cache` (not `max-age=0`) also keeps the adapter's worker from caching it again.
	out.headers.set('cache-control', 'no-cache');
	out.headers.set('x-edge-cache', status);
	return out;
}

/** The two Cache API calls used here, typed with the app's Request/Response (not workers-types'). */
export interface PageCache {
	match(key: string): Promise<Response | undefined>;
	put(key: string, response: Response): Promise<void>;
}

export const edgeCache: Handle = async ({ event, resolve }) => {
	// Missing in `vite dev` (no Workers runtime): pages then render uncached.
	const cache = event.platform?.caches?.default as PageCache | undefined;
	if (!cache || shouldBypass(event)) {
		const response = await resolve(event);
		if (cache) response.headers.set('x-edge-cache', 'BYPASS');
		return response;
	}

	const key = cacheKey(event.url);
	const hit = await cache.match(key);
	if (hit) {
		const response = forBrowser(hit, 'HIT');
		return event.request.method === 'HEAD' ? new Response(null, response) : response;
	}

	const response = await resolve(event);
	const tags = event.locals.cacheTags;
	// Only GETs are stored: a HEAD response has no body.
	if (event.request.method === 'GET' && isCacheable(response, tags)) {
		const stored = new Response(response.clone().body, response);
		stored.headers.set('cache-control', `public, max-age=${EDGE_TTL}`);
		stored.headers.set('cache-tag', [...tags].join(','));
		event.platform!.ctx.waitUntil(cache.put(key, stored));
	}
	return forBrowser(response, 'MISS');
};
