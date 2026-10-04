import { describe, expect, it } from 'vitest';
import {
	discoOrder,
	konamiMatcher,
	NOT_FOUND_LINES,
	notFoundLine,
	tapCounter
} from './easter-eggs';

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

describe('tapCounter (#111)', () => {
	it('fires on the third quick tap, then starts over', () => {
		let t = 0;
		const tap = tapCounter(3, 1000, () => t);
		expect(tap()).toBe(false);
		t = 300;
		expect(tap()).toBe(false);
		t = 600;
		expect(tap()).toBe(true);
		t = 700;
		expect(tap()).toBe(false);
	});

	it('forgets taps older than the window', () => {
		let t = 0;
		const tap = tapCounter(3, 1000, () => t);
		tap();
		t = 900;
		tap();
		t = 1200; // the first tap is now too old
		expect(tap()).toBe(false);
		t = 1300;
		expect(tap()).toBe(true);
	});
});

describe('discoOrder (#111)', () => {
	const ids = ['newsprint', 'harbour', 'sage', 'plum', 'ochre'];

	it('plays every other palette and ends on the current one', () => {
		expect(discoOrder(ids, 'sage')).toEqual(['plum', 'ochre', 'newsprint', 'harbour', 'sage']);
		expect(discoOrder(ids, 'newsprint')).toEqual(['harbour', 'sage', 'plum', 'ochre', 'newsprint']);
	});

	it('treats an unknown current palette as the first', () => {
		expect(discoOrder(ids, 'nes').at(-1)).toBe('newsprint');
	});
});
