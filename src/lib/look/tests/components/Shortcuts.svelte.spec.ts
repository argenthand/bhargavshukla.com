// Keyboard shortcuts (#63): `?` opens the panel, `g` then a letter goes to a live section, `/`
// searches on Writing, and none of it fires while typing or with Ctrl/⌘/Alt held.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const { goto, page } = vi.hoisted(() => ({
	goto: vi.fn(),
	page: { route: { id: '/' } }
}));
vi.mock('$app/navigation', async (original) => ({
	...(await original<typeof import('$app/navigation')>()),
	goto
}));
vi.mock('$app/state', async (original) => ({
	...(await original<typeof import('$app/state')>()),
	page
}));

const { default: Shortcuts } = await import('../../components/Shortcuts.svelte');

beforeEach(() => {
	page.route.id = '/';
});
afterEach(() => {
	goto.mockReset();
	vi.useRealTimers();
	document.getElementById('q')?.remove();
});

function key(key: string, init: KeyboardEventInit = {}, target: EventTarget = window) {
	const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
	target.dispatchEvent(event);
	return event;
}

function panel() {
	const view = render(Shortcuts);
	const dialog = view.container.ownerDocument.querySelector('dialog')!;
	return { dialog };
}

describe('?', () => {
	it('opens the panel, and closes it on the next press', () => {
		const { dialog } = panel();
		const first = key('?');
		expect(dialog.open).toBe(true);
		expect(first.defaultPrevented).toBe(true);
		key('?');
		expect(dialog.open).toBe(false);
	});

	it('closes on the × button and on a click on the backdrop', () => {
		const { dialog } = panel();
		key('?');
		dialog.querySelector<HTMLElement>('button[aria-label="Close"]')!.click();
		expect(dialog.open).toBe(false);
		key('?');
		dialog.dispatchEvent(new MouseEvent('click', { bubbles: true })); // lands on the <dialog> itself
		expect(dialog.open).toBe(false);
	});
});

describe('g, then a letter', () => {
	it('goes to the section and closes the panel', () => {
		const { dialog } = panel();
		key('?');
		key('g');
		const second = key('w');
		expect(goto).toHaveBeenCalledWith('/blog');
		expect(second.defaultPrevented).toBe(true);
		expect(dialog.open).toBe(false);
	});

	it('goes home on h, and to Asides and Resume on a and r', () => {
		panel();
		for (const letter of ['h', 'a', 'r']) {
			key('g');
			key(letter);
		}
		expect(goto.mock.calls.map(([href]) => href)).toEqual(['/', '/asides', '/resume']);
	});

	it('does nothing for a letter that is not a destination, and forgets the g', () => {
		panel();
		key('g');
		key('z');
		key('w'); // no g waiting any more
		expect(goto).not.toHaveBeenCalled();
	});

	it('forgets the g after 1.5 seconds', () => {
		vi.useFakeTimers();
		panel();
		key('g');
		vi.advanceTimersByTime(1501);
		key('w');
		expect(goto).not.toHaveBeenCalled();
	});
});

describe('/', () => {
	it('focuses the search on Writing', () => {
		page.route.id = '/blog';
		const search = document.body.appendChild(document.createElement('input'));
		search.id = 'q';
		panel();
		const event = key('/');
		expect(document.activeElement).toBe(search);
		expect(event.defaultPrevented).toBe(true);
	});

	it('leaves the key alone on other pages', () => {
		const search = document.body.appendChild(document.createElement('input'));
		search.id = 'q';
		panel();
		expect(key('/').defaultPrevented).toBe(false);
		expect(document.activeElement).not.toBe(search);
	});

	it('leaves the key alone when the page has no search', () => {
		page.route.id = '/blog';
		panel();
		expect(key('/').defaultPrevented).toBe(false);
	});
});

describe('keys it leaves alone', () => {
	it.each([
		['Ctrl', { ctrlKey: true }],
		['⌘', { metaKey: true }],
		['Alt', { altKey: true }]
	])('with %s held', (_, init) => {
		const { dialog } = panel();
		key('?', init);
		expect(dialog.open).toBe(false);
	});

	it('while typing in a field', () => {
		const { dialog } = panel();
		const field = document.body.appendChild(document.createElement('input'));
		key('?', {}, field);
		key('g', {}, field);
		key('w', {}, field);
		field.remove();
		expect(dialog.open).toBe(false);
		expect(goto).not.toHaveBeenCalled();
	});
});
