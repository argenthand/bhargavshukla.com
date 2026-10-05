import { describe, expect, it, vi } from 'vitest';
import { MAX_BATCH } from '$lib/events';
import {
	contactEvent,
	counted,
	handleBeacon,
	isBot,
	POSTHOG_BATCH_URL,
	readBeacon,
	sendServerEvent,
	sendToPostHog,
	toPostHog,
	type PostHogBatch
} from './events';

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

const pageview = {
	event: '$pageview',
	properties: { $current_url: `${SITE}/blog/a`, $pathname: '/blog/a', $referrer: '$direct' },
	age: 5
};

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
});

describe('readBeacon', () => {
	it('keeps known events with their known properties', () => {
		const events = [
			pageview,
			{ event: 'easter_egg_found', properties: { $pathname: '/', egg: 'disco' }, age: 0 },
			{ event: 'read', properties: { $pathname: '/blog/a', seconds: 42 }, age: 10 }
		];
		expect(readBeacon(JSON.stringify(events))).toEqual(events);
	});

	it('drops unknown events, and events only the server sends', () => {
		const body = [
			{ event: 'hacked', properties: {}, age: 0 },
			{ event: 'contact_sent', properties: {}, age: 0 },
			{ event: '$identify', properties: {}, age: 0 },
			pageview
		];
		expect(readBeacon(JSON.stringify(body))).toEqual([pageview]);
	});

	it('drops properties that are unknown, of the wrong kind or not one of the allowed words', () => {
		const body = [
			{
				event: 'easter_egg_found',
				properties: {
					egg: 'secret',
					$ip: '1.2.3.4',
					distinct_id: 'me',
					$pathname: 7,
					$current_url: `${SITE}/`
				},
				age: 0
			},
			{ event: 'read', properties: { seconds: 'many' }, age: 0 },
			{ event: 'read', properties: { seconds: Infinity }, age: 0 }
		];
		expect(readBeacon(JSON.stringify(body))).toEqual([
			{ event: 'easter_egg_found', properties: { $current_url: `${SITE}/` }, age: 0 },
			{ event: 'read', properties: {}, age: 0 },
			{ event: 'read', properties: {}, age: 0 }
		]);
	});

	it('shortens long text', () => {
		const long = `${SITE}/${'a'.repeat(2000)}`;
		const [event] = readBeacon(
			JSON.stringify([{ event: '$pageview', properties: { $current_url: long }, age: 0 }])
		);
		expect((event.properties.$current_url as string).length).toBe(500);
	});

	it('keeps an age between now and a day ago', () => {
		const ages = [-5, 'soon', 2 * 86_400_000, 1500.7].map((age) => ({
			event: 'contact_started',
			properties: {},
			age
		}));
		expect(readBeacon(JSON.stringify(ages)).map((event) => event.age)).toEqual([
			0, 0, 86_400_000, 1501
		]);
	});

	it.each([
		['not JSON', '{'],
		['not a list', JSON.stringify(pageview)],
		['too many events', JSON.stringify(Array(MAX_BATCH + 1).fill(pageview))],
		['too big', JSON.stringify([{ ...pageview, padding: 'x'.repeat(20_000) }])],
		['not objects', JSON.stringify(['$pageview', null])]
	])('reads nothing from a body that is %s', (_, body) => {
		expect(readBeacon(body)).toEqual([]);
	});
});

describe('toPostHog', () => {
	it('adds the cookieless placeholder and the visitor fields, and times each event', () => {
		const now = new Date('2026-10-05T12:00:00.000Z');
		const batch = toPostHog(
			'phc_test',
			[pageview, { event: 'contact_sent', properties: { $pathname: '/' } }],
			{ ip: '203.0.113.9', userAgent: CHROME, host: 'bhargavshukla.com' },
			now
		);
		const visitor = {
			$ip: '203.0.113.9',
			$raw_user_agent: CHROME,
			$host: 'bhargavshukla.com',
			$process_person_profile: false
		};
		expect(batch).toEqual({
			api_key: 'phc_test',
			batch: [
				{
					event: '$pageview',
					distinct_id: '$posthog_cookieless',
					properties: { ...pageview.properties, ...visitor },
					timestamp: '2026-10-05T11:59:59.995Z'
				},
				{
					event: 'contact_sent',
					distinct_id: '$posthog_cookieless',
					properties: { $pathname: '/', ...visitor },
					timestamp: '2026-10-05T12:00:00.000Z'
				}
			]
		});
	});
});

describe('sendToPostHog', () => {
	it('posts the batch to the EU endpoint as JSON', async () => {
		const fetcher = vi.fn(async () => new Response('{"status":"Ok"}'));
		const batch: PostHogBatch = { api_key: 'phc_test', batch: [] };
		await sendToPostHog(batch, fetcher);
		expect(fetcher).toHaveBeenCalledWith(POSTHOG_BATCH_URL, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(batch)
		});
		expect(POSTHOG_BATCH_URL).toBe('https://eu.i.posthog.com/batch/');
	});

	it('logs, rather than throws, when PostHog fails', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		await sendToPostHog({ api_key: 'phc_test', batch: [] }, async () => {
			throw new Error('down');
		});
		await sendToPostHog(
			{ api_key: 'phc_test', batch: [] },
			async () => new Response('', { status: 500 })
		);
		expect(error).toHaveBeenCalledTimes(2);
		error.mockRestore();
	});
});

describe('handleBeacon', () => {
	const context = { preview: false, ip: '203.0.113.9', token: 'phc_test' };

	it('answers 204 and forwards what it accepted', async () => {
		const send = vi.fn();
		const response = await handleBeacon(beacon([pageview]), context, send);
		expect(response.status).toBe(204);
		expect(send).toHaveBeenCalledTimes(1);
		const [batch] = send.mock.calls[0] as [PostHogBatch];
		expect(batch.api_key).toBe('phc_test');
		expect(batch.batch.map((event) => event.event)).toEqual(['$pageview']);
		expect(batch.batch[0].properties.$ip).toBe('203.0.113.9');
		expect(batch.batch[0].properties.$host).toBe('bhargavshukla.com');
	});

	it.each([
		['not counted', beacon([pageview], { origin: 'https://evil.example' }), context],
		['without a token', beacon([pageview]), { ...context, token: '' }],
		['with nothing known in it', beacon([{ event: 'nope', properties: {}, age: 0 }]), context]
	])('answers 204 and forwards nothing when %s', async (_, request, ctx) => {
		const send = vi.fn();
		expect((await handleBeacon(request, ctx, send)).status).toBe(204);
		expect(send).not.toHaveBeenCalled();
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

describe('sendServerEvent', () => {
	const fetcher = vi.fn(async () => new Response('{}'));
	vi.stubGlobal('fetch', fetcher);
	const base = { preview: false, ip: '203.0.113.9', token: 'phc_test', skip: false };
	const form = (origin = SITE) =>
		new Request(`${SITE}/blog/a?/contact`, {
			method: 'POST',
			headers: { origin, 'user-agent': CHROME }
		});

	it('sends the event for the page it was posted from, in waitUntil', async () => {
		fetcher.mockClear();
		const waited: Promise<unknown>[] = [];
		sendServerEvent('contact_sent', {
			...base,
			request: form(),
			waitUntil: (p) => void waited.push(p)
		});
		await Promise.all(waited);
		const body = JSON.parse(
			(fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body as string
		);
		expect(body.batch[0]).toMatchObject({
			event: 'contact_sent',
			properties: { $pathname: '/blog/a', $current_url: `${SITE}/blog/a`, $ip: '203.0.113.9' }
		});
	});

	it.each([
		['the author’s devices', { skip: true }],
		['without a token', { token: '' }],
		['preview mode', { preview: true }]
	])('sends nothing from %s', (_, overrides) => {
		const waitUntil = vi.fn();
		sendServerEvent('contact_sent', { ...base, ...overrides, request: form(), waitUntil });
		expect(waitUntil).not.toHaveBeenCalled();
	});
});
