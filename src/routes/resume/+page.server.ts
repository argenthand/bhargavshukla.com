import { pageActions, pageLoad } from '$lib/server/page-load';
import { getProfile } from '$lib/server/profile';
import { getResume } from '$lib/server/resume';
import type { PageServerLoad } from './$types';

// Not published yet: the page shows the profile header and an empty state (#91), not a 404.
// Without Strapi it shows whichever of the two loaded.
export const load = pageLoad(async ({ locals }, { drafts, degrade }) => {
	const [resume, profile] = await Promise.all([
		getResume(locals, { drafts }).catch(degrade(undefined)),
		getProfile(locals).catch(degrade(undefined))
	]);
	return { resume: resume ?? null, profile };
}) satisfies PageServerLoad;

export const actions = pageActions;
