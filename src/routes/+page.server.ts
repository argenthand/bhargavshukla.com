import { homePosts } from '$lib/server/posts';
import type { PageServerLoad } from './$types';

// The intro must render even when Strapi is unreachable (or, before #15, not configured in
// production): the posts section is then left out. #16 must not edge-cache that degraded page.
export const load: PageServerLoad = async ({ locals }) => {
	try {
		return { home: await homePosts(locals), degraded: false };
	} catch (err) {
		console.error('Home: posts unavailable', err);
		return { home: { heading: 'Featured', posts: [] }, degraded: true };
	}
};
