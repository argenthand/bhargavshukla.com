// The Privacy single type (#154): the privacy note at /privacy, linked from the footer. Its copy
// is written in Strapi; the page adds only the title.

import type { Privacy } from '$lib/types/content';
import { renderMarkdown } from './markdown';
import { strapi } from './strapi';

/** The note, or undefined until it's saved in Strapi. */
export async function getPrivacy(locals: App.Locals) {
	const privacy = await strapi(locals).get<Privacy>('privacy', { fields: ['lead', 'body'] });
	if (!privacy) return undefined;
	return { lead: privacy.lead, html: renderMarkdown(privacy.body ?? '').html };
}
