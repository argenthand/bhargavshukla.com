// Per-page metadata: the title, canonical URL, Open Graph and Twitter cards in <head>.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const { page } = vi.hoisted(() => ({ page: { url: new URL('https://preview.test/blog/a?q=x') } }));
vi.mock('$app/state', async (original) => ({
	...(await original<typeof import('$app/state')>()),
	page
}));

const { default: Seo } = await import('../../components/Seo.svelte');

afterEach(() => {
	page.url = new URL('https://preview.test/blog/a?q=x');
});

const meta = (selector: string) =>
	document.head.querySelector<HTMLMetaElement>(`meta[${selector}]`)?.content;
const canonical = () => document.head.querySelector<HTMLLinkElement>('link[rel=canonical]')?.href;

describe('<Seo>', () => {
	it('puts the site name after a page’s title, and alone on the home page', () => {
		const post = render(Seo, { title: 'A post', description: 'About it' });
		expect(document.title).toBe('A post · Bhargav Shukla');
		expect(meta('property="og:title"')).toBe('A post');
		expect(meta('name="twitter:title"')).toBe('A post');
		post.unmount();
		render(Seo, { description: 'Home' });
		expect(document.title).toBe('Bhargav Shukla');
	});

	it('tidies the description’s whitespace for every card', () => {
		render(Seo, { title: 'T', description: '  Two\n  lines   here ' });
		expect(meta('name="description"')).toBe('Two lines here');
		expect(meta('property="og:description"')).toBe('Two lines here');
		expect(meta('name="twitter:description"')).toBe('Two lines here');
	});

	it('uses the production origin and drops the query string for the canonical URL', () => {
		render(Seo, { title: 'T', description: 'D' });
		expect(canonical()).toBe('https://bhargavshukla.com/blog/a');
		expect(meta('property="og:url"')).toBe('https://bhargavshukla.com/blog/a');
	});

	it('uses the original’s address for a cross-post', () => {
		render(Seo, { title: 'T', description: 'D', canonical: 'https://elsewhere.test/a' });
		expect(canonical()).toBe('https://elsewhere.test/a');
		expect(meta('property="og:url"')).toBe('https://elsewhere.test/a');
	});

	it('asks search engines to skip a noindex page, and gives it no canonical link', () => {
		render(Seo, { title: 'Not found', description: 'D', noindex: true });
		expect(meta('name="robots"')).toBe('noindex');
		expect(canonical()).toBeUndefined();
	});

	it('leaves the robots tag off an ordinary page', () => {
		render(Seo, { title: 'T', description: 'D' });
		expect(meta('name="robots"')).toBeUndefined();
	});

	it('is a website unless it has an article, which adds its dates and section', () => {
		const plain = render(Seo, { title: 'T', description: 'D' });
		expect(meta('property="og:type"')).toBe('website');
		expect(meta('property="article:published_time"')).toBeUndefined();
		plain.unmount();
		render(Seo, {
			title: 'T',
			description: 'D',
			article: { publishedTime: '2026-01-01', modifiedTime: '2026-02-01', section: 'Leadership' }
		});
		expect(meta('property="og:type"')).toBe('article');
		expect(meta('property="article:published_time"')).toBe('2026-01-01');
		expect(meta('property="article:modified_time"')).toBe('2026-02-01');
		expect(meta('property="article:section"')).toBe('Leadership');
	});

	it('leaves out an article’s modified time and section when it has none', () => {
		render(Seo, { title: 'T', description: 'D', article: { publishedTime: '2026-01-01' } });
		expect(meta('property="article:modified_time"')).toBeUndefined();
		expect(meta('property="article:section"')).toBeUndefined();
	});

	it('shares the site card when the page has no image of its own', () => {
		render(Seo, { title: 'T', description: 'D' });
		expect(meta('property="og:image"')).toBe('https://bhargavshukla.com/og/default.png');
		expect(meta('property="og:image:width"')).toBe('1200');
		expect(meta('property="og:image:height"')).toBe('630');
		expect(meta('name="twitter:card"')).toBe('summary_large_image');
	});

	it('shares the page’s own image, with its alt text and size when it has them', () => {
		render(Seo, {
			title: 'T',
			description: 'D',
			image: { url: 'https://cdn.test/cover.jpg', alt: 'A cover', width: 800, height: 400 }
		});
		expect(meta('property="og:image"')).toBe('https://cdn.test/cover.jpg');
		expect(meta('name="twitter:image"')).toBe('https://cdn.test/cover.jpg');
		expect(meta('property="og:image:alt"')).toBe('A cover');
		expect(meta('name="twitter:image:alt"')).toBe('A cover');
		expect(meta('property="og:image:width"')).toBe('800');
	});

	it('leaves out an image’s alt text and size when it has none', () => {
		render(Seo, { title: 'T', description: 'D', image: { url: 'https://cdn.test/cover.jpg' } });
		expect(meta('property="og:image"')).toBe('https://cdn.test/cover.jpg');
		expect(meta('property="og:image:alt"')).toBeUndefined();
		expect(meta('property="og:image:width"')).toBeUndefined();
	});
});
