// The single types that pages show as a header or a note: the Profile (#42), the home intro and
// contact links, which the resume header reuses; and the Privacy note (#154). The Resume has its own
// module: its grouping is logic of its own.

import type { Privacy, Profile, ProfilePage } from '../types';
import { resolveUpload } from './image';
import { firstParagraph, renderMarkdown } from './markdown';
import { strapi } from './strapi';

/**
 * The profile for pages. Never the email (#135): pages show the contact card instead, and the
 * address is only fetched for the printed resume (`/api/print-contact`) and the form's own mail.
 */
export async function getProfile(locals: App.Locals): Promise<ProfilePage | undefined> {
	const profile = await strapi(locals).get<Omit<Profile, 'email'>>('profile', {
		fields: ['name', 'tagline', 'bio', 'linkedin', 'github'],
		populate: {
			photo: { fields: ['url', 'alternativeText', 'width', 'height', 'formats'] },
			photoAlt: { fields: ['url', 'alternativeText', 'width', 'height', 'formats'] }
		}
	});
	if (!profile) return undefined;
	const { bio, photo, photoAlt, ...rest } = profile;
	return {
		...rest,
		// Alt text from the Media Library; empty by default, since the name sits right next to it.
		photo: resolveUpload(photo),
		photoAlt: resolveUpload(photoAlt),
		bioHtml: renderMarkdown(bio ?? '').html,
		bioSummary: firstParagraph(bio ?? '')
	};
}

/** The profile's email (#135): where contact-form mail goes, and the printed resume's address. */
export async function getContactEmail(locals: App.Locals): Promise<string | null> {
	const profile = await strapi(locals).get<Pick<Profile, 'email'>>('profile', {
		fields: ['email']
	});
	return profile?.email ?? null;
}

/** The privacy note, or undefined until it's saved in Strapi. Its copy is written there; the page adds only the title. */
export async function getPrivacy(locals: App.Locals) {
	const privacy = await strapi(locals).get<Privacy>('privacy', { fields: ['lead', 'body'] });
	if (!privacy) return undefined;
	return { lead: privacy.lead, html: renderMarkdown(privacy.body ?? '').html };
}
