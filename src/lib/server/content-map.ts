// The content map (#140, CONTEXT.md): which pages show which content types, and what a publish
// changes. Everything that needs to know "post lives under /blog", "a tag edit is live at once" or
// "home shows posts" asks here:
//
// - The Strapi client tags each read with the content types it shows (`readTags`), so the edge
//   cache can purge by content type (docs/adr/0001-purge-by-content-type.md).
// - The purge endpoint asks what a Strapi webhook means (`planPublish`): which tags to purge and
//   which URLs to fetch again afterwards.
// - Read counts ask whether a path is an entry's page (`entryAt`).
//
// Tests keep it honest: the real loads must read exactly what `PAGES` declares, every page route
// must be declared, and the content types, drafts and relations must match the CMS's schemas.

import { isLive } from '$lib/site';

/**
 * The content types the site shows. `api`: Strapi's REST path. `drafts`: has Draft & Publish, so
 * saving isn't a publish. `entries`: where each entry has its own page. `single`: one entry, no list.
 */
export const CONTENT_TYPES = {
	post: { api: 'posts', drafts: true, entries: '/blog' },
	aside: { api: 'asides', drafts: true, entries: '/asides' },
	category: { api: 'categories', drafts: false },
	tag: { api: 'tags', drafts: false },
	profile: { api: 'profile', drafts: false, single: true },
	resume: { api: 'resume', drafts: true, single: true }
} as const;

export type ContentType = keyof typeof CONTENT_TYPES;

/** Content types with one entry: Strapi answers a single object, or 404 until it's saved. */
export type SingleType = {
	[T in ContentType]: (typeof CONTENT_TYPES)[T] extends { single: true } ? T : never;
}[ContentType];

/** Each content type's relations, by the populate key the CMS names them: the type they point at. */
export const RELATIONS: Partial<Record<ContentType, Record<string, ContentType>>> = {
	post: { category: 'category', related: 'post' },
	aside: { tags: 'tag' },
	category: { posts: 'post' },
	tag: { asides: 'aside' }
};

type PageKind = 'page' | 'feed' | 'image';

interface PageInfo {
	/** The content types its content comes from. */
	shows: ContentType[];
	/** A page has page data (`__data.json`) for client-side navigation; feeds and images don't. */
	kind: PageKind;
	/** Fetched again after every publish of what it shows. */
	key?: true;
	/** The nav section it belongs to: not fetched again while that section isn't live. */
	section?: string;
}

/** Every route that shows content, by SvelteKit route id. */
export const PAGES: Record<string, PageInfo> = {
	'/': { shows: ['profile', 'post', 'category'], kind: 'page', key: true },
	'/blog': { shows: ['post', 'category'], kind: 'page', key: true, section: '/blog' },
	'/blog/[slug]': { shows: ['post', 'category'], kind: 'page', section: '/blog' },
	'/asides': { shows: ['aside', 'tag'], kind: 'page', key: true, section: '/asides' },
	'/asides/[slug]': { shows: ['aside', 'tag'], kind: 'page', section: '/asides' },
	'/resume': { shows: ['resume', 'profile'], kind: 'page', key: true, section: '/resume' },
	'/rss.xml': { shows: ['post', 'category'], kind: 'feed', key: true },
	'/sitemap.xml': { shows: ['post', 'category', 'aside', 'resume'], kind: 'feed', key: true },
	'/og/default.png': { shows: ['profile'], kind: 'image' },
	'/og/blog/[slug].png': { shows: ['post', 'category', 'profile'], kind: 'image' },
	'/og/asides/[slug].png': { shows: ['aside', 'tag', 'profile'], kind: 'image' }
};

/** The cache tag for pages that show a content type. */
export const tagOf = (type: ContentType) => `type:${type}`;

/** The content types a Strapi read shows: its own, plus any relation it populates. */
export function readTags(type: ContentType, query: Record<string, unknown> = {}): string[] {
	const tags = new Set([tagOf(type)]);
	const populate = query.populate;
	const keys =
		typeof populate === 'string'
			? [populate]
			: Array.isArray(populate)
				? populate
				: populate && typeof populate === 'object'
					? Object.keys(populate)
					: [];
	for (const key of keys) {
		const related = RELATIONS[type]?.[key];
		if (related) tags.add(tagOf(related));
	}
	return [...tags];
}

/** An entry's page: `/blog/my-post` → the post `my-post`. Anything else is undefined. */
export function entryAt(path: string): { type: 'post' | 'aside'; slug: string } | undefined {
	const match = /^(\/[a-z]+)\/([A-Za-z0-9._~-]{1,200})$/.exec(path);
	if (!match) return undefined;
	const type = (['post', 'aside'] as const).find((t) => CONTENT_TYPES[t].entries === match[1]);
	return type && { type, slug: match[2] };
}

/** `api::post.post` → `post`, for the content types the site shows; anything else is undefined. */
function contentTypeFromUid(uid: unknown): ContentType | undefined {
	const match = typeof uid === 'string' ? /^api::([a-z0-9-]+)\.\1$/.exec(uid) : null;
	return match && Object.hasOwn(CONTENT_TYPES, match[1]) ? (match[1] as ContentType) : undefined;
}

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

const live = (page: PageInfo) => !page.section || isLive(page.section);
const urlsOf = (path: string, page: PageInfo) =>
	page.kind === 'page' ? [path, dataUrl(path)] : [path];

/** Events that are a publish for every content type. */
const LIVE_EVENTS = new Set(['entry.publish', 'entry.unpublish', 'entry.delete']);
/** Saves: a publish for content types without drafts, a draft (nothing to do) for the rest. */
const SAVE_EVENTS = new Set(['entry.create', 'entry.update']);

export type PublishPlan =
	| { action: 'ignore'; reason: string }
	/** `tags` undefined: purge everything. `urls`: fetch again afterwards, pages before feeds. */
	| { action: 'purge'; tags?: string[]; urls: string[] };

/**
 * What a Strapi webhook (`{ event, uid, entry }`, or `{ all: true }`) means for the cache: the
 * pages to purge and the URLs to fetch again: the live key pages that show the content type, the
 * entry's own page, then the feeds.
 */
export function planPublish(body: unknown): PublishPlan {
	if (!body || typeof body !== 'object') return { action: 'ignore', reason: 'no payload' };
	const { all, event, uid, entry } = body as {
		all?: unknown;
		event?: unknown;
		uid?: unknown;
		entry?: { slug?: unknown };
	};

	const keyPages = (shows: (page: PageInfo) => boolean) =>
		Object.entries(PAGES).filter(([, page]) => page.key && live(page) && shows(page));
	const urls = (pages: [string, PageInfo][]) => [
		...pages.filter(([, p]) => p.kind !== 'feed').flatMap(([path, p]) => urlsOf(path, p)),
		...pages.filter(([, p]) => p.kind === 'feed').map(([path]) => path)
	];

	if (all === true) return { action: 'purge', urls: urls(keyPages(() => true)) };
	if (typeof event !== 'string') return { action: 'ignore', reason: 'no event' };
	if (event.startsWith('media.')) return { action: 'ignore', reason: event };

	const type = contentTypeFromUid(uid);
	if (!type) return { action: 'ignore', reason: `${event} on ${String(uid)}` };
	const isPublish =
		LIVE_EVENTS.has(event) || (SAVE_EVENTS.has(event) && !CONTENT_TYPES[type].drafts);
	if (!isPublish) return { action: 'ignore', reason: `${event} on ${type} (draft only)` };

	const pages = keyPages((page) => page.shows.includes(type));
	const route = (CONTENT_TYPES[type] as { entries?: string }).entries;
	const slug = entry?.slug;
	const entryPage = route ? PAGES[`${route}/[slug]`] : undefined;
	// Only slugs Strapi could have made: the webhook body is trusted, but a path is built from it.
	if (entryPage && live(entryPage) && typeof slug === 'string' && /^[a-z0-9-]+$/.test(slug))
		pages.push([`${route}/${slug}`, entryPage]);
	return { action: 'purge', tags: [tagOf(type)], urls: urls(pages) };
}
