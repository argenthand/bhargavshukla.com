// An aside's share card (#62, F-og-aside): its title, or the opening of its text (a quote in italics).
import { error } from '@sveltejs/kit';
import { kindLabel } from '$lib/content';
import { getAside, getProfile } from '$lib/content/index.server';
import {
	asideCard,
	cardProfile,
	headshotSrc,
	loadHeadshot,
	pngResponse,
	renderCard
} from '$lib/site/index.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	const [found, { profile, degraded }] = await Promise.all([
		getAside(locals, params.slug),
		cardProfile(getProfile(locals))
	]);
	if (!found) error(404, 'Not found');
	const { aside, text } = found;
	const quote = aside.kind === 'quote';
	const card = asideCard({
		kind: kindLabel(aside.kind),
		text: (quote ? text : aside.title) || text || aside.label,
		quote,
		attribution: quote
			? [aside.sourceAuthor, aside.sourceTitle].filter(Boolean).join(', ') || null
			: null,
		photo: await loadHeadshot(headshotSrc(profile?.photo))
	});
	return pngResponse(await renderCard(card), degraded);
};
