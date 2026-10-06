// The table of contents: the section being read is current, and in the sheet below lg, choosing
// an entry closes it and moves to the heading.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const { default: Toc } = await import('../../components/Toc.svelte');

const headings = [
	{ id: 'one', text: 'One', level: 2 },
	{ id: 'two', text: 'Two', level: 2 },
	{ id: 'three', text: 'Three', level: 3 }
] as never;

/** A page tall enough to scroll, with each heading where `tops` says (px from the page top). */
function article(tops = [200, 1500, 3000]) {
	const page = document.body.appendChild(document.createElement('div'));
	page.style.cssText = 'position:relative;height:6000px';
	for (const [i, id] of ['one', 'two', 'three'].entries()) {
		const h = page.appendChild(document.createElement('h2'));
		h.id = id;
		h.tabIndex = -1; // as the article's headings are, so they can take focus
		h.style.cssText = `position:absolute;top:${tops[i]}px;margin:0`;
		h.textContent = id;
	}
	return page;
}

afterEach(() => {
	scrollTo(0, 0);
	vi.restoreAllMocks();
	document.querySelectorAll('body > div[style*="6000px"]').forEach((el) => el.remove());
});

const current = (container: Element) =>
	container.querySelector('a[aria-current=location]')?.textContent?.trim();
const scrollToHeading = (id: string, offset = 50) =>
	scrollTo(0, document.getElementById(id)!.offsetTop - offset);

describe('the sidebar', () => {
	it('lists every heading, the third-level ones set in', () => {
		article();
		const view = render(Toc, { headings, variant: 'sidebar' });
		const links = [...view.container.querySelectorAll('a')];
		expect(links.map((a) => a.textContent?.trim())).toEqual(['One', 'Two', 'Three']);
		expect(links.map((a) => a.getAttribute('href'))).toEqual(['#one', '#two', '#three']);
		expect(links.map((a) => a.dataset.level)).toEqual(['2', '2', '3']);
	});

	it('marks the first entry current before any heading is reached', () => {
		article();
		const view = render(Toc, { headings, variant: 'sidebar' });
		expect(current(view.container)).toBe('One');
	});

	it('follows the reader down the page, and back up', async () => {
		article();
		const view = render(Toc, { headings, variant: 'sidebar' });
		scrollToHeading('two');
		await expect.poll(() => current(view.container)).toBe('Two');
		scrollToHeading('three');
		await expect.poll(() => current(view.container)).toBe('Three');
		scrollToHeading('one');
		await expect.poll(() => current(view.container)).toBe('One');
	});

	it('lands on the right entry after a jump that skips headings', async () => {
		article();
		const view = render(Toc, { headings, variant: 'sidebar' });
		scrollToHeading('three');
		await expect.poll(() => current(view.container)).toBe('Three');
	});

	it('stops listening to the page once it is gone', async () => {
		article();
		const remove = vi.spyOn(window, 'removeEventListener');
		const view = render(Toc, { headings, variant: 'sidebar' });
		view.unmount();
		expect(remove.mock.calls.map(([type]) => type)).toEqual(
			expect.arrayContaining(['scroll', 'resize'])
		);
	});

	it('copes with a heading that is not on the page', () => {
		const view = render(Toc, { headings, variant: 'sidebar' }); // no article at all
		expect(current(view.container)).toBe('One');
	});
});

describe('the pill and its sheet', () => {
	const open = (view: ReturnType<typeof render>) => {
		const dialog = view.container.ownerDocument.querySelector('dialog')!;
		view.container.querySelector<HTMLButtonElement>('button[aria-haspopup=dialog]')!.click();
		return dialog;
	};

	it('names the section being read, and opens the sheet', async () => {
		article();
		const view = render(Toc, { headings, variant: 'pill' });
		const pill = view.container.querySelector('button[aria-haspopup=dialog]')!;
		expect(pill.textContent).toContain('One');
		scrollToHeading('two');
		await expect.poll(() => pill.textContent).toContain('Two');
		expect(open(view).open).toBe(true);
	});

	it('closes the sheet, scrolls to the heading and moves focus there when an entry is chosen', () => {
		article();
		const view = render(Toc, { headings, variant: 'pill' });
		const dialog = open(view);
		const target = document.getElementById('two')!;
		const scrollIntoView = vi.spyOn(target, 'scrollIntoView').mockImplementation(() => {});
		const event = new MouseEvent('click', { bubbles: true, cancelable: true });
		dialog.querySelector<HTMLAnchorElement>('a[href="#two"]')!.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
		expect(dialog.open).toBe(false);
		expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
		expect(document.activeElement).toBe(target);
	});

	it('jumps rather than glides with reduced motion', () => {
		article();
		vi.spyOn(window, 'matchMedia').mockImplementation(
			(query) => ({ matches: query.includes('reduce') }) as MediaQueryList
		);
		const view = render(Toc, { headings, variant: 'pill' });
		const dialog = open(view);
		const scrollIntoView = vi
			.spyOn(document.getElementById('three')!, 'scrollIntoView')
			.mockImplementation(() => {});
		dialog.querySelector<HTMLAnchorElement>('a[href="#three"]')!.click();
		expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
	});

	it('still closes the sheet when the heading is not on the page', () => {
		const view = render(Toc, { headings, variant: 'pill' });
		const dialog = open(view);
		dialog.querySelector<HTMLAnchorElement>('a[href="#two"]')!.click();
		expect(dialog.open).toBe(false);
	});

	it('closes on the × and on a click on the backdrop', () => {
		article();
		const view = render(Toc, { headings, variant: 'pill' });
		const dialog = open(view);
		dialog.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click();
		expect(dialog.open).toBe(false);
		open(view);
		dialog.dispatchEvent(new MouseEvent('click', { bubbles: true })); // lands on the <dialog> itself
		expect(dialog.open).toBe(false);
	});

	it('also has the plain, collapsed list for a visitor without JavaScript', () => {
		const view = render(Toc, { headings, variant: 'pill' });
		const details = view.container.querySelector('details')!;
		expect(details.querySelectorAll('a')).toHaveLength(3);
		expect(details.open).toBe(false);
	});
});
