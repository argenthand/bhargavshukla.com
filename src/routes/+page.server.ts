import { homePosts } from '$lib/server/posts';
import { getProfile } from '$lib/server/profile';
import type { PageServerLoad } from './$types';

// The page must render even when Strapi is unreachable (or the profile isn't saved yet): the
// intro then falls back to the name alone and the posts section is left out. #16 must not
// edge-cache a degraded page.
export const load: PageServerLoad = async ({ locals }) => {
	let degraded = false;
	const fallback =
		<T>(value: T) =>
		(err: unknown) => {
			console.error('Home: content unavailable', err);
			degraded = true;
			return value;
		};

	const [profile, home] = await Promise.all([
		getProfile(locals).catch(fallback(undefined)),
		homePosts(locals).catch(fallback({ heading: 'Featured', posts: [] }))
	]);

	return { profile, home, degraded: degraded || !profile };
};
