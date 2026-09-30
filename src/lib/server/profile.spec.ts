import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

const { firstParagraph } = await import('./profile');

describe('firstParagraph', () => {
	it('takes the first paragraph as plain text', () => {
		expect(firstParagraph('Hello **there**, see [my site](https://x.y).\n\nSecond one.')).toBe(
			'Hello there, see my site.'
		);
	});

	it('cuts long text at a word boundary to fit a meta description', () => {
		const text = firstParagraph('word '.repeat(60), 30);
		expect(text.length).toBeLessThanOrEqual(30);
		expect(text).toBe('word word word word word word…');
	});
});
