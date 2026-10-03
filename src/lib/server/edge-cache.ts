// Edge cache for rendered pages (#16, docs/caching.md). Pages go into Cloudflare's Cache API
// tagged with the content types they read (`Cache-Tag: type:post,…`); the Strapi webhook (#17)
// purges by tag, which works worldwide on the Free plan, unlike cache.delete().

import { version } from '$app/environment';
import type { Handle, RequestEvent } from '@sveltejs/kit';

/**
 * Seconds a page stays cached: a day. Purges (#17) clear content changes and the build version in
 * the key clears deploys (#108), so this only bounds staleness if a purge fails.
 */
export const EDGE_TTL = 86_400;

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
 * The Cache API key, from the request's own URL: SvelteKit strips `/__data.json` and its params
 * from `event.url`, which would give a page and its data one key (#108). It lives under /__edge/
 * on purpose: the adapter's own worker looks up the raw request URL in caches.default before
 * SvelteKit runs, and must never find (and serve, Cache-Tag and all) one of these entries. The
 * build version keeps a deploy from serving pages that point at assets it removed.
 */
export function cacheKey(url: URL, build: string): string {
	const key = new URL(`/__edge/${encodeURIComponent(build)}${url.pathname}`, url.origin);
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

/** Only complete, public, tagged pages: never errors, cookies, or a response that opted out. */
export function isCacheable(response: Response, tags: Set<string>): boolean {
	if (response.status !== 200 || tags.size === 0) return false;
	if (response.headers.has('set-cookie')) return false;
	return !/no-store|private/i.test(response.headers.get('cache-control') ?? '');
}

/**
 * Page data for client-side navigation (`__data.json`, #108). SvelteKit always sends it as
 * `private, no-store`, so the header can't decide: it's kept when it's plain JSON with no error
 * node. A 404 or a Strapi failure in a load arrives as a 200 whose node is `{ type: 'error' }`;
 * a redirect is `{ type: 'redirect' }`.
 */
export function isCacheableData(response: Response, body: string, tags: Set<string>): boolean {
	if (response.status !== 200 || tags.size === 0) return false;
	if (response.headers.has('set-cookie')) return false;
	if (!response.headers.get('content-type')?.startsWith('application/json')) return false;
	try {
		const data = JSON.parse(body) as { type?: string; nodes?: ({ type?: string } | null)[] };
		return data.type === 'data' && (data.nodes ?? []).every((node) => node?.type !== 'error');
	} catch {
		return false;
	}
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

	const key = cacheKey(new URL(event.request.url), version);
	const hit = await cache.match(key);
	if (hit) {
		const response = forBrowser(hit, 'HIT');
		return event.request.method === 'HEAD' ? new Response(null, response) : response;
	}

	let response = await resolve(event);
	const tags = event.locals.cacheTags;
	// Only GETs are stored (a HEAD response has no body), and never when a load opted out.
	if (event.request.method !== 'GET' || event.locals.noStore) return forBrowser(response, 'MISS');

	let cacheable: boolean;
	if (event.isDataRequest) {
		const body = await response.text();
		response = new Response(body, response);
		cacheable = isCacheableData(response, body, tags);
	} else {
		cacheable = isCacheable(response, tags);
	}
	if (cacheable) {
		const stored = new Response(response.clone().body, response);
		stored.headers.set('cache-control', `public, max-age=${EDGE_TTL}`);
		stored.headers.set('cache-tag', [...tags].join(','));
		event.platform!.ctx.waitUntil(cache.put(key, stored));
	}
	return forBrowser(response, 'MISS');
};
