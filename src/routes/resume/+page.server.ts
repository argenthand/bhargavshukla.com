import { error } from '@sveltejs/kit';
import { getProfile } from '$lib/server/profile';
import { getResume } from '$lib/server/resume';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const [resume, profile] = await Promise.all([
		getResume(locals, { drafts: locals.preview }),
		getProfile(locals)
	]);
	// Not published yet: there is no resume to show.
	if (!resume) error(404, 'Not found');
	return { resume, profile };
};
