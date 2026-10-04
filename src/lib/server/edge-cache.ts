// Edge cache (#16, #123, docs/caching.md). Workers Cache sits in front of the Worker: on a hit
// Cloudflare answers without running it. This hook only says what may be kept and for how long:
// `Cloudflare-CDN-Cache-Control` for Cloudflare, `Cache-Control` for browsers, and `Cache-Tag`
// (the content types a page read) so the Strapi webhook can purge by tag (#17).

import type { Handle, RequestEvent } from '@sveltejs/kit';

/** Seconds a cached page is fresh. Purges handle content changes; deploys get fresh keys. */
export const EDGE_MAX_AGE = 86_400;

/** Seconds after that a stale copy is still served while one request refreshes it. */
export const EDGE_STALE = 604_800;

/** Cookie set by draft preview (#57); previews must never be cached or served cached. */
export const PREVIEW_COOKIE = '__preview';

/** What Cloudflare keeps a cacheable response for: a day fresh, then a week served stale. */
export const EDGE_CACHE_CONTROL = `max-age=${EDGE_MAX_AGE}, stale-while-revalidate=${EDGE_STALE}`;

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
export function withCacheHeaders(response: Response, tags: Set<string>, cacheable: boolean) {
	const out = new Response(response.body, response);
	out.headers.set('cache-control', 'no-cache');
	if (cacheable) {
		out.headers.set('cloudflare-cdn-cache-control', EDGE_CACHE_CONTROL);
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
	if (event.locals.noStore) return withCacheHeaders(response, tags, false);
	if (event.isDataRequest) {
		const body = await response.text();
		const data = new Response(body, response);
		return withCacheHeaders(data, tags, isCacheableData(data, body, tags));
	}
	return withCacheHeaders(response, tags, isCacheable(response, tags));
};
