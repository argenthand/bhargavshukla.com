import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardUrl } from '../../share';
import {
	asideCard,
	cardProfile,
	defaultCard,
	headshotSrc,
	loadHeadshot,
	pngResponse,
	postCard,
	renderCard,
	titleSize
} from '../../server/og';

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

/** Every string in a satori node tree, in order. */
function texts(node: unknown): string[] {
	if (typeof node === 'string') return [node];
	if (Array.isArray(node)) return node.flatMap(texts);
	if (node && typeof node === 'object' && 'props' in node) {
		return texts((node as { props: { children?: unknown } }).props.children);
	}
	return [];
}

describe('the card layouts', () => {
	it('puts a post’s category above its title only when it has one', () => {
		const withCategory = texts(
			postCard({ title: 'Title', category: 'Leadership', date: 'May 1, 2026' })
		);
		expect(withCategory.slice(0, 2)).toEqual(['Leadership', 'Title']);
		const without = texts(postCard({ title: 'Title', category: null, date: 'May 1, 2026' }));
		expect(without[0]).toBe('Title');
		expect(without).toContain('May 1, 2026 · bhargavshukla.com');
	});

	it('quotes a quote, with who said it, and leaves other asides bare', () => {
		const quote = texts(
			asideCard({ kind: 'Quote', text: 'Words.', quote: true, attribution: 'Kent Beck' })
		);
		expect(quote).toEqual(expect.arrayContaining(['“Words.”', '— Kent Beck']));
		const tip = texts(asideCard({ kind: 'Tip', text: 'Words.', quote: false }));
		expect(tip).toContain('Words.');
		expect(tip.some((t) => t.startsWith('— '))).toBe(false);
	});

	it('shows the name and tagline on the site card', () => {
		expect(texts(defaultCard({ name: 'Bhargav Shukla', tagline: 'Notes.' }))).toEqual(
			expect.arrayContaining(['Bhargav Shukla', 'Notes.', 'bhargavshukla.com'])
		);
	});
});

describe('pngResponse', () => {
	it('is an image the edge cache may keep', () => {
		const response = pngResponse(new Uint8Array(4));
		expect(response.headers.get('content-type')).toBe('image/png');
		expect(response.headers.get('cache-control')).toBeNull();
	});

	it('is not kept when the card is degraded', () => {
		expect(pngResponse(new Uint8Array(4), true).headers.get('cache-control')).toBe('no-store');
	});
});

describe('cardProfile', () => {
	afterEach(() => vi.restoreAllMocks());

	it('hands back the profile when it loads', async () => {
		expect(await cardProfile(Promise.resolve({ name: 'B' }))).toEqual({
			profile: { name: 'B' },
			degraded: false
		});
	});

	it('is degraded, with no profile, when the CMS can’t be reached', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(await cardProfile(Promise.reject(new Error('CMS down')))).toEqual({ degraded: true });
	});
});

describe('loadHeadshot', () => {
	afterEach(() => vi.unstubAllGlobals());

	const answer = (body: BodyInit, type: string, ok = true) =>
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(body, { status: ok ? 200 : 404, headers: { 'content-type': type } })
			)
		);

	it('has nothing to load without a source', async () => {
		expect(await loadHeadshot(undefined)).toBeUndefined();
	});

	it('turns a JPEG or PNG into a data URL', async () => {
		answer(new Uint8Array([1, 2, 3]), 'image/jpeg');
		expect(await loadHeadshot('https://m/me.jpg')).toBe(
			`data:image/jpeg;base64,${btoa('\x01\x02\x03')}`
		);
		answer(new Uint8Array([1]), 'image/png; charset=binary');
		expect(await loadHeadshot('https://m/me.png')).toMatch(/^data:image\/png;base64,/);
	});

	it('handles a file bigger than one chunk', async () => {
		answer(new Uint8Array(0x8000 * 2 + 5).fill(65), 'image/png');
		const url = (await loadHeadshot('https://m/big.png'))!;
		expect(atob(url.split(',')[1])).toHaveLength(0x8000 * 2 + 5);
	});

	it.each([
		['a missing file', 'not found', 'text/html', false],
		['a type satori can’t draw', '<svg/>', 'image/svg+xml', true],
		['an answer that isn’t an image', '<html>', 'text/html', true]
	])('leaves the headshot off for %s', async (_, body, type, ok) => {
		answer(body, type, ok);
		expect(await loadHeadshot('https://m/me.jpg')).toBeUndefined();
	});

	it('leaves the headshot off when the request fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
		expect(await loadHeadshot('https://m/me.jpg')).toBeUndefined();
	});
});
