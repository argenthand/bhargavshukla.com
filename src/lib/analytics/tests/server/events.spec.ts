import { describe, expect, it, vi } from 'vitest';
import { MAX_BATCH } from '../../events';
import {
	contactEvent,
	counted,
	dataPoint,
	handleBeacon,
	isBot,
	readBeacon,
	recordServerEvent,
	type EventsDataset
} from '../../server/events';

const SITE = 'https://bhargavshukla.com';
const CHROME =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

function beacon(body: unknown, { origin = SITE, url = `${SITE}/api/events`, ua = CHROME } = {}) {
	return new Request(url, {
		method: 'POST',
		headers: { origin, 'user-agent': ua, 'content-type': 'text/plain' },
		body: typeof body === 'string' ? body : JSON.stringify(body)
	});
}

const egg = { event: 'easter_egg_found', path: '/', properties: { egg: 'disco' } };

/** A fake Analytics Engine dataset that keeps what's written. */
function dataset() {
	const points: Parameters<EventsDataset['writeDataPoint']>[0][] = [];
	return { points, writeDataPoint: (point: (typeof points)[number]) => void points.push(point) };
}

describe('isBot', () => {
	it.each([
		'Googlebot/2.1 (+http://www.google.com/bot.html)',
		'Mozilla/5.0 (compatible; bingbot/2.0)',
		'Mozilla/5.0 ... HeadlessChrome/140.0.0.0 Safari/537.36',
		'Mozilla/5.0 ... Chrome-Lighthouse',
		'curl/8.7.1',
		'python-requests/2.32',
		'facebookexternalhit/1.1',
		''
	])('drops %j', (ua) => expect(isBot(ua)).toBe(true));

	it.each([
		CHROME,
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
		'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0'
	])('keeps %j', (ua) => expect(isBot(ua)).toBe(false));
});

describe('counted', () => {
	it('counts a same-origin request on the site, outside preview, from a browser', () => {
		expect(counted(beacon([]), { preview: false })).toBe(true);
	});

	it.each([
		['preview mode', beacon([]), true],
		['another origin', beacon([], { origin: 'https://evil.example' }), false],
		['no origin', new Request(`${SITE}/api/events`, { method: 'POST', body: '[]' }), false],
		[
			'a Workers Builds preview URL',
			beacon([], {
				origin: 'https://abc-bs-blog.example.workers.dev',
				url: 'https://abc-bs-blog.example.workers.dev/api/events'
			}),
			false
		],
		[
			'vite dev',
			beacon([], { origin: 'http://localhost:5173', url: 'http://localhost:5173/api/events' }),
			false
		],
		['a bot', beacon([], { ua: 'Googlebot/2.1' }), false]
	])('not from %s', (_, request, preview) => {
		expect(counted(request, { preview })).toBe(false);
	});

	it('pays no attention to where the visitor is: nothing about them is kept', () => {
		expect(counted(beacon([]), { preview: false })).toBe(true);
	});
});

describe('readBeacon', () => {
	it('keeps known events as counts: the page, and the one value each event may carry', () => {
		const body = [
			egg,
			{ event: 'read', path: '/blog/a', properties: { seconds: 42 } },
			{ event: 'palette_chosen', path: '/blog', properties: { palette: 'sage' } },
			{ event: 'outbound_link', path: '/', properties: { host: 'github.com' } },
			{ event: 'resume_printed', path: '/resume', properties: {} },
			{ event: 'page_view', path: '/', properties: { referrer: 'www.google.com' } }
		];
		expect(readBeacon(JSON.stringify(body))).toEqual([
			{ event: 'easter_egg_found', path: '/', value: 'disco', seconds: 0 },
			{ event: 'read', path: '/blog/a', value: '', seconds: 42 },
			{ event: 'palette_chosen', path: '/blog', value: 'sage', seconds: 0 },
			{ event: 'outbound_link', path: '/', value: 'github.com', seconds: 0 },
			{ event: 'resume_printed', path: '/resume', value: '', seconds: 0 },
			{ event: 'page_view', path: '/', value: 'www.google.com', seconds: 0 }
		]);
	});

	it('drops unknown events, and events only the server sends', () => {
		const body = [
			{ event: 'hacked', path: '/', properties: {} },
			{ event: 'contact_sent', path: '/', properties: {} },
			{ event: '$pageview', path: '/', properties: {} },
			egg
		];
		expect(readBeacon(JSON.stringify(body)).map((count) => count.event)).toEqual([
			'easter_egg_found'
		]);
	});

	it('keeps nothing but the allowed value: other properties, wrong kinds and unknown words go', () => {
		const body = [
			{ event: 'easter_egg_found', path: '/', properties: { egg: 'secret', ip: '1.2.3.4' } },
			{ event: 'read', path: '/', properties: { seconds: 'many' } },
			{ event: 'read', path: '/', properties: { seconds: Infinity } },
			{ event: 'read', path: '/', properties: { seconds: -5 } },
			{ event: 'outbound_link', path: '/', properties: { host: 'evil.example/path?q=1' } },
			{
				event: 'page_view',
				path: '/',
				properties: { referrer: 'https://mail.example/inbox?u=sam' }
			}
		];
		expect(readBeacon(JSON.stringify(body)).map(({ value, seconds }) => [value, seconds])).toEqual([
			['', 0],
			['', 0],
			['', 0],
			['', 0],
			['', 0],
			['', 0]
		]);
	});

	it.each([
		['a query string', '/blog?q=my+name'],
		['a fragment', '/blog#top'],
		['a full URL', 'https://bhargavshukla.com/blog'],
		['no leading slash', 'blog'],
		['not text', 7],
		['too long', `/${'a'.repeat(300)}`]
	])('drops an event whose path has %s', (_, path) => {
		expect(readBeacon(JSON.stringify([{ ...egg, path }]))).toEqual([]);
	});

	it.each([
		['not JSON', '{'],
		['not a list', JSON.stringify(egg)],
		['too many events', JSON.stringify(Array(MAX_BATCH + 1).fill(egg))],
		['too big', JSON.stringify([{ ...egg, padding: 'x'.repeat(20_000) }])],
		['not objects', JSON.stringify(['easter_egg_found', null])]
	])('reads nothing from a body that is %s', (_, body) => {
		expect(readBeacon(body)).toEqual([]);
	});
});

describe('dataPoint', () => {
	it('is the event, the page and its value: nothing about the visitor', () => {
		expect(dataPoint({ event: 'read', path: '/blog/a', value: '', seconds: 42 })).toEqual({
			indexes: ['read'],
			blobs: ['read', '/blog/a', ''],
			doubles: [42]
		});
	});
});

describe('handleBeacon', () => {
	const context = { preview: false };

	it('answers 204 and writes one data point per counted event', async () => {
		const events = dataset();
		const response = await handleBeacon(beacon([egg, egg]), { ...context, dataset: events });
		expect(response.status).toBe(204);
		expect(events.points).toEqual([
			{ indexes: ['easter_egg_found'], blobs: ['easter_egg_found', '/', 'disco'], doubles: [0] },
			{ indexes: ['easter_egg_found'], blobs: ['easter_egg_found', '/', 'disco'], doubles: [0] }
		]);
	});

	it.each([
		['not counted', beacon([egg], { origin: 'https://evil.example' }), context],
		['with nothing known in it', beacon([{ event: 'nope', path: '/', properties: {} }]), context]
	])('answers 204 and writes nothing when %s', async (_, request, ctx) => {
		const events = dataset();
		expect((await handleBeacon(request, { ...ctx, dataset: events })).status).toBe(204);
		expect(events.points).toEqual([]);
	});

	it('answers 204 without a dataset (vite dev), and when writing fails', async () => {
		expect((await handleBeacon(beacon([egg]), { ...context, dataset: undefined })).status).toBe(
			204
		);
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const failing = {
			writeDataPoint: () => {
				throw new Error('limit');
			}
		};
		expect((await handleBeacon(beacon([egg]), { ...context, dataset: failing })).status).toBe(204);
		expect(error).toHaveBeenCalled();
		error.mockRestore();
	});
});

describe('recordServerEvent', () => {
	const base = { preview: false, skip: false };
	const form = () =>
		new Request(`${SITE}/blog/a?/contact`, {
			method: 'POST',
			headers: { origin: SITE, 'user-agent': CHROME }
		});

	it('writes the event for the page the card was sent from', () => {
		const events = dataset();
		recordServerEvent('contact_sent', { ...base, request: form(), dataset: events });
		expect(events.points).toEqual([
			{ indexes: ['contact_sent'], blobs: ['contact_sent', '/blog/a', ''], doubles: [0] }
		]);
	});

	it.each([
		['the author’s devices', { skip: true }],
		['preview mode', { preview: true }]
	])('writes nothing from %s', (_, overrides) => {
		const events = dataset();
		recordServerEvent('contact_sent', { ...base, ...overrides, request: form(), dataset: events });
		expect(events.points).toEqual([]);
	});
});

describe('contactEvent', () => {
	it.each([
		['sent', 'contact_sent'],
		['sent-unverified', 'contact_sent'],
		['turnstile-failed', 'contact_blocked'],
		['honeypot', 'contact_blocked'],
		['invalid', undefined],
		['rate-limited', undefined],
		['capped', undefined],
		['send-failed', undefined]
	] as const)('%s → %s', (outcome, event) => {
		expect(contactEvent(outcome)).toBe(event);
	});
});
