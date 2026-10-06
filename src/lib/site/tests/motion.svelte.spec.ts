// Motion that follows the reader's preference: whether to animate, and for how long.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { motionMs, reducedMotion } from '../motion';

afterEach(() => {
	vi.restoreAllMocks();
	document.documentElement.style.removeProperty('--duration-motion');
});

/** What `matchMedia('(prefers-reduced-motion: reduce)')` answers. */
function reduce(on: boolean) {
	vi.spyOn(window, 'matchMedia').mockImplementation(
		(query) => ({ matches: on && query.includes('reduce') }) as MediaQueryList
	);
}

describe('reducedMotion', () => {
	it('follows the reader’s setting', () => {
		reduce(true);
		expect(reducedMotion()).toBe(true);
		reduce(false);
		expect(reducedMotion()).toBe(false);
	});
});

describe('motionMs', () => {
	const duration = (value: string) =>
		document.documentElement.style.setProperty('--duration-motion', value);

	it('reads --duration-motion in milliseconds, from ms or seconds', () => {
		reduce(false);
		duration('200ms');
		expect(motionMs()).toBe(200);
		duration('0.35s');
		expect(motionMs()).toBe(350);
		duration(' 150ms ');
		expect(motionMs()).toBe(150);
	});

	it('is 0 with reduced motion, whatever the property says', () => {
		reduce(true);
		duration('200ms');
		expect(motionMs()).toBe(0);
	});

	it('is 0 when the property is missing or not a number', () => {
		reduce(false);
		expect(motionMs()).toBe(0);
		duration('fast');
		expect(motionMs()).toBe(0);
	});
});
