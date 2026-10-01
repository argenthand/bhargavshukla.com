import { error } from '@sveltejs/kit';
import { resolveImage } from '$lib/server/image';
import { renderMarkdown } from '$lib/server/markdown';
import { getPost, listPosts, pickNextUp } from '$lib/server/posts';
import { mediaUrl } from '$lib/server/strapi';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const post = await getPost(locals, params.slug);
	if (!post) error(404, 'Not found');

	// Only fetch the other posts when the author hasn't picked "Next up" by hand.
	const nextUp = pickNextUp(post, post.related?.length ? [] : await listPosts(locals));
	const { html, headings } = renderMarkdown(post.body ?? '');

	return {
		post: {
			title: post.title,
			summary: post.summary,
			category: post.category,
			displayDate: post.displayDate,
			publishedAt: post.publishedAt,
			updatedAt: post.updatedAt,
			cover: resolveImage(post.cover),
			seo: {
				title: post.seo?.metaTitle || post.title,
				description: post.seo?.metaDescription || post.summary,
				canonical: post.seo?.canonicalUrl || null,
				ogImage: post.seo?.ogImage && { ...post.seo.ogImage, url: mediaUrl(post.seo.ogImage.url) }
			}
		},
		html,
		headings,
		nextUp
	};
};
