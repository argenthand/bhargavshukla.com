// Post queries shared by the home page, /blog and /blog/[slug].

import { shownDate } from '../format';
import type { Post, PostSummary } from '../types';
import { resolveImage } from './image';
import { mergeDrafts } from '$lib/server/preview';
import { mediaUrl, strapi } from './strapi';

/** `drafts`: in preview (#57), also show unpublished posts and unpublished edits. */
type Options = { drafts?: boolean };

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

export async function listPosts(
	locals: App.Locals,
	filters: Record<string, unknown> = {},
	{ drafts = false }: Options = {}
): Promise<PostSummary[]> {
	const query = {
		fields: SUMMARY_FIELDS,
		populate: { category: CATEGORY },
		filters,
		sort: ['publishedAt:desc']
	};
	const client = strapi(locals);
	const posts = await client.findAll<PostSummary>('post', query);
	if (!drafts) return posts.sort(byShownDate);
	const latest = await client.findAll<PostSummary>('post', { ...query, status: 'draft' });
	return mergeDrafts(posts, latest).sort(byShownDate);
}

export async function getPost(
	locals: App.Locals,
	slug: string,
	{ drafts = false }: Options = {}
): Promise<Post | undefined> {
	if (drafts) {
		// The latest draft, with the publish date of its live version if there is one (matched by
		// document, so a slug changed in the draft still finds it).
		const draft = await fetchPost(locals, { slug: { $eq: slug } }, 'draft');
		if (!draft) return undefined;
		const published = await fetchPost(locals, { documentId: { $eq: draft.documentId } });
		return mergeDrafts(published ? [published] : [], [draft])[0];
	}
	return fetchPost(locals, { slug: { $eq: slug } });
}

async function fetchPost(locals: App.Locals, filters: Record<string, unknown>, status?: 'draft') {
	const { data } = await strapi(locals).find<Post>('post', {
		...(status && { status }),
		filters,
		populate: {
			category: CATEGORY,
			cover: { populate: { file: { fields: ['url', 'alternativeText', 'width', 'height'] } } },
			related: { fields: SUMMARY_FIELDS, populate: { category: CATEGORY } },
			seo: { populate: { ogImage: { fields: ['url', 'alternativeText', 'width', 'height'] } } }
		},
		pagination: { pageSize: 1 }
	});
	return data[0];
}

/** Home: up to 3 featured posts, or the newest posts when none are featured yet. */
export async function homePosts(locals: App.Locals, options: Options = {}) {
	const posts = await listPosts(locals, {}, options);
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

/**
 * A post as its page needs it (#142): only the fields it shows, the cover ready to render, and the
 * SEO fields with their fallbacks (the title and summary when the author left them empty).
 */
export function postPage(post: Post) {
	return {
		slug: post.slug,
		title: post.title,
		summary: post.summary,
		category: post.category,
		displayDate: post.displayDate,
		publishedAt: post.publishedAt,
		updatedAt: post.updatedAt,
		draft: post.draft,
		cover: resolveImage(post.cover),
		seo: {
			title: post.seo?.metaTitle || post.title,
			description: post.seo?.metaDescription || post.summary,
			canonical: post.seo?.canonicalUrl || null,
			ogImage: post.seo?.ogImage && { ...post.seo.ogImage, url: mediaUrl(post.seo.ogImage.url) }
		}
	};
}
