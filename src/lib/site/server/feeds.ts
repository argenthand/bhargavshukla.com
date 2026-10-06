// RSS feed and sitemap (#56): plain XML strings from content the routes have already fetched.
// Links use the production origin (site.url), like canonical URLs.

import { shownDate } from '$lib/format';
import { site } from '../site';
import type { PostSummary } from '$lib/types/content';

/** How many posts the feed carries. */
export const FEED_SIZE = 20;

export const escapeXml = (s: string) =>
	s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');

const absolute = (path: string) => new URL(path, site.url).href;

/** RFC 822 dates, as RSS 2.0 wants them. */
const rfc822 = (iso: string) => new Date(iso).toUTCString();

/** RSS 2.0 for the newest posts. `posts` must already be newest first by shown date. */
export function buildRss(posts: PostSummary[]): string {
	const latest = posts.slice(0, FEED_SIZE);
	const items = latest.map((post) => {
		const link = absolute(`/blog/${post.slug}`);
		return [
			'<item>',
			`<title>${escapeXml(post.title)}</title>`,
			`<link>${link}</link>`,
			`<guid isPermaLink="true">${link}</guid>`,
			`<description>${escapeXml(post.summary ?? '')}</description>`,
			`<pubDate>${rfc822(shownDate(post))}</pubDate>`,
			post.category ? `<category>${escapeXml(post.category.name)}</category>` : '',
			'</item>'
		].join('');
	});
	const built = latest[0] ? `<lastBuildDate>${rfc822(shownDate(latest[0]))}</lastBuildDate>` : '';
	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${escapeXml(site.name)}</title>
<link>${absolute('/')}</link>
<description>${escapeXml(site.description)}</description>
<language>en</language>
<atom:link href="${absolute('/rss.xml')}" rel="self" type="application/rss+xml"/>
${built}
${items.join('\n')}
</channel>
</rss>
`;
}

export interface SitemapEntry {
	path: string;
	/** ISO date or date-time; left out when unknown. */
	lastmod?: string;
}

export function buildSitemap(entries: SitemapEntry[]): string {
	const urls = entries.map(
		({ path, lastmod }) =>
			`<url><loc>${escapeXml(absolute(path))}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`
	);
	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
}

/** The newest of some ISO timestamps, for a list page's lastmod. */
export const newest = (dates: string[]) =>
	dates.reduce<string | undefined>((a, b) => (!a || b > a ? b : a), undefined);

/**
 * Every page that returns 200: home, Writing and each post; Asides (with each aside) and Resume
 * only while their section is live (`isLive`), so the sitemap never lists a hidden page.
 */
export function sitemapEntries(content: {
	posts: Pick<PostSummary, 'slug' | 'updatedAt'>[];
	asides?: { slug: string; updatedAt: string }[];
	resumeUpdatedAt?: string;
	isLive: (href: string) => boolean;
}): SitemapEntry[] {
	const { posts, asides = [], resumeUpdatedAt, isLive } = content;
	const latestPost = newest(posts.map((p) => p.updatedAt));
	const entries: SitemapEntry[] = [
		{ path: '/', lastmod: latestPost },
		{ path: '/blog', lastmod: latestPost },
		...posts.map((p) => ({ path: `/blog/${p.slug}`, lastmod: p.updatedAt }))
	];
	if (isLive('/asides')) {
		entries.push(
			{ path: '/asides', lastmod: newest(asides.map((a) => a.updatedAt)) },
			...asides.map((a) => ({ path: `/asides/${a.slug}`, lastmod: a.updatedAt }))
		);
	}
	if (isLive('/resume') && resumeUpdatedAt)
		entries.push({ path: '/resume', lastmod: resumeUpdatedAt });
	return entries;
}
