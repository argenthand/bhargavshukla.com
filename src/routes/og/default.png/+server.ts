// The site's share card (#62, F-og-default): home and every page without a card of its own.
import {
	cardProfile,
	defaultCard,
	headshotSrc,
	loadHeadshot,
	pngResponse,
	renderCard
} from '$lib/site/index.server';
import { getProfile } from '$lib/content/index.server';
import { site } from '$lib/site';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const { profile, degraded } = await cardProfile(getProfile(locals));
	const card = defaultCard({
		name: profile?.name ?? site.name,
		tagline: profile?.tagline ?? site.description,
		photo: await loadHeadshot(headshotSrc(profile?.photo))
	});
	return pngResponse(await renderCard(card), degraded);
};
