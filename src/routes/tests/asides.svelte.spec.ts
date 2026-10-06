// The Asides stream: filtered by kind and tag and paged from the URL, so links, the back button and
// the no-JS form all work.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const { page, goto } = vi.hoisted(() => ({
	page: { url: new URL('https://site.test/asides') },
	goto: vi.fn()
}));
vi.mock('$app/state', async (original) => ({
	...(await original<typeof import('$app/state')>()),
	page
}));
vi.mock('$app/navigation', async (original) => ({
	...(await original<typeof import('$app/navigation')>()),
	goto
}));

const { default: Asides } = await import('../asides/+page.svelte');

const tip = { name: 'Testing', slug: 'testing' };
const aside = (n: number, over = {}) => ({
	documentId: `a${n}`,
	slug: `aside-${n}`,
	kind: 'tip',
	title: `Aside ${n}`,
	html: `<p>Body ${n}</p>`,
	label: `Aside ${n}`,
	tags: [],
	sourceAuthor: null,
	sourceTitle: null,
	sourceUrl: null,
	publishedAt: `2026-01-${String(30 - n).padStart(2, '0')}T00:00:00.000Z`,
	...over
});

afterEach(() => {
	page.url = new URL('https://site.test/asides');
	goto.mockClear();
});

function stream(asides: unknown[], search = '', degraded = false) {
	page.url = new URL(`https://site.test/asides${search}`);
	const view = render(Asides, { data: { asides, degraded } as never });
	const titles = () =>
		[...view.container.querySelectorAll('article h2, article h1')].map((h) =>
			h.textContent?.trim()
		);
	const link = (selector: string, text: string) =>
		[...view.container.querySelectorAll<HTMLAnchorElement>(selector)].find((a) =>
			a.textContent?.includes(text)
		);
	const text = () => (view.container.textContent ?? '').replace(/\s+/g, ' ');
	return { view, titles, link, text };
}

const MIXED = [
	aside(1, { kind: 'quote', tags: [tip] }),
	aside(2, { kind: 'code', tags: [tip] }),
	aside(3, { kind: 'tip' }),
	aside(4, { kind: 'quote' })
];
const MANY = Array.from({ length: 21 }, (_, i) => aside(i + 1));

describe('the stream', () => {
	it('shows every aside in the order given', () => {
		expect(stream(MIXED).titles()).toEqual(['Aside 1', 'Aside 2', 'Aside 3', 'Aside 4']);
	});

	it('filters by kind from ?kind=, and marks it current', () => {
		const { titles, link } = stream(MIXED, '?kind=quote');
		expect(titles()).toEqual(['Aside 1', 'Aside 4']);
		expect(link('nav[aria-label="Filter by kind"] a', 'Quotes')!.getAttribute('aria-current')).toBe(
			'true'
		);
		expect(
			link('nav[aria-label="Filter by kind"] a', 'All')!.getAttribute('aria-current')
		).toBeNull();
	});

	it('ignores a kind it does not know', () => {
		expect(stream(MIXED, '?kind=bogus').titles()).toHaveLength(4);
	});

	it('filters by tag, says so with a count, and offers to clear it', () => {
		const { titles, text, link } = stream(MIXED, '?tag=testing');
		expect(titles()).toEqual(['Aside 1', 'Aside 2']);
		expect(text()).toContain('2 asides');
		expect(text()).toContain('tagged');
		expect(text()).toContain('Testing');
		expect(link('a', 'Clear')!.getAttribute('href')).toBe('/asides');
	});

	it('combines a tag with a kind, in the count’s words', () => {
		const { titles, text } = stream(MIXED, '?kind=quote&tag=testing');
		expect(titles()).toEqual(['Aside 1']);
		expect(text()).toContain('1 quote tagged');
	});

	it('keeps the tag when the kind changes, and the kind when the tag is cleared', () => {
		const { link } = stream(MIXED, '?kind=quote&tag=testing');
		expect(link('nav a', 'Code')!.getAttribute('href')).toBe('/asides?kind=code&tag=testing');
		expect(link('a', 'Clear')!.getAttribute('href')).toBe('/asides?kind=quote');
	});

	it('names an unknown tag by its slug, with nothing under it', () => {
		const { text, titles } = stream(MIXED, '?tag=nothing');
		expect(titles()).toEqual([]);
		expect(text()).toContain('Asides tagged');
		expect(text()).toContain('nothing');
	});

	it('changes the kind from the phone select without a new history entry or scroll', () => {
		const { view } = stream(MIXED);
		const select = view.container.querySelector<HTMLSelectElement>('#kind')!;
		select.value = 'quote';
		select.dispatchEvent(new Event('change', { bubbles: true }));
		expect(goto).toHaveBeenCalledWith('/asides?kind=quote', {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	});
});

describe('paging', () => {
	it('shows twenty to a page, with a link to the older ones', () => {
		const { titles, link } = stream(MANY);
		expect(titles()).toHaveLength(20);
		expect(link('nav[aria-label="Pages"] a', 'Older')!.getAttribute('href')).toBe('/asides?page=2');
		expect(link('nav[aria-label="Pages"] a', 'Newer')).toBeUndefined();
	});

	it('shows the rest on the last page, with a link back', () => {
		const { titles, link } = stream(MANY, '?page=2');
		expect(titles()).toEqual(['Aside 21']);
		expect(link('nav[aria-label="Pages"] a', 'Newer')!.getAttribute('href')).toBe('/asides');
		expect(link('nav[aria-label="Pages"] a', 'Older')).toBeUndefined();
	});

	it('treats a page number that makes no sense as the first', () => {
		for (const search of ['?page=0', '?page=-3', '?page=abc']) {
			expect(stream(MANY, search).titles()).toHaveLength(20);
		}
	});

	it('has no paging for a short stream', () => {
		expect(stream(MIXED).view.container.querySelector('nav[aria-label="Pages"]')).toBeNull();
	});

	it('keeps the filters in the page links', () => {
		const many = Array.from({ length: 25 }, (_, i) => aside(i + 1, { kind: 'quote' }));
		const { link } = stream(many, '?kind=quote');
		expect(link('nav[aria-label="Pages"] a', 'Older')!.getAttribute('href')).toBe(
			'/asides?kind=quote&page=2'
		);
	});
});

describe('when there is nothing to show', () => {
	it('says so, with a link back to everything when a filter hid them', () => {
		const { text, link } = stream(MIXED, '?kind=thought');
		expect(text()).toContain('Nothing here yet.');
		expect(link('a', 'See all asides')!.getAttribute('href')).toBe('/asides');
	});

	it('has no link back when there are no asides at all', () => {
		const { text, link } = stream([]);
		expect(text()).toContain('Nothing here yet.');
		expect(link('a', 'See all asides')).toBeUndefined();
	});

	it('says they can’t load when the CMS is down', () => {
		expect(stream([], '', true).text()).toContain("Asides can't load right now.");
	});
});
