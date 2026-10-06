import { error } from '@sveltejs/kit';
import {
	renderMarkdown,
	getPost,
	listPosts,
	pickNextUp,
	postPage
} from '$lib/content/index.server';
import { pageActions, pageLoad } from '$lib/server/page-load';
import type { PageServerLoad } from './$types';

// The post is required: without Strapi this is the error page. Next up isn't.
export const load = pageLoad(async ({ locals, params }, { drafts, degrade }) => {
	const post = await getPost(locals, params.slug, { drafts });
	if (!post) error(404, 'Not found');

	// Only fetch the other posts when the author hasn't picked "Next up" by hand.
	const others = post.related?.length
		? []
		: await listPosts(locals, {}, { drafts }).catch(degrade([]));
	const nextUp = pickNextUp(post, others);
	const { html, headings } = renderMarkdown(post.body ?? '', { headingLinks: true });

	return { post: postPage(post), html, headings, nextUp };
}) satisfies PageServerLoad;

export const actions = pageActions;
