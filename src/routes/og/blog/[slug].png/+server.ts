// A post's share card (#62, F-og-post). Tagged type:post, type:category and type:profile through
// strapi(), so publishing re-renders it after the purge.
import { error } from '@sveltejs/kit';
import { formatDate, shownDate } from '$lib/content';
import {
	cardProfile,
	headshotSrc,
	loadHeadshot,
	pngResponse,
	postCard,
	renderCard
} from '$lib/site/index.server';
import { getPost, getProfile } from '$lib/content/index.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	const [post, { profile, degraded }] = await Promise.all([
		getPost(locals, params.slug),
		cardProfile(getProfile(locals))
	]);
	if (!post) error(404, 'Not found');
	const card = postCard({
		title: post.title,
		category: post.category?.name,
		date: formatDate(shownDate(post)),
		photo: await loadHeadshot(headshotSrc(profile?.photo))
	});
	return pngResponse(await renderCard(card), degraded);
};
