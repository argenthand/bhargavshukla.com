// The analytics beacon's target (#154, docs/analytics.md): checks the page's events, answers 204
// straight away and forwards them to PostHog in the background. See $lib/server/events.ts.

import { env } from '$env/dynamic/private';
import { handleBeacon, sendToPostHog } from '$lib/server/events';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ request, locals, platform, getClientAddress }) =>
	handleBeacon(
		request,
		{
			preview: locals.preview,
			ip: getClientAddress(),
			token: env.POSTHOG_TOKEN,
			country: platform?.cf?.country
		},
		(batch) => platform?.ctx.waitUntil(sendToPostHog(batch, fetch))
	);
