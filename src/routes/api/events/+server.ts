// The analytics beacon's target (#154, docs/analytics.md): checks the page's events, writes the
// counted ones to Workers Analytics Engine, and answers 204. See $lib/server/events.ts.

import { handleBeacon } from '$lib/server/events';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ request, locals, platform }) =>
	handleBeacon(request, {
		preview: locals.preview,
		dataset: platform?.env.EVENTS
	});
