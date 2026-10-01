// The Profile single type (#42): home intro and contact links; the resume header reuses them.

import type { Profile } from '$lib/types/content';
import { resolveUpload } from './image';
import { renderMarkdown } from './markdown';
import { strapi } from './strapi';

/** The bio's first paragraph as plain text, cut at a word to fit a meta description. */
export function firstParagraph(markdown: string, max = 160): string {
	const text = (markdown.trim().split(/\n\s*\n/)[0] ?? '')
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/[*_`#>]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	if (text.length <= max) return text;
	const cut = text.slice(0, max - 1);
	// Drop the last word only if the cut went through the middle of it.
	return `${/\s/.test(text[max - 1]) ? cut.trimEnd() : cut.replace(/\s+\S*$/, '')}…`;
}

export async function getProfile(locals: App.Locals) {
	const profile = await strapi(locals).get<Profile>('profile', {
		fields: ['name', 'tagline', 'bio', 'email', 'linkedin', 'github'],
		populate: { photo: { fields: ['url', 'alternativeText', 'width', 'height', 'formats'] } }
	});
	if (!profile) return undefined;
	const { bio, photo, ...rest } = profile;
	return {
		...rest,
		// Alt text from the Media Library; empty by default, since the name sits right next to it.
		photo: resolveUpload(photo),
		bioHtml: renderMarkdown(bio ?? '').html,
		bioSummary: firstParagraph(bio ?? '')
	};
}
