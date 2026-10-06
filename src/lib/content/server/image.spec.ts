import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: { STRAPI_URL: 'http://cms.test' } }));

const { resolveUpload } = await import('./image');

describe('resolveUpload', () => {
	it('lists the original and Strapi’s resized copies as a srcset, smallest first', () => {
		const image = resolveUpload({
			url: 'https://media.test/me.jpg',
			alternativeText: null,
			width: 1200,
			height: 1500,
			formats: {
				small: { url: 'https://media.test/small_me.jpg', width: 400, height: 500 },
				thumbnail: { url: 'https://media.test/thumbnail_me.jpg', width: 125, height: 156 }
			}
		});
		expect(image).toEqual({
			src: 'https://media.test/me.jpg',
			srcset:
				'https://media.test/thumbnail_me.jpg 125w, https://media.test/small_me.jpg 400w, https://media.test/me.jpg 1200w',
			alt: '',
			width: 1200,
			height: 1500
		});
	});

	it('uses the original alone when there are no resized copies, and resolves local URLs', () => {
		const image = resolveUpload({
			url: '/uploads/me.jpg',
			alternativeText: 'Me, smiling',
			width: 200,
			height: 200,
			formats: null
		});
		expect(image?.src).toBe('http://cms.test/uploads/me.jpg');
		expect(image?.srcset).toBeUndefined();
		expect(image?.alt).toBe('Me, smiling');
	});

	it('is null without an upload', () => {
		expect(resolveUpload(null)).toBeNull();
	});
});
