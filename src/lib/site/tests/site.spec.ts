import { describe, expect, it } from 'vitest';
import { isLive, nav, site } from '../site';

describe('the Primary nav', () => {
	it('has a tab for each live section, each with a distinct shortcut letter', () => {
		expect(nav.map((section) => section.href)).toEqual(['/blog', '/asides', '/resume']);
		const letters = nav.map((section) => section.shortcut);
		expect(new Set(letters).size).toBe(letters.length);
		expect(letters).not.toContain('h'); // Home's
		expect(letters).not.toContain('g'); // the sequence's first key
	});

	it('only offers shortcut letters that are one lower-case character', () => {
		for (const { shortcut } of nav) expect(shortcut).toMatch(/^[a-z]$/);
	});
});

describe('isLive', () => {
	it('is true for a live section and false for anything else', () => {
		expect(isLive('/blog')).toBe(true);
		expect(isLive('/blog/a-post')).toBe(false); // a section, not a page in it
		expect(isLive('/privacy')).toBe(false);
		expect(isLive('/nope')).toBe(false);
	});
});

describe('site', () => {
	it('has an https origin without a trailing slash, for canonical URLs', () => {
		expect(site.url).toMatch(/^https:\/\/[^/]+$/);
	});
});
