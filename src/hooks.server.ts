import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { edgeCache } from '$lib/server/edge-cache';

// Every load that reads Strapi records its cache tags here; the edge cache turns them into the
// stored page's Cache-Tag header (docs/caching.md).
const cacheTags: Handle = ({ event, resolve }) => {
	event.locals.cacheTags = new Set();
	return resolve(event);
};

export const handle = sequence(cacheTags, edgeCache);
