import { listAsides } from '$lib/server/asides';
import { contact } from '$lib/server/contact';
import type { Actions, PageServerLoad } from './$types';

// Every published aside; the kind/tag filters and paging run in the browser from the URL.
export const load: PageServerLoad = async ({ locals }) => ({
	asides: await listAsides(locals, { drafts: locals.preview })
});

// The contact card's form (#135): the card is in the layout, and layouts can't have actions.
export const actions = { contact } satisfies Actions;
