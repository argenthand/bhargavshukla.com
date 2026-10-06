// The layout's easter eggs (#111, #143): three quick taps on the footer's © line open the
// controller, five on the current tab of the phone tab bar send its marker round the bar, and
// bouncing past the end of the page finds the abyss. Real layout, with the router, analytics and
// the contact card out of the way.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';

const { track, bounced } = vi.hoisted(() => ({ track: vi.fn(), bounced: vi.fn(() => false) }));

vi.mock('$app/state', async (original) => ({
	...(await original<typeof import('$app/state')>()),
	page: (await import('./page-state.svelte')).page
}));
vi.mock('$app/navigation', async (original) => ({
	...(await original<typeof import('$app/navigation')>()),
	afterNavigate: vi.fn(),
	onNavigate: vi.fn()
}));
vi.mock('$lib/analytics', () => ({ pageView: vi.fn(), startAnalytics: vi.fn(), track }));
vi.mock('$lib/contact', () => ({ ContactCard: () => {} }));
vi.mock('$lib/look', async (original) => ({
	...(await original<typeof import('$lib/look')>()),
	bouncedPastEnd: bounced
}));

const { page } = await import('./page-state.svelte');
const { default: Layout } = await import('../+layout.svelte');
const { nav } = await import('$lib/site');

beforeEach(() => {
	document.documentElement.classList.add('js');
	page.url = { pathname: '/blog', search: '' };
});

afterEach(() => {
	track.mockClear();
	bounced.mockReturnValue(false);
	document.getElementById('controller')?.hidePopover?.();
});

function layout() {
	const view = render(Layout, { data: { preview: false }, children: (() => {}) as never });
	const tabs = view.container.ownerDocument.querySelector('nav[data-tabs]')!;
	const tab = (label: string) =>
		[...tabs.querySelectorAll('a')].find((a) => a.textContent?.includes(label))!;
	const tap = (element: Element, times: number) => {
		for (let i = 0; i < times; i++) (element as HTMLElement).click();
	};
	return { tab, tap };
}

const lapsFound = () => track.mock.calls.filter(([, props]) => props?.egg === 'tab-lap').length;

describe('the footer © line', () => {
	it('opens the controller on the third quick tap, and not before', async () => {
		const { tap } = layout();
		const line = [...document.querySelectorAll('footer span')].find((s) =>
			s.textContent?.startsWith('©')
		)!;
		tap(line, 2);
		await new Promise((done) => setTimeout(done, 100));
		expect(document.getElementById('controller')).toBeNull();
		tap(line, 1);
		await expect
			.poll(() => document.getElementById('controller')?.matches(':popover-open'))
			.toBe(true);
	});
});

describe('the tab bar', () => {
	it('runs the lap on the fifth quick tap on the current tab', () => {
		const { tab, tap } = layout();
		tap(tab('Writing'), 4);
		expect(lapsFound()).toBe(0);
		tap(tab('Writing'), 1);
		expect(lapsFound()).toBe(1);
	});

	it('ignores quick taps on a tab that is not current', () => {
		const { tab, tap } = layout();
		tap(tab('Asides'), 5);
		expect(lapsFound()).toBe(0);
	});

	it('follows the current tab when the visitor navigates', async () => {
		const { tab, tap } = layout();
		page.url = { pathname: '/asides', search: '' };
		await tick();
		tap(tab('Writing'), 5);
		expect(lapsFound()).toBe(0);
		tap(tab('Asides'), 5);
		expect(lapsFound()).toBe(1);
	});

	it('keeps counting while every tap navigates to the same page', async () => {
		// A link to the page you're on is still a navigation, and it gives `page.url` a new object.
		const { tab } = layout();
		for (let i = 0; i < 5; i++) {
			tab('Writing').click();
			page.url = { pathname: '/blog', search: '' };
			await tick();
		}
		expect(lapsFound()).toBe(1);
	});

	it('has a Writing and an Asides tab to test with', () => {
		expect(nav.map((item) => item.label)).toEqual(expect.arrayContaining(['Writing', 'Asides']));
	});
});

describe('the abyss', () => {
	it('is found once, on the first bounce past the end of the page', () => {
		layout();
		window.dispatchEvent(new Event('scroll'));
		expect(track).not.toHaveBeenCalledWith('easter_egg_found', { egg: 'abyss' });
		bounced.mockReturnValue(true);
		window.dispatchEvent(new Event('scroll'));
		window.dispatchEvent(new Event('scroll'));
		expect(track.mock.calls.filter(([, props]) => props?.egg === 'abyss')).toHaveLength(1);
	});
});
