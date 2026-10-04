import { describe, expect, it, vi } from 'vitest';
import { dataUrl, repopulate, urlsToRepopulate } from './repopulate';

describe('dataUrl', () => {
	it('spells page data exactly as the SvelteKit client asks for it', () => {
		expect(dataUrl('/')).toBe(
			'/__data.json?x-sveltekit-trailing-slash=1&x-sveltekit-invalidated=01'
		);
		expect(dataUrl('/blog')).toBe('/blog/__data.json?x-sveltekit-invalidated=01');
	});
});

describe('urlsToRepopulate', () => {
	const keyPages = [
		'/',
		dataUrl('/'),
		'/blog',
		dataUrl('/blog'),
		'/asides',
		dataUrl('/asides'),
		'/resume',
		dataUrl('/resume')
	];
	const feeds = ['/rss.xml', '/sitemap.xml'];

	it('always has the key pages, their data and the feeds', () => {
		expect(urlsToRepopulate({ action: 'tags', tags: ['type:profile'] }, {})).toEqual([
			...keyPages,
			...feeds
		]);
		expect(urlsToRepopulate({ action: 'everything' }, { all: true })).toEqual([
			...keyPages,
			...feeds
		]);
	});

	it('adds a post or aside’s own page from the webhook', () => {
		const post = { entry: { slug: 'hello-world' } };
		expect(urlsToRepopulate({ action: 'tags', tags: ['type:post'] }, post)).toEqual([
			...keyPages,
			'/blog/hello-world',
			dataUrl('/blog/hello-world'),
			...feeds
		]);
		expect(urlsToRepopulate({ action: 'tags', tags: ['type:aside'] }, post)).toContain(
			'/asides/hello-world'
		);
	});

	it('ignores slugs it can’t trust and models without their own pages', () => {
		const odd = { entry: { slug: '../admin' } };
		expect(urlsToRepopulate({ action: 'tags', tags: ['type:post'] }, odd)).toHaveLength(10);
		const tag = { entry: { slug: 'svelte' } };
		expect(urlsToRepopulate({ action: 'tags', tags: ['type:tag'] }, tag)).toHaveLength(10);
	});
});

describe('repopulate', () => {
	it('fetches every URL, a few at a time, and reports failures', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		let inFlight = 0;
		let most = 0;
		const fetchPage = async (path: string) => {
			most = Math.max(most, ++inFlight);
			await new Promise((r) => setTimeout(r, 1));
			inFlight--;
			return new Response('x', { status: path === '/broken' ? 500 : 200 });
		};
		const urls = ['/', '/blog', '/asides', '/resume', '/broken', '/rss.xml'];

		const result = await repopulate(urls, fetchPage, 2);

		expect(result).toEqual({ ok: 5, failed: ['/broken'] });
		expect(most).toBe(2);
	});

	it('counts a thrown fetch as a failure and carries on', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		const fetchPage = async (path: string) => {
			if (path === '/blog') throw new Error('offline');
			return new Response('x');
		};
		expect(await repopulate(['/', '/blog'], fetchPage)).toEqual({ ok: 1, failed: ['/blog'] });
	});
});
