import { describe, expect, it } from 'vitest';
import { cardUrl } from '../share';
import { asideCard, defaultCard, headshotSrc, postCard, renderCard, titleSize } from './og';

/** Width and height from a PNG's IHDR chunk. */
const pngSize = (png: Uint8Array) => {
	const view = new DataView(png.buffer, png.byteOffset);
	return { width: view.getUint32(16), height: view.getUint32(20) };
};
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe('share cards', () => {
	it('render as 1200×630 PNGs: post, aside and default', async () => {
		const cards = [
			postCard({
				title: 'Your calendar is the new codebase',
				category: 'Leadership',
				date: 'September 22, 2026'
			}),
			postCard({ title: 'A'.repeat(200), date: 'August 25, 2026' }),
			asideCard({
				kind: 'Quote',
				text: 'Make it work, make it right.',
				quote: true,
				attribution: 'Kent Beck'
			}),
			defaultCard({
				name: 'Bhargav Shukla',
				tagline: 'Notes on leading engineers, and still being one.'
			})
		];
		for (const card of cards) {
			const png = await renderCard(card);
			expect([...png.slice(0, 8)]).toEqual(PNG_SIGNATURE);
			expect(pngSize(png)).toEqual({ width: 1200, height: 630 });
		}
	}, 30_000);

	it('uses a smaller size for long titles', () => {
		expect(titleSize('Short title')).toBe(72);
		expect(titleSize('x'.repeat(71))).toBe(60);
	});
});

describe('headshotSrc', () => {
	it('picks the smallest copy at least 192 px wide, else the original', () => {
		expect(
			headshotSrc({
				src: 'https://m/full.jpg',
				srcset: 'https://m/thumb.jpg 156w, https://m/small.jpg 500w, https://m/full.jpg 1200w'
			})
		).toBe('https://m/small.jpg');
		expect(headshotSrc({ src: 'https://m/full.jpg' })).toBe('https://m/full.jpg');
		expect(headshotSrc(null)).toBeUndefined();
	});
});

describe('cardUrl', () => {
	it('is absolute on the production origin, with an optional version', () => {
		expect(cardUrl('/default')).toBe('https://bhargavshukla.com/og/default.png');
		expect(cardUrl('/blog/a', '2026-09-01T00:00:00.000Z')).toBe(
			'https://bhargavshukla.com/og/blog/a.png?v=2026-09-01T00%3A00%3A00.000Z'
		);
	});
});
