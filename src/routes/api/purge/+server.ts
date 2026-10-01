// Strapi webhook target (#17): purges cached pages by content type. See $lib/server/purge.ts.

import { env } from '$env/dynamic/private';
import { handlePurge } from '$lib/server/purge';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ request }) =>
	handlePurge(request, {
		secret: env.PURGE_SECRET,
		zoneId: env.CF_ZONE_ID,
		token: env.CF_PURGE_TOKEN
	});
