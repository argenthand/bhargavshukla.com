import { describe, expect, it } from 'vitest';
import { konamiMatcher, NOT_FOUND_LINES, notFoundLine } from './easter-eggs';

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

describe('konamiMatcher', () => {
	it('fires on the last key of the code, even after other keys', () => {
		const feed = konamiMatcher();
		expect(['x', 'ArrowUp', ...CODE].map(feed)).toEqual([...Array(11).fill(false), true]);
	});

	it('accepts capital B and A, and starts over after firing', () => {
		const feed = konamiMatcher();
		expect([...CODE.slice(0, 8), 'B', 'A'].map(feed).at(-1)).toBe(true);
		expect(feed('a')).toBe(false);
	});

	it('ignores a wrong order', () => {
		const feed = konamiMatcher();
		expect([...CODE.slice(0, 8), 'a', 'b'].map(feed).some(Boolean)).toBe(false);
	});
});

describe('notFoundLine', () => {
	it('is stable for a path and comes from the list', () => {
		expect(notFoundLine('/old-post')).toBe(notFoundLine('/old-post'));
		expect(NOT_FOUND_LINES).toContain(notFoundLine('/old-post'));
	});

	it('varies between paths', () => {
		const lines = new Set(['/a', '/b', '/c', '/d', '/e', '/f', '/g', '/h'].map(notFoundLine));
		expect(lines.size).toBeGreaterThan(1);
	});
});
