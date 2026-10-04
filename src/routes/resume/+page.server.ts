import { getProfile } from '$lib/server/profile';
import { getResume } from '$lib/server/resume';
import { contact } from '$lib/server/contact';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const [resume, profile] = await Promise.all([
		getResume(locals, { drafts: locals.preview }),
		getProfile(locals)
	]);
	// Not published yet: the page shows the profile header and an empty state (#91), not a 404.
	return { resume: resume ?? null, profile };
};

// The contact card's form (#135): the card is in the layout, and layouts can't have actions.
export const actions = { contact } satisfies Actions;
