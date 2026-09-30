// The Profile single type (#42): home intro and contact links; the resume header reuses them.

import type { Profile } from '$lib/types/content';
import { renderMarkdown } from './markdown';
import { strapi } from './strapi';

export async function getProfile(locals: App.Locals) {
	const profile = await strapi(locals).get<Profile>('profile', {
		fields: ['name', 'tagline', 'bio', 'email', 'linkedin', 'github']
	});
	if (!profile) return undefined;
	const { bio, ...rest } = profile;
	return { ...rest, bioHtml: renderMarkdown(bio ?? '').html };
}
