import type { Handle } from '@sveltejs/kit';

// Every load that reads Strapi records its cache tags here. The edge cache (#16) wraps this hook
// and turns them into the response's Cache-Tag header.
export const handle: Handle = ({ event, resolve }) => {
	event.locals.cacheTags = new Set();
	return resolve(event);
};
