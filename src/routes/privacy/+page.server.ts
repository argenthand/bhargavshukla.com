import { error } from '@sveltejs/kit';
import { pageActions, pageLoad } from '$lib/server/page-load';
import { getPrivacy } from '$lib/content/index.server';
import type { PageServerLoad } from './$types';

// The note is the page: until it's saved in Strapi this is a 404, and without Strapi the error page.
export const load = pageLoad(async ({ locals }) => {
	const privacy = await getPrivacy(locals);
	if (!privacy) error(404, 'Not found');
	return { privacy };
}) satisfies PageServerLoad;

export const actions = pageActions;
