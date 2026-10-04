// Strapi webhook target (#17, #123): purges cached pages by content type, then repopulates the
// key pages in the background. See $lib/server/purge.ts and $lib/server/repopulate.ts.

import { env } from '$env/dynamic/private';
import { handlePurge } from '$lib/server/purge';
import { repopulate, urlsToRepopulate } from '$lib/server/repopulate';
import type { RequestHandler } from './$types';

/** The Worker's own default entrypoint (`ctx.exports`): a request to itself, through its cache. */
type Loopback = { exports?: { default?: { fetch(request: Request): Promise<Response> } } };

export const POST: RequestHandler = ({ request, platform, url }) => {
	const ctx = platform?.ctx;
	const self = (ctx as Loopback | undefined)?.exports?.default;
	return handlePurge(
		request,
		env.PURGE_SECRET,
		ctx?.cache && ((options) => ctx.cache!.purge(options)),
		self &&
			((plan, body) =>
				ctx!.waitUntil(
					repopulate(urlsToRepopulate(plan, body), (path) =>
						self.fetch(new Request(new URL(path, url.origin)))
					)
				))
	);
};
