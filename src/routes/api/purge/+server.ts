// Strapi webhook target (#17, #123): purges cached pages by content type, then repopulates the
// pages that show it in the background. See $lib/publishing/server/purge.ts and content-map.ts.

import { env } from '$env/dynamic/private';
import { handlePurge, repopulate } from '$lib/publishing/index.server';
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
			((urls) =>
				ctx!.waitUntil(
					repopulate(urls, (path) => self.fetch(new Request(new URL(path, url.origin))))
				))
	);
};
