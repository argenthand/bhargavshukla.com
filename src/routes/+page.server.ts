import { homePosts, getProfile } from '$lib/content/index.server';
import { pageActions, pageLoad } from '$lib/publishing/index.server';
import type { PageServerLoad } from './$types';

// Without Strapi the intro falls back to the name alone and the posts section is left out. An
// unsaved profile does the same, but that's a normal page: saving it purges home.
export const load = pageLoad(async ({ locals }, { drafts, degrade }) => {
	const [profile, home] = await Promise.all([
		getProfile(locals).catch(degrade(undefined)),
		homePosts(locals, { drafts }).catch(degrade({ heading: 'Featured', posts: [] }))
	]);
	return { profile, home };
}) satisfies PageServerLoad;

export const actions = pageActions;
