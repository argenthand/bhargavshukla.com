// The error page: 404 with a line per broken link, 5xx with a retry, never indexed.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const { page, isLive } = vi.hoisted(() => ({
	page: { status: 404, url: new URL('https://site.test/nope'), error: null as unknown },
	isLive: vi.fn(() => true)
}));
vi.mock('$app/state', async (original) => ({
	...(await original<typeof import('$app/state')>()),
	page
}));
vi.mock('$lib/site', async (original) => ({
	...(await original<typeof import('$lib/site')>()),
	isLive
}));

const { default: ErrorPage } = await import('../+error.svelte');
const { notFoundLine } = await import('$lib/look');

afterEach(() => {
	Object.assign(page, { status: 404, url: new URL('https://site.test/nope') });
	isLive.mockReturnValue(true);
});

const robots = () => document.head.querySelector<HTMLMetaElement>('meta[name=robots]')?.content;

describe('a 404', () => {
	it('says the page isn’t here, in the label and the heading', () => {
		const view = render(ErrorPage);
		expect(view.container.textContent).toContain('404 · Not found');
		expect(view.container.querySelector('h1')!.textContent).toBe("This page isn't here");
	});

	it('adds the line for this path, the same one every time', () => {
		const view = render(ErrorPage);
		expect(view.container.querySelector('.standfirst')!.textContent).toBe(notFoundLine('/nope'));
		view.unmount();
		page.url = new URL('https://site.test/another/missing/page');
		const other = render(ErrorPage);
		expect(other.container.querySelector('.standfirst')!.textContent).toBe(
			notFoundLine('/another/missing/page')
		);
	});

	it('points to the writing index and the home page', () => {
		const view = render(ErrorPage);
		const links = [...view.container.querySelectorAll('a')].map((a) => [
			a.textContent?.trim(),
			a.getAttribute('href')
		]);
		expect(links).toEqual([
			['Browse writing', '/blog'],
			['Go home', '/']
		]);
		expect(view.container.textContent).toContain('Try the writing index');
	});

	it('only offers the home page while Writing is not live', () => {
		isLive.mockReturnValue(false);
		const view = render(ErrorPage);
		expect([...view.container.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
			'/'
		]);
		expect(view.container.textContent).toContain('Start from the home page.');
		expect(view.container.textContent).not.toContain('writing index');
	});

	it('asks search engines to skip it', () => {
		render(ErrorPage);
		expect(robots()).toBe('noindex');
		expect(document.title).toBe('Not found · Bhargav Shukla');
	});
});

describe('a server error', () => {
	it('says it was on our end and offers a fresh request of the same URL', () => {
		page.status = 500;
		page.url = new URL('https://site.test/blog/a?x=1');
		const view = render(ErrorPage);
		expect(view.container.textContent).toContain('500 · Server error');
		expect(view.container.querySelector('h1')!.textContent).toBe('Something broke on my end');
		const retry = [...view.container.querySelectorAll('a')].find((a) =>
			a.textContent?.includes('Try again')
		)!;
		expect(retry.getAttribute('href')).toBe('https://site.test/blog/a?x=1');
		expect(retry.hasAttribute('data-sveltekit-reload')).toBe(true);
	});

	it('has no broken-link line or writing link, and is not indexed', () => {
		page.status = 503;
		const view = render(ErrorPage);
		expect(view.container.querySelector('.standfirst')).toBeNull();
		expect(view.container.textContent).not.toContain('Browse writing');
		expect(robots()).toBe('noindex');
		expect(document.title).toBe('Something broke · Bhargav Shukla');
	});
});
