import { error } from '@sveltejs/kit';
import { getAside } from '$lib/server/asides';
import { contact } from '$lib/server/contact';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const found = await getAside(locals, params.slug, { drafts: locals.preview });
	if (!found) error(404, 'Not found');
	return found;
};

// The contact card's form (#135): the card is in the layout, and layouts can't have actions.
export const actions = { contact } satisfies Actions;
