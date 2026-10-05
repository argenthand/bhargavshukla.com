import { listPosts } from '$lib/server/posts';
import { pageActions, pageLoad } from '$lib/server/page-load';
import type { Category } from '$lib/types/content';
import type { PageServerLoad } from './$types';

// Every published post; search and the category filter run in the browser (docs/design.md → Routes).
export const load = pageLoad(async ({ locals }, { drafts, degrade }) => {
	const posts = await listPosts(locals, {}, { drafts }).catch(degrade([]));

	// Only categories that have posts get a filter.
	const categories = new Map<string, Category>();
	for (const post of posts) if (post.category) categories.set(post.category.slug, post.category);

	return {
		posts: posts.map(({ title, slug, displayDate, publishedAt, category, draft }) => ({
			title,
			slug,
			displayDate,
			publishedAt,
			category,
			draft
		})),
		categories: [...categories.values()].sort((a, b) => a.name.localeCompare(b.name))
	};
}) satisfies PageServerLoad;

export const actions = pageActions;
