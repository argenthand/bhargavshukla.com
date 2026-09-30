// Post queries shared by the home page, /blog and /blog/[slug].

import { shownDate } from '$lib/format';
import type { Post, PostSummary } from '$lib/types/content';
import { strapi } from './strapi';

const SUMMARY_FIELDS = [
	'title',
	'slug',
	'summary',
	'featured',
	'displayDate',
	'publishedAt',
	'updatedAt'
];
const CATEGORY = { fields: ['name', 'slug'] };

/** Newest first by the date readers see (`displayDate ?? publishedAt`), which Strapi can't sort by. */
export const byShownDate = (a: PostSummary, b: PostSummary) =>
	shownDate(b).localeCompare(shownDate(a));

export async function listPosts(locals: App.Locals, filters: Record<string, unknown> = {}) {
	const posts = await strapi(locals).findAll<PostSummary>('post', {
		fields: SUMMARY_FIELDS,
		populate: { category: CATEGORY },
		filters,
		sort: ['publishedAt:desc']
	});
	return posts.sort(byShownDate);
}

export async function getPost(locals: App.Locals, slug: string): Promise<Post | undefined> {
	const { data } = await strapi(locals).find<Post>('post', {
		filters: { slug: { $eq: slug } },
		populate: {
			category: CATEGORY,
			cover: { fields: ['url', 'alternativeText', 'width', 'height'] },
			related: { fields: SUMMARY_FIELDS, populate: { category: CATEGORY } },
			seo: { populate: { ogImage: { fields: ['url', 'alternativeText', 'width', 'height'] } } }
		},
		pagination: { pageSize: 1 }
	});
	return data[0];
}

/** Home: up to 3 featured posts, or the newest posts when none are featured yet. */
export async function homePosts(locals: App.Locals) {
	const posts = await listPosts(locals);
	const featured = posts.filter((post) => post.featured);
	return featured.length > 0
		? { heading: 'Featured', posts: featured.slice(0, 3) }
		: { heading: 'Latest', posts: posts.slice(0, 3) };
}

/**
 * "Next up" (docs/design.md → Recommended reading): the post's `related` picks if set, otherwise
 * the same category newest first, then newest overall. Never the post itself; drafts never come back.
 */
export function pickNextUp(post: Post, all: PostSummary[], max = 2): PostSummary[] {
	if (post.related?.length) return [...post.related].slice(0, max);
	const others = all.filter((p) => p.slug !== post.slug);
	const sameCategory = post.category
		? others.filter((p) => p.category?.slug === post.category?.slug)
		: [];
	const picks = [...sameCategory];
	for (const p of others) if (!picks.includes(p)) picks.push(p);
	return picks.slice(0, max);
}
