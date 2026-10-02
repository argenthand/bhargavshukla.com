import { getProfile } from '$lib/server/profile';
import { getResume } from '$lib/server/resume';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const [resume, profile] = await Promise.all([
		getResume(locals, { drafts: locals.preview }),
		getProfile(locals)
	]);
	// Not published yet: the page shows the profile header and an empty state (#91), not a 404.
	return { resume: resume ?? null, profile };
};
