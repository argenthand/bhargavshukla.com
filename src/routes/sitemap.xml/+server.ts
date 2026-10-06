// Sitemap (#56): only pages that return 200. Asides and Resume are fetched (and listed) only while
// their section is live, so a hidden section adds no request and no cache tag.
import { buildSitemap, sitemapEntries } from '$lib/site/index.server';
import { listPosts } from '$lib/server/posts';
import { strapi } from '$lib/server/strapi';
import { isLive } from '$lib/site';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const client = strapi(locals);
	const [posts, asides, resume] = await Promise.all([
		listPosts(locals),
		isLive('/asides')
			? client.findAll<{ slug: string; updatedAt: string }>('aside', {
					fields: ['slug', 'updatedAt']
				})
			: [],
		isLive('/resume')
			? client.get<{ updatedAt: string }>('resume', { fields: ['updatedAt'] })
			: undefined
	]);
	const entries = sitemapEntries({ posts, asides, resumeUpdatedAt: resume?.updatedAt, isLive });
	return new Response(buildSitemap(entries), {
		headers: { 'content-type': 'application/xml; charset=utf-8' }
	});
};
