import { listPosts } from '$lib/server/posts';
import type { Category } from '$lib/types/content';
import { contact } from '$lib/server/contact';
import type { Actions, PageServerLoad } from './$types';

// Every published post; search and the category filter run in the browser (docs/design.md → Routes).
export const load: PageServerLoad = async ({ locals }) => {
	const posts = await listPosts(locals, {}, { drafts: locals.preview });

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
};

// The contact card's form (#135): the card is in the layout, and layouts can't have actions.
export const actions = { contact } satisfies Actions;
