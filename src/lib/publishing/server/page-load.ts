// What every page's server load shares (#142, docs/caching.md → Degraded pages). A route supplies
// only its own queries:
//
//   export const load = pageLoad(async ({ locals }, { drafts, degrade }) => ({
//   	asides: await listAsides(locals, { drafts }).catch(degrade([]))
//   })) satisfies PageServerLoad;
//   export const actions = pageActions;
//
// Content a page can do without is caught with `degrade(value)`: the page shows `value` instead and
// is a degraded page. Content it can't (the entry on an entry page) isn't caught, so the error page
// shows. `satisfies` types the event from the route's own `$types`.

import type { ServerLoadEvent } from '@sveltejs/kit';
import { contact } from '$lib/server/contact';

/** The contact card is on every page (#135) and layouts can't have actions, so every page has it. */
export const pageActions = { contact };

export interface PageLoadTools {
	/** In draft preview (#57): also show unpublished entries and edits. */
	drafts: boolean;
	/** A `.catch` handler: logs the error, marks the page degraded, and stands in `value`. */
	degrade: <V>(value: V) => (err: unknown) => V;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any route's params and parent data
export function pageLoad<E extends ServerLoadEvent<any, any, any>, T extends object>(
	load: (event: E, tools: PageLoadTools) => Promise<T>
) {
	return async (event: E): Promise<T & { degraded: boolean }> => {
		let degraded = false;
		const degrade =
			<V>(value: V) =>
			(err: unknown) => {
				console.error(`${event.route.id}: content unavailable`, err);
				// The page reads its data; the edge-cache hook reads only `locals`.
				degraded = event.locals.degraded = true;
				return value;
			};
		const data = await load(event, { drafts: event.locals.preview, degrade });
		return { ...data, degraded };
	};
}
