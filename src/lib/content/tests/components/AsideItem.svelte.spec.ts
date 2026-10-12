// An aside in the stream is cut at 8 lines with a Read more link when it's longer (#185); short
// ones, and an aside on its own page, show whole.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import '../../../../routes/layout.css';

const { default: AsideItem } = await import('../../components/AsideItem.svelte');

const aside = (html: string, over = {}) =>
	({
		documentId: 'a1',
		slug: 'long-one',
		kind: 'tip',
		title: 'A long one',
		html,
		label: 'A long one',
		tags: [],
		sourceAuthor: null,
		sourceTitle: null,
		sourceUrl: null,
		publishedAt: '2026-01-01T00:00:00.000Z',
		...over
	}) as never;

const SHORT = '<p>One line.</p>';
const LONG = Array.from({ length: 30 }, (_, i) => `<p>Paragraph ${i + 1}</p>`).join('');

// The clamp only applies once the page has JavaScript, which marks <html> with `js`.
beforeEach(() => document.documentElement.classList.add('js'));
afterEach(() => document.documentElement.classList.remove('js'));

const readMore = (container: Element) =>
	[...container.querySelectorAll('a')].find((a) => a.textContent?.includes('Read more'));

describe('the stream', () => {
	it('cuts a long body and links to the aside', async () => {
		const { container } = render(AsideItem, { aside: aside(LONG) });
		await expect.poll(() => readMore(container)).toBeTruthy();
		expect(readMore(container)?.getAttribute('href')).toBe('/asides/long-one');
		expect(readMore(container)?.textContent).toContain('A long one');
		const body = container.querySelector<HTMLElement>('[data-clamped]')!;
		expect(body.clientHeight).toBeLessThan(body.scrollHeight);
	});

	it('shows a short body whole, with no link', async () => {
		const { container } = render(AsideItem, { aside: aside(SHORT) });
		await expect.element(container.querySelector<HTMLElement>('p:not(.flex)')!).toBeVisible();
		expect(readMore(container)).toBeUndefined();
		expect(container.querySelector('[data-clamped]')).toBeNull();
	});

	it('keeps lines of a code block in view when text above it fills the clamp', async () => {
		const code = `<div class="code-block"><pre style="line-height: 20px">${'line\n'.repeat(30)}</pre></div>`;
		const { container } = render(AsideItem, { aside: aside(LONG.slice(0, 8 * 40) + code) });
		await expect.poll(() => readMore(container)).toBeTruthy();
		const body = container.querySelector<HTMLElement>('[data-clamped]')!;
		const pre = body.querySelector('pre')!;
		const shown = body.getBoundingClientRect().bottom - pre.getBoundingClientRect().top;
		expect(shown).toBeGreaterThanOrEqual(6 * 20);
	});

	it('cuts a long quote, caption and all', async () => {
		const { container } = render(AsideItem, {
			aside: aside(LONG, { kind: 'quote', sourceAuthor: 'Someone' })
		});
		await expect.poll(() => readMore(container)).toBeTruthy();
	});
});

describe('on its own page', () => {
	it('shows a long body whole, with no link', async () => {
		const { container } = render(AsideItem, { aside: aside(LONG), standalone: true });
		await expect.element(container.querySelector('h1')!).toBeVisible();
		expect(readMore(container)).toBeUndefined();
		expect(container.textContent).toContain('Paragraph 30');
	});
});

describe('without JavaScript', () => {
	it('shows a long body whole, with no link', async () => {
		document.documentElement.classList.remove('js');
		const { container } = render(AsideItem, { aside: aside(LONG) });
		await expect.element(container.querySelector('h2')!).toBeVisible();
		expect(readMore(container)).toBeUndefined();
	});
});
