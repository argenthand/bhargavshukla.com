// Read counts (#87, docs/view-counts.md). GET returns the counts for some pages; POST is the
// beacon a page sends after 10 seconds of reading. Both fail quietly: a count is never worth an
// error on the page.

import { dev } from '$app/environment';
import { json } from '@sveltejs/kit';
import { readCounts, recordRead, type ReadTarget } from '$lib/server/reads';
import { strapi } from '$lib/content/index.server';
import { site } from '$lib/site';
import type { RequestHandler } from './$types';

/**
 * `?path=/blog/a&path=/blog/b` → `{ "/blog/a": 1200 }` (pages under 5 reads are left out).
 * `public, max-age=60`: the adapter's worker keeps the response in the data center's cache for a
 * minute, keyed by this URL, so a popular page costs one D1 read a minute (docs/caching.md).
 */
export const GET: RequestHandler = async ({ url, platform }) => {
	const db = platform?.env.READS;
	let counts = {};
	try {
		if (db) counts = await readCounts(db, url.searchParams.getAll('path'));
	} catch (err) {
		console.error('Read counts unavailable', err);
		return json({}, { headers: { 'cache-control': 'no-store' } });
	}
	return json(counts, { headers: { 'cache-control': 'public, max-age=60' } });
};

const PRODUCTION_HOST = new URL(site.url).host;
const NO_CONTENT = () => new Response(null, { status: 204 });

/** The beacon: the page's path as plain text. Always 204, counted or not. */
export const POST: RequestHandler = async ({
	request,
	url,
	locals,
	platform,
	getClientAddress
}) => {
	const db = platform?.env.READS;
	// Only beacons from the site's own pages; preview mode, Workers Builds preview URLs and other
	// hosts don't count (`vite dev` does, locally).
	const sameOrigin = request.headers.get('origin') === url.origin;
	if (!db || !sameOrigin || locals.preview || (url.host !== PRODUCTION_HOST && !dev)) {
		return NO_CONTENT();
	}

	const path = (await request.text()).slice(0, 300);
	// Only a published post or aside: asked once per new reader, so it rarely reaches Strapi.
	const exists = async ({ type, slug }: ReadTarget) => {
		const { data } = await strapi(locals).find(type, {
			filters: { slug: { $eq: slug } },
			fields: ['slug'],
			pagination: { pageSize: 1 }
		});
		return data.length > 0;
	};
	try {
		await recordRead(
			db,
			{ path, ip: getClientAddress(), userAgent: request.headers.get('user-agent') ?? '' },
			exists
		);
	} catch (err) {
		console.error('Read not recorded', err);
	}
	return NO_CONTENT();
};
