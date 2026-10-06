// The Writing page: posts by year, searched by title and filtered by category in the browser, with
// the filters kept in the URL so links, the back button and the no-JS form work too.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';

const { page, replaceState } = vi.hoisted(() => ({
	page: { url: new URL('https://site.test/blog'), state: {} },
	replaceState: vi.fn()
}));
vi.mock('$app/state', async (original) => ({
	...(await original<typeof import('$app/state')>()),
	page
}));
vi.mock('$app/navigation', async (original) => ({
	...(await original<typeof import('$app/navigation')>()),
	replaceState
}));

const { default: Blog } = await import('../blog/+page.svelte');

const leadership = { name: 'Leadership', slug: 'leadership' };
const craft = { name: 'Craft', slug: 'craft' };
const post = (
	slug: string,
	title: string,
	publishedAt: string,
	category = leadership,
	extra = {}
) => ({
	documentId: slug,
	slug,
	title,
	summary: '',
	category,
	publishedAt,
	...extra
});
const POSTS = [
	post('delegation', 'On Delegation', '2026-03-01T00:00:00.000Z'),
	post('code-review', 'Code review that helps', '2026-01-10T00:00:00.000Z', craft),
	post('old', 'An older essay', '2025-06-01T00:00:00.000Z', leadership),
	post('backdated', 'Backdated essay', '2026-02-01T00:00:00.000Z', craft, {
		displayDate: '2024-05-05'
	})
];
const data = (over = {}) =>
	({ posts: POSTS, categories: [leadership, craft], degraded: false, ...over }) as never;

afterEach(() => {
	page.url = new URL('https://site.test/blog');
	replaceState.mockClear();
});

function blog(search = '', over = {}) {
	page.url = new URL(`https://site.test/blog${search}`);
	const view = render(Blog, { data: data(over) });
	const q = view.container.querySelector<HTMLInputElement>('#q')!;
	const select = view.container.querySelector<HTMLSelectElement>('#cat')!;
	const titles = () =>
		[...view.container.querySelectorAll('[data-title-transition]')].map((s) =>
			s.textContent?.trim()
		);
	const years = () => [...view.container.querySelectorAll('h2')].map((h) => h.textContent?.trim());
	const filterLink = (name: string) =>
		[
			...view.container.querySelectorAll<HTMLAnchorElement>(
				'nav[aria-label="Filter by category"] a'
			)
		].find((a) => a.textContent?.trim() === name)!;
	const type = async (value: string) => {
		q.value = value;
		q.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
	};
	return { view, q, select, titles, years, filterLink, type };
}

describe('the list', () => {
	it('groups posts under the year readers see, newest year first', () => {
		const { titles, years } = blog();
		expect(years()).toEqual(['2026', '2025', '2024']);
		expect(titles()).toEqual([
			'On Delegation',
			'Code review that helps',
			'An older essay',
			'Backdated essay'
		]);
	});

	it('links each post to its page', () => {
		const { view } = blog();
		expect(view.container.querySelector('a[href="/blog/delegation"]')).not.toBeNull();
	});

	it('mutes a draft’s title in preview', () => {
		const { view } = blog('', {
			posts: [
				post('wip', 'Work in progress', '2026-01-01T00:00:00.000Z', leadership, { draft: true })
			]
		});
		expect(view.container.querySelector('[data-title-transition]')!.className).toContain(
			'text-muted'
		);
	});
});

describe('search', () => {
	it('keeps the posts whose titles match, ignoring case and surrounding spaces', async () => {
		const { type, titles, years } = blog();
		await type('  DELEGAT ');
		expect(titles()).toEqual(['On Delegation']);
		expect(years()).toEqual(['2026']);
	});

	it('starts from ?q=', () => {
		const { q, titles } = blog('?q=review');
		expect(q.value).toBe('review');
		expect(titles()).toEqual(['Code review that helps']);
	});

	it('says nothing matches, and Clear filters brings every post back', async () => {
		const { view, type, titles, q } = blog();
		await type('zzz');
		expect(view.container.textContent).toContain('No posts match those filters.');
		view.container.querySelector<HTMLButtonElement>('button.link-cta')!.click();
		await tick();
		expect(q.value).toBe('');
		expect(titles()).toHaveLength(4);
	});
});

describe('categories', () => {
	it('filters from the phone select', async () => {
		const { select, titles } = blog();
		select.value = 'craft';
		select.dispatchEvent(new Event('change', { bubbles: true }));
		await tick();
		expect(titles()).toEqual(['Code review that helps', 'Backdated essay']);
	});

	it('filters in place from a link, without leaving the page, and marks it current', async () => {
		const { filterLink, titles } = blog();
		const click = new MouseEvent('click', { bubbles: true, cancelable: true });
		filterLink('Leadership').dispatchEvent(click);
		await tick();
		expect(click.defaultPrevented).toBe(true);
		expect(titles()).toEqual(['On Delegation', 'An older essay']);
		expect(filterLink('Leadership').getAttribute('aria-current')).toBe('true');
		expect(filterLink('All').getAttribute('aria-current')).toBeNull();
	});

	it('starts from ?cat=', () => {
		const { titles, select } = blog('?cat=leadership');
		expect(select.value).toBe('leadership');
		expect(titles()).toEqual(['On Delegation', 'An older essay']);
	});

	it('gives each link a URL that works without JavaScript, keeping the search', () => {
		const { filterLink } = blog('?q=on');
		expect(filterLink('All').getAttribute('href')).toBe('/blog?q=on');
		expect(filterLink('Craft').getAttribute('href')).toBe('/blog?q=on&cat=craft');
	});

	it('combines a category with a search', async () => {
		const { type, titles, filterLink } = blog();
		filterLink('Craft').click();
		await type('essay');
		expect(titles()).toEqual(['Backdated essay']);
	});
});

describe('the URL', () => {
	it('mirrors the filters without navigating, and drops them when cleared', async () => {
		const { type, filterLink } = blog();
		expect(replaceState).not.toHaveBeenCalled(); // nothing to change on load
		await type('review');
		await vi.waitFor(() =>
			expect(replaceState).toHaveBeenLastCalledWith('/blog?q=review', page.state)
		);
		filterLink('Craft').click();
		await vi.waitFor(() =>
			expect(replaceState).toHaveBeenLastCalledWith('/blog?q=review&cat=craft', page.state)
		);
		await type('');
		page.url = new URL('https://site.test/blog?q=review&cat=craft');
		filterLink('All').click();
		await vi.waitFor(() => expect(replaceState).toHaveBeenLastCalledWith('/blog', page.state));
	});
});

describe('when there are no posts', () => {
	it('says nothing is published yet, with nothing to clear', () => {
		const { view } = blog('', { posts: [] });
		expect(view.container.textContent).toContain('Nothing published yet.');
		expect(view.container.querySelector('button.link-cta')).toBeNull();
	});

	it('says the posts can’t load when the CMS is down', () => {
		const { view } = blog('', { posts: [], degraded: true });
		expect(view.container.textContent).toContain("Posts can't load right now.");
	});
});
