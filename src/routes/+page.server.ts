import { homePosts } from '$lib/server/posts';
import { getProfile } from '$lib/server/profile';
import type { PageServerLoad } from './$types';

// The page must render even when Strapi is unreachable (or the profile isn't saved yet): the
// intro then falls back to the name alone and the posts section is left out.
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
		homePosts(locals, { drafts: locals.preview }).catch(
			fallback({ heading: 'Featured', posts: [] })
		)
	]);

	degraded ||= !profile;
	// Never edge-cache the degraded page or its data (#16, #108): it would hide the posts for the
	// whole TTL.
	if (degraded) locals.noStore = true;
	return { profile, home, degraded };
};
