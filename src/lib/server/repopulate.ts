// Repopulate after a purge (#123, docs/caching.md → Purge endpoint): fetch the key pages again
// through Workers Cache, so the next visitor gets the new version from cache instead of being
// the one who renders it. Pages not listed here render on their next visit, as before.

import type { PurgePlan } from './purge';

/** Pages kept warm: home, the two lists and the resume, plus the feeds. */
export const KEY_PAGES = ['/', '/blog', '/asides', '/resume'];
const FEEDS = ['/rss.xml', '/sitemap.xml'];

/** Where each content type's own pages live. */
const ENTRY_ROUTES: Partial<Record<string, string>> = { post: '/blog', aside: '/asides' };

/**
 * The page data a client-side navigation to `path` fetches, spelled exactly as SvelteKit's client
 * does: Workers Cache keys on the query string verbatim, order included. `01` = the root layout's
 * data is reused, only the page's is new (every navigation between these pages).
 */
export function dataUrl(path: string): string {
	return path === '/'
		? '/__data.json?x-sveltekit-trailing-slash=1&x-sveltekit-invalidated=01'
		: `${path}/__data.json?x-sveltekit-invalidated=01`;
}

/** The entry's own page from a Strapi webhook body (`{ uid, entry: { slug } }`), if it has one. */
function entryPage(plan: Exclude<PurgePlan, { action: 'ignore' }>, body: unknown): string | null {
	if (plan.action !== 'tags') return null;
	const model = plan.tags[0]?.replace(/^type:/, '');
	const route = model ? ENTRY_ROUTES[model] : undefined;
	const slug = (body as { entry?: { slug?: unknown } } | null)?.entry?.slug;
	return route && typeof slug === 'string' && /^[a-z0-9-]+$/.test(slug) ? `${route}/${slug}` : null;
}

/** Every URL to fetch after a purge: each page and its data, then the feeds. */
export function urlsToRepopulate(
	plan: Exclude<PurgePlan, { action: 'ignore' }>,
	body: unknown
): string[] {
	const entry = entryPage(plan, body);
	const pages = entry ? [...KEY_PAGES, entry] : KEY_PAGES;
	return [...pages.flatMap((path) => [path, dataUrl(path)]), ...FEEDS];
}

/**
 * Fetches each URL (a few at a time, so Strapi isn't flooded) and logs what Workers Cache said.
 * `fetchPage` goes through the Worker's own cache: a loopback request, not the public internet.
 */
export async function repopulate(
	urls: string[],
	fetchPage: (path: string) => Promise<Response>,
	concurrency = 4
): Promise<{ ok: number; failed: string[] }> {
	const queue = [...urls];
	const failed: string[] = [];
	let ok = 0;
	const statuses: string[] = [];
	async function worker() {
		for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
			try {
				const res = await fetchPage(path);
				await res.arrayBuffer(); // read it all, so the response is stored
				statuses.push(`${path} ${res.status} ${res.headers.get('cf-cache-status') ?? '-'}`);
				if (res.ok) ok++;
				else failed.push(path);
			} catch (err) {
				failed.push(path);
				statuses.push(`${path} error ${String(err)}`);
			}
		}
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
	console.log(`Repopulate: ${ok}/${urls.length} ok. ${statuses.join('; ')}`);
	return { ok, failed };
}
