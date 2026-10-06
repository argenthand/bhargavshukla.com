// Edge cache (#16, #123, docs/caching.md). Workers Cache sits in front of the Worker: on a hit
// Cloudflare answers without running it. This hook only says what may be kept and for how long:
// `Cloudflare-CDN-Cache-Control` for Cloudflare, `Cache-Control` for browsers, and `Cache-Tag`
// (the content types a page read) so the Strapi webhook can purge by tag (#17).
//
// Validators (#126), so a browser's revalidation (it always revalidates: `no-cache`) can come back
// as `304 Not Modified` instead of the whole page. Pages already get an `ETag` from SvelteKit (a
// hash of the HTML); page data gets one here. Cacheable responses also get `Last-Modified`, the
// time they were rendered: the zone's HTML features drop the page `ETag` (docs/caching.md →
// Validators), and Cloudflare answers `If-Modified-Since` from the cached copy just the same.

import type { Handle, RequestEvent } from '@sveltejs/kit';

/** Seconds a cached page is fresh. Purges handle content changes; deploys get fresh keys. */
export const EDGE_MAX_AGE = 86_400;

/** Seconds after that a stale copy is still served while one request refreshes it. */
export const EDGE_STALE = 604_800;

/** Seconds a degraded page (#142) asks crawlers and browsers to wait before trying again. */
export const DEGRADED_RETRY_AFTER = 60;

/** Cookie set by draft preview (#57); previews must never be cached or served cached. */
export const PREVIEW_COOKIE = '__preview';

/** What Cloudflare keeps a cacheable response for: a day fresh, then a week served stale. */
export const EDGE_CACHE_CONTROL = `max-age=${EDGE_MAX_AGE}, stale-while-revalidate=${EDGE_STALE}`;

/** A strong `ETag` for a body: the same 32-bit hash SvelteKit uses for page ETags. */
export function etagFor(body: string): string {
	let hash = 5381;
	let i = body.length;
	while (i) hash = (hash * 33) ^ body.charCodeAt(--i);
	return `"${(hash >>> 0).toString(36)}"`;
}

/** Requests the hook leaves alone: their own headers stand (API routes set theirs). */
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

/**
 * The response with its cache headers. Browsers always revalidate (`no-cache`), so a purge shows
 * on their next load. Cloudflare keeps a cacheable one, varied on `Cookie` so a request carrying
 * the preview cookie never gets the public copy; anything else it never stores.
 */
export function withCacheHeaders(
	response: Response,
	tags: Set<string>,
	cacheable: boolean,
	now = () => new Date()
) {
	const out = new Response(response.body, response);
	out.headers.set('cache-control', 'no-cache');
	if (cacheable) {
		out.headers.set('cloudflare-cdn-cache-control', EDGE_CACHE_CONTROL);
		if (!out.headers.has('last-modified')) out.headers.set('last-modified', now().toUTCString());
		out.headers.set('cache-tag', [...tags].join(','));
		out.headers.append('vary', 'Cookie');
	} else {
		out.headers.set('cloudflare-cdn-cache-control', 'no-store');
		out.headers.delete('cache-tag');
	}
	return out;
}

/**
 * A bypassed response keeps its own headers, but Cloudflare stores nothing it wasn't told to:
 * without a `Cache-Control`, Workers Cache would keep a 200 for two hours by heuristic.
 */
export function bypass(response: Response) {
	if (/public/i.test(response.headers.get('cache-control') ?? '')) return response;
	const out = new Response(response.body, response);
	out.headers.set('cloudflare-cdn-cache-control', 'no-store');
	return out;
}

export const edgeCache: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	if (shouldBypass(event)) return bypass(response);

	const tags = event.locals.cacheTags;
	if (event.locals.degraded) {
		const out = withCacheHeaders(response, tags, false);
		// A degraded page (#142) still shows, but as a 503 so search engines keep the full one.
		// Page data stays a 200: SvelteKit's client treats any other status as a failed navigation.
		if (event.isDataRequest || response.status !== 200) return out;
		out.headers.set('retry-after', String(DEGRADED_RETRY_AFTER));
		return new Response(out.body, {
			status: 503,
			statusText: 'Service Unavailable',
			headers: out.headers
		});
	}
	if (event.isDataRequest) {
		const body = await response.text();
		const data = new Response(body, response);
		const cacheable = isCacheableData(data, body, tags);
		// SvelteKit answers a matching If-None-Match with a 304 once the hook returns.
		if (cacheable) data.headers.set('etag', etagFor(body));
		return withCacheHeaders(data, tags, cacheable);
	}
	return withCacheHeaders(response, tags, isCacheable(response, tags));
};
