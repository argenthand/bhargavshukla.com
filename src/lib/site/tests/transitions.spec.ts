// Page transitions (#60, #144): when a title moves between pages instead of fading.
import { describe, expect, it } from 'vitest';
import { movesTitles } from '../transitions';

describe('movesTitles', () => {
	it('moves titles between a list and an entry, either way', () => {
		expect(movesTitles('/blog', '/blog/[slug]')).toBe(true);
		expect(movesTitles('/asides/[slug]', '/asides')).toBe(true);
		expect(movesTitles('/', '/blog/[slug]')).toBe(true);
	});

	it('just fades between two lists or two entries', () => {
		expect(movesTitles('/blog', '/asides')).toBe(false);
		expect(movesTitles('/blog/[slug]', '/blog/[slug]')).toBe(false);
		expect(movesTitles('/blog/[slug]', '/asides/[slug]')).toBe(false);
	});

	it('treats an unknown route (an error page) as a list', () => {
		expect(movesTitles(null, '/blog')).toBe(false);
		expect(movesTitles(undefined, '/blog/[slug]')).toBe(true);
	});
});
