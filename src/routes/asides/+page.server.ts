import { listAsides } from '$lib/content/index.server';
import { pageActions, pageLoad } from '$lib/publishing/index.server';
import type { PageServerLoad } from './$types';

// Every published aside; the kind/tag filters and paging run in the browser from the URL.
export const load = pageLoad(async ({ locals }, { drafts, degrade }) => ({
	asides: await listAsides(locals, { drafts }).catch(degrade([]))
})) satisfies PageServerLoad;

export const actions = pageActions;
