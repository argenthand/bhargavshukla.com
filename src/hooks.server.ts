import { env } from '$env/dynamic/private';
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { edgeCache } from '$lib/server/edge-cache';
import { PREVIEW_COOKIE, verifyCookie } from '$lib/server/preview';

// Every load that reads Strapi records its cache tags here; the edge cache turns them into the
// stored page's Cache-Tag header (docs/caching.md).
const cacheTags: Handle = ({ event, resolve }) => {
	event.locals.cacheTags = new Set();
	return resolve(event);
};

// Draft preview (#57): only a cookie we signed turns it on. Any `__preview` cookie already skips
// the edge cache; a preview response must not be kept by the browser or indexed either.
const preview: Handle = async ({ event, resolve }) => {
	event.locals.preview = await verifyCookie(event.cookies.get(PREVIEW_COOKIE), env.PREVIEW_SECRET);
	const response = await resolve(event);
	if (event.locals.preview) {
		response.headers.set('cache-control', 'private, no-store');
		response.headers.set('x-robots-tag', 'noindex');
	}
	return response;
};

export const handle = sequence(cacheTags, preview, edgeCache);
