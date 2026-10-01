// RSS 2.0 for the newest posts (#56). Reads posts and categories through strapi(), so the edge
// cache stores it tagged type:post,type:category and publishing a post purges it (#17).
import { buildRss } from '$lib/server/feeds';
import { listPosts } from '$lib/server/posts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const posts = await listPosts(locals);
	return new Response(buildRss(posts), {
		headers: { 'content-type': 'application/rss+xml; charset=utf-8' }
	});
};
