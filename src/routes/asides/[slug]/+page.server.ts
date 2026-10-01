import { error } from '@sveltejs/kit';
import { getAside } from '$lib/server/asides';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const found = await getAside(locals, params.slug);
	if (!found) error(404, 'Not found');
	return found;
};
