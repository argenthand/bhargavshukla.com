import { listAsides } from '$lib/server/asides';
import type { PageServerLoad } from './$types';

// Every published aside; the kind/tag filters and paging run in the browser from the URL.
export const load: PageServerLoad = async ({ locals }) => ({
	asides: await listAsides(locals, { drafts: locals.preview })
});
