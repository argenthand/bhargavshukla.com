import { error } from '@sveltejs/kit';
import { getAside } from '$lib/content/index.server';
import { pageActions, pageLoad } from '$lib/server/page-load';
import type { PageServerLoad } from './$types';

// The aside is required: without Strapi this is the error page.
export const load = pageLoad(async ({ locals, params }, { drafts }) => {
	const found = await getAside(locals, params.slug, { drafts });
	if (!found) error(404, 'Not found');
	return found;
}) satisfies PageServerLoad;

export const actions = pageActions;
