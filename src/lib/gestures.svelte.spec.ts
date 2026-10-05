// The gestures (#143, CONTEXT.md) in a real browser: quick taps on a real element, and the Konami
// code from real key events and from the controller's presses.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { unlock } = vi.hoisted(() => ({ unlock: vi.fn() }));
vi.mock('$lib/eight-bit.svelte', () => ({ unlock }));

const { taps, konamiKeydown, konamiKey } = await import('./gestures');

const CODE = [
	'ArrowUp',
	'ArrowUp',
	'ArrowDown',
	'ArrowDown',
	'ArrowLeft',
	'ArrowRight',
	'ArrowLeft',
	'ArrowRight',
	'b',
	'a'
];

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	vi.useRealTimers();
	unlock.mockClear();
	document.body.replaceChildren();
});

describe('taps', () => {
	function tapped(count: number, windowMs?: number) {
		const button = document.body.appendChild(document.createElement('button'));
		const done = vi.fn();
		const detach = taps(count, done, windowMs === undefined ? {} : { windowMs })(button);
		return { button, done, detach };
	}

	it('fires on the tap that makes the count, with that click, then starts over', () => {
		const { button, done } = tapped(3);
		button.click();
		button.click();
		expect(done).not.toHaveBeenCalled();
		button.click();
		expect(done).toHaveBeenCalledTimes(1);
		expect(done.mock.calls[0][0]).toBeInstanceOf(MouseEvent);
		button.click();
		button.click();
		expect(done).toHaveBeenCalledTimes(1);
	});

	it('forgets taps older than the window (2 s by default)', () => {
		const { button, done } = tapped(3);
		button.click();
		button.click();
		vi.advanceTimersByTime(2000);
		button.click();
		button.click();
		expect(done).not.toHaveBeenCalled();
		button.click();
		expect(done).toHaveBeenCalledTimes(1);
	});

	it('takes its own window', () => {
		const { button, done } = tapped(3, 1000);
		button.click();
		vi.advanceTimersByTime(600);
		button.click();
		vi.advanceTimersByTime(600);
		button.click();
		expect(done).not.toHaveBeenCalled();
	});

	it('stops listening once detached', () => {
		const { button, done, detach } = tapped(1);
		detach();
		button.click();
		expect(done).not.toHaveBeenCalled();
	});
});

describe('the Konami code', () => {
	beforeEach(() => window.addEventListener('keydown', konamiKeydown));
	afterEach(() => window.removeEventListener('keydown', konamiKeydown));

	const press = (key: string, target: Element = document.body, init: KeyboardEventInit = {}) =>
		target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));

	it('unlocks on the last key, even after other keys, and starts over', () => {
		for (const key of ['x', 'ArrowUp', ...CODE]) press(key);
		expect(unlock).toHaveBeenCalledTimes(1);
		press('a');
		expect(unlock).toHaveBeenCalledTimes(1);
	});

	it('accepts capital B and A', () => {
		for (const key of [...CODE.slice(0, 8), 'B', 'A']) press(key);
		expect(unlock).toHaveBeenCalledTimes(1);
	});

	it('ignores a wrong order', () => {
		for (const key of [...CODE.slice(0, 8), 'a', 'b']) press(key);
		expect(unlock).not.toHaveBeenCalled();
	});

	it('ignores keys typed in a field and chords with Ctrl, ⌘ or Alt', () => {
		const field = document.body.appendChild(document.createElement('input'));
		for (const key of CODE) press(key, field);
		for (const key of CODE) press(key, document.body, { ctrlKey: true });
		for (const key of CODE) press(key, document.body, { metaKey: true });
		for (const key of CODE) press(key, document.body, { altKey: true });
		expect(unlock).not.toHaveBeenCalled();
	});

	it('is one sequence from the keyboard and the controller', () => {
		for (const key of CODE.slice(0, 5)) press(key);
		for (const key of CODE.slice(5)) konamiKey(key.toLowerCase());
		expect(unlock).toHaveBeenCalledTimes(1);
	});

	it('tells the controller when a press completes it', () => {
		const results = CODE.map((key) => konamiKey(key.toLowerCase()));
		expect(results.at(-1)).toBe(true);
		expect(results.slice(0, -1).some(Boolean)).toBe(false);
	});
});
