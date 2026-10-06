import { describe, expect, it } from 'vitest';
import type { PostSummary } from '$lib/types/content';
import { buildRss, buildSitemap, escapeXml, FEED_SIZE, newest, sitemapEntries } from './feeds';

const post = (n: number, extra: Partial<PostSummary> = {}): PostSummary => ({
	documentId: `d${n}`,
	title: `Post ${n}`,
	slug: `post-${n}`,
	summary: `Summary ${n}`,
	featured: false,
	displayDate: null,
	publishedAt: `2026-09-${String(n).padStart(2, '0')}T10:00:00.000Z`,
	updatedAt: `2026-09-${String(n).padStart(2, '0')}T12:00:00.000Z`,
	category: null,
	...extra
});

describe('escapeXml', () => {
	it('escapes the five XML characters', () => {
		expect(escapeXml(`a & b < c > d "e" 'f'`)).toBe(
			'a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;'
		);
	});
});

describe('buildRss', () => {
	it('has a self link and an item per post with escaped text, dates and category', () => {
		const xml = buildRss([
			post(2, {
				title: 'Tabs & spaces <again>',
				displayDate: '2026-08-15',
				category: { name: 'Q&A', slug: 'qa' } as PostSummary['category']
			})
		]);
		expect(xml).toContain(
			'<atom:link href="https://bhargavshukla.com/rss.xml" rel="self" type="application/rss+xml"/>'
		);
		expect(xml).toContain('<title>Tabs &amp; spaces &lt;again&gt;</title>');
		expect(xml).toContain('<link>https://bhargavshukla.com/blog/post-2</link>');
		expect(xml).toContain('<guid isPermaLink="true">https://bhargavshukla.com/blog/post-2</guid>');
		// The shown date (displayDate), not publishedAt.
		expect(xml).toContain('<pubDate>Sat, 15 Aug 2026 00:00:00 GMT</pubDate>');
		expect(xml).toContain('<category>Q&amp;A</category>');
	});

	it(`carries at most ${FEED_SIZE} posts and no category element without one`, () => {
		const xml = buildRss(Array.from({ length: 25 }, (_, i) => post(i + 1)));
		expect(xml.match(/<item>/g)).toHaveLength(FEED_SIZE);
		expect(xml).not.toContain('<category>');
	});

	it('is still a valid channel with no posts', () => {
		const xml = buildRss([]);
		expect(xml).toContain('<channel>');
		expect(xml).not.toContain('<item>');
		expect(xml).not.toContain('<lastBuildDate>');
	});
});

describe('buildSitemap', () => {
	it('makes absolute, escaped URLs and leaves lastmod out when unknown', () => {
		const xml = buildSitemap([{ path: '/' }, { path: '/blog/a&b', lastmod: '2026-09-01' }]);
		expect(xml).toContain('<url><loc>https://bhargavshukla.com/</loc></url>');
		expect(xml).toContain(
			'<url><loc>https://bhargavshukla.com/blog/a&amp;b</loc><lastmod>2026-09-01</lastmod></url>'
		);
	});
});

describe('newest', () => {
	it('picks the latest ISO date, or nothing for none', () => {
		expect(newest(['2026-01-01T00:00:00Z', '2026-03-01T00:00:00Z', '2026-02-01T00:00:00Z'])).toBe(
			'2026-03-01T00:00:00Z'
		);
		expect(newest([])).toBeUndefined();
	});
});

describe('sitemapEntries', () => {
	const posts = [
		{ slug: 'a', updatedAt: '2026-09-02T00:00:00Z' },
		{ slug: 'b', updatedAt: '2026-09-05T00:00:00Z' }
	];
	const asides = [{ slug: 'x', updatedAt: '2026-09-03T00:00:00Z' }];

	it('lists home, Writing and posts, and leaves hidden sections out', () => {
		const paths = sitemapEntries({
			posts,
			asides,
			resumeUpdatedAt: '2026-09-04T00:00:00Z',
			isLive: (href) => href === '/blog'
		}).map((e) => e.path);
		expect(paths).toEqual(['/', '/blog', '/blog/a', '/blog/b']);
	});

	it('adds Asides, each aside and Resume once live, with lastmod', () => {
		const entries = sitemapEntries({
			posts,
			asides,
			resumeUpdatedAt: '2026-09-04T00:00:00Z',
			isLive: () => true
		});
		expect(entries).toEqual([
			{ path: '/', lastmod: '2026-09-05T00:00:00Z' },
			{ path: '/blog', lastmod: '2026-09-05T00:00:00Z' },
			{ path: '/blog/a', lastmod: '2026-09-02T00:00:00Z' },
			{ path: '/blog/b', lastmod: '2026-09-05T00:00:00Z' },
			{ path: '/asides', lastmod: '2026-09-03T00:00:00Z' },
			{ path: '/asides/x', lastmod: '2026-09-03T00:00:00Z' },
			{ path: '/resume', lastmod: '2026-09-04T00:00:00Z' }
		]);
	});

	it('leaves Resume out while it is unpublished, even when live', () => {
		const paths = sitemapEntries({ posts: [], isLive: () => true }).map((e) => e.path);
		expect(paths).not.toContain('/resume');
	});
});
